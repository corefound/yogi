// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/lowering/declarationLowerer.h"

#include "llvm/lowering/statementLowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Constants.h>
#include <llvm/IR/Function.h>
#include <llvm/IR/GlobalVariable.h>
#include <llvm/IR/Type.h>

#include <map>
#include <optional>

namespace yogi::core::llvm::internal {

	namespace {
		std::vector<std::string> nativeAbiMetadataParts(const std::string &metadata) {
			std::vector<std::string> parts;
			std::size_t start = 0;

			while (start <= metadata.size()) {
				const auto end = metadata.find('|', start);
				const auto part = metadata.substr(start, end == std::string::npos ? std::string::npos : end - start);
				if (!part.empty()) {
					parts.push_back(part);
				}

				if (end == std::string::npos) {
					break;
				}

				start = end + 1;
			}

			return parts;
		}

		std::string nativeResourceDestructorFromBuiltinMethod(const flatbuffers::String *metadata) {
			static const std::string prefix = "native.return.resource.destructor=";

			for (const auto &part: nativeAbiMetadataParts(fbString(metadata))) {
				if (part.rfind(prefix, 0) == 0) {
					return part.substr(prefix.size());
				}
			}

			return "";
		}

		std::optional<std::size_t> borrowedArrayReturnParameter(const Yogi::Sir::CallExpression *call) {
			static const std::string prefix = "array.return.ownership=borrowed;parameter=";

			for (const auto &part: nativeAbiMetadataParts(fbString(call ? call->builtin_method() : nullptr))) {
				if (part.rfind(prefix, 0) != 0) {
					continue;
				}

				const auto rawIndex = part.substr(prefix.size());
				try {
					return static_cast<std::size_t>(std::stoull(rawIndex));
				} catch (...) {
					return std::nullopt;
				}
			}

			return std::nullopt;
		}

		std::string nativeResourceDestructorFromValue(const Yogi::Sir::ValueRef *value, const ModuleLoweringContext &context) {
			const auto *call = value ? value->call() : nullptr;
			if (!call) {
				return "";
			}

			const auto direct = nativeResourceDestructorFromBuiltinMethod(call->builtin_method());
			if (!direct.empty()) {
				return direct;
			}

			const auto qualifiedName = fbString(call->qualified_name());
			const auto summary = context.nativeResourceReturnDestructors.find(qualifiedName);
			return summary == context.nativeResourceReturnDestructors.end() ? "" : summary->second;
		}

		std::optional<std::string> nativeResourceOwnerDestructorFromValue(const Yogi::Sir::ValueRef *value, const ModuleLoweringContext &context) {
			const auto direct = nativeResourceDestructorFromValue(value, context);
			if (!direct.empty()) {
				return direct;
			}

			const auto *identifier = value ? value->identifier() : nullptr;
			return identifier ? context.nativeResourceDestroyFunction(fbString(identifier->name())) : std::nullopt;
		}

		bool isMoveCall(const Yogi::Sir::ValueRef *value) {
			const auto *call = value ? value->call() : nullptr;
			return call && fbString(call->builtin_method()) == "move";
		}

		std::string moveSourceName(const Yogi::Sir::ValueRef *value) {
			const auto *call = value ? value->call() : nullptr;
			if (!call || fbString(call->builtin_method()) != "move" || !call->arguments() || call->arguments()->size() == 0) {
				return "";
			}

			const auto *argument = call->arguments()->Get(0);
			const auto *identifier = argument ? argument->identifier() : nullptr;
			return identifier ? fbString(identifier->name()) : "";
		}

		using NativeResourceFieldMap = std::map<std::string, std::string>;

		std::string rootIdentifierName(const Yogi::Sir::ValueRef *value) {
			if (!value) {
				return "";
			}

			if (const auto *identifier = value->identifier()) {
				return fbString(identifier->name());
			}

			if (const auto *access = value->element_access()) {
				return rootIdentifierName(access->object());
			}

			if (const auto *access = value->property_access()) {
				return rootIdentifierName(access->object());
			}

			return "";
		}

		std::string aggregateOwnerName(const Yogi::Sir::ValueRef *value, const ModuleLoweringContext &context) {
			const auto root = rootIdentifierName(value);
			if (root.empty()) {
				return "";
			}

			const auto owner = context.resolveAggregateOwner(root);
			return owner ? *owner : root;
		}

		const Yogi::Sir::TypeRef *semanticTypeOf(const Yogi::Sir::ValueRef *value) {
			if (!value) {
				return nullptr;
			}

			if (const auto *identifier = value->identifier()) {
				return identifier->type();
			}
			if (const auto *access = value->element_access()) {
				return access->type();
			}
			if (const auto *access = value->property_access()) {
				return access->type();
			}
			if (const auto *call = value->call()) {
				return call->type();
			}
			if (const auto *addressOf = value->address_of()) {
				return addressOf->type();
			}

			return nullptr;
		}

		const Yogi::Sir::TypeRef *resolvedType(const Yogi::Sir::TypeRef *type) {
			auto *current = type;

			while (current && current->kind() == Yogi::Sir::TypeKind_type_reference && current->resolved()) {
				current = current->resolved();
			}

			return current;
		}

		bool createsBorrowedFixedShapeView(const Yogi::Sir::ValueRef *value) {
			const auto *access = value ? value->element_access() : nullptr;
			if (!access) {
				return false;
			}

			const auto *objectType = resolvedType(semanticTypeOf(access->object()));
			if (objectType && objectType->kind() == Yogi::Sir::TypeKind_pointer_type) {
				objectType = resolvedType(objectType->element_type());
			}

			if (!objectType || objectType->kind() != Yogi::Sir::TypeKind_array_type || !objectType->fixed() || !objectType->shape() || objectType->shape()->size() == 0) {
				return false;
			}

			const auto *indices = access->indices();
			const auto consumedDimensions = indices && indices->size() > 0 ? indices->size() : 1;
			return consumedDimensions < objectType->shape()->size();
		}

		NativeResourceFieldMap nativeResourceArrayElementFieldsFromCall(const Yogi::Sir::CallExpression *call, const ModuleLoweringContext &context) {
			static const std::string metadataPrefix = "native.return.array.element.resource.destructor=";
			NativeResourceFieldMap result;

			for (const auto &part: nativeAbiMetadataParts(fbString(call ? call->builtin_method() : nullptr))) {
				if (part.rfind(metadataPrefix, 0) != 0) {
					continue;
				}

				const auto payload = part.substr(metadataPrefix.size());
				const auto separator = payload.find('=');
				if (separator == std::string::npos || separator == 0 || separator + 1 >= payload.size()) {
					continue;
				}

				result[payload.substr(0, separator)] = payload.substr(separator + 1);
			}

			if (!result.empty()) {
				return result;
			}

			const auto method = fbString(call ? call->builtin_method() : nullptr);
			if (method != "array.pop" && method != "array.shift" && method != "array.splice") {
				return {};
			}

			const auto *callee = call->callee() ? call->callee()->property_access() : nullptr;
			const auto owner = callee ? aggregateOwnerName(callee->object(), context) : "";
			return owner.empty() ? NativeResourceFieldMap() : context.nativeResourceArrayElementFieldDestroyFunctions(owner);
		}

		NativeResourceFieldMap prefixedNativeResourceFields(const NativeResourceFieldMap &fields, const std::string &prefix) {
			if (prefix.empty()) {
				return fields;
			}

			NativeResourceFieldMap result;
			for (const auto &[fieldPath, destroyFunction]: fields) {
				result[prefix + "." + fieldPath] = destroyFunction;
			}

			return result;
		}

		NativeResourceFieldMap nativeResourceFieldsFromMoveCall(const Yogi::Sir::ValueRef *value) {
			static const std::string prefix = "native.resource.field.";
			NativeResourceFieldMap result;

			const auto *call = value ? value->call() : nullptr;
			if (!call || !isMoveCall(value)) {
				return result;
			}

			const auto metadata = fbString(call->linkage_name());
			std::size_t start = 0;
			while (start <= metadata.size()) {
				const auto end = metadata.find('|', start);
				const auto part = metadata.substr(start, end == std::string::npos ? std::string::npos : end - start);

				if (part.rfind(prefix, 0) == 0) {
					const auto entry = part.substr(prefix.size());
					const auto separator = entry.find('=');
					if (separator != std::string::npos && separator > 0 && separator + 1 < entry.size()) {
						result[entry.substr(0, separator)] = entry.substr(separator + 1);
					}
				}

				if (end == std::string::npos) {
					break;
				}

				start = end + 1;
			}

			return result;
		}

		void mergeNativeResourceFields(NativeResourceFieldMap &target, const NativeResourceFieldMap &source) {
			for (const auto &[fieldPath, destroyFunction]: source) {
				target[fieldPath] = destroyFunction;
			}
		}

		std::optional<std::string> nativeResourceOwnerDestructorFromValueForInference(const Yogi::Sir::ValueRef *value, const ModuleLoweringContext &context, const std::map<std::string, std::string> &localPointerDestructors) {
			const auto direct = nativeResourceDestructorFromValue(value, context);
			if (!direct.empty()) {
				return direct;
			}

			const auto *identifier = value ? value->identifier() : nullptr;
			if (!identifier) {
				return std::nullopt;
			}

			const auto source = localPointerDestructors.find(fbString(identifier->name()));
			return source == localPointerDestructors.end() ? std::nullopt : std::optional<std::string>(source->second);
		}

		NativeResourceFieldMap nativeResourceStructFieldsFromValue(
			const Yogi::Sir::ValueRef *value,
			const ModuleLoweringContext &context,
			const std::map<std::string, std::string> &localPointerDestructors,
			const std::map<std::string, NativeResourceFieldMap> &localStructFields,
			const std::string &prefix = "") {
			NativeResourceFieldMap result;

			if (!value) {
				return result;
			}

			if (isMoveCall(value)) {
				const auto sourceName = moveSourceName(value);
				const auto source = localStructFields.find(sourceName);
				if (source != localStructFields.end()) {
					return prefixedNativeResourceFields(source->second, prefix);
				}

				return prefixedNativeResourceFields(nativeResourceFieldsFromMoveCall(value), prefix);
			}

			if (const auto *identifier = value->identifier()) {
				const auto source = localStructFields.find(fbString(identifier->name()));
				return source == localStructFields.end() ? result : prefixedNativeResourceFields(source->second, prefix);
			}

			if (const auto *call = value->call()) {
				auto fields = nativeResourceArrayElementFieldsFromCall(call, context);
				if (fields.empty()) {
					const auto summary = context.nativeResourceStructReturnDestructors.find(fbString(call->qualified_name()));
					if (summary != context.nativeResourceStructReturnDestructors.end()) {
						fields = summary->second;
					}
				}

				return prefixedNativeResourceFields(fields, prefix);
			}

			const auto *object = value->object();
			if (!object || !object->properties()) {
				return result;
			}

			for (const auto *property: *object->properties()) {
				const auto fieldName = fbString(property->key());
				const auto fieldPath = prefix.empty() ? fieldName : prefix + "." + fieldName;
				const auto destructor = nativeResourceOwnerDestructorFromValueForInference(property->value(), context, localPointerDestructors);

				if (destructor) {
					result[fieldPath] = *destructor;
				}

				mergeNativeResourceFields(result, nativeResourceStructFieldsFromValue(property->value(), context, localPointerDestructors, localStructFields, fieldPath));
			}

			return result;
		}

		void registerNativeResourceStructFields(const std::string &owner, const Yogi::Sir::ValueRef *value, ModuleLoweringContext &context, const std::string &prefix = "") {
			const auto *object = value ? value->object() : nullptr;
			if (!object || !object->properties()) {
				if (isMoveCall(value)) {
					const auto source = moveSourceName(value);
					auto fields = context.nativeResourceFieldDestroyFunctions(source);
					if (fields.empty()) {
						fields = nativeResourceFieldsFromMoveCall(value);
					}
					context.clearNativeResourceFieldOwners(source);
					context.registerNativeResourceFieldOwners(owner, prefixedNativeResourceFields(fields, prefix));
					context.deactivateAggregateOwner(source);
					return;
				}

				const auto *call = value ? value->call() : nullptr;
				if (call) {
					auto fields = nativeResourceArrayElementFieldsFromCall(call, context);
					if (fields.empty()) {
						const auto summary = context.nativeResourceStructReturnDestructors.find(fbString(call->qualified_name()));
						if (summary != context.nativeResourceStructReturnDestructors.end()) {
							fields = summary->second;
						}
					}
					if (!fields.empty()) {
						context.registerNativeResourceFieldOwners(owner, prefixedNativeResourceFields(fields, prefix));
					}
				}

				return;
			}

			for (const auto *property: *object->properties()) {
				const auto fieldName = fbString(property->key());
				const auto fieldPath = prefix.empty() ? fieldName : prefix + "." + fieldName;
				const auto destructor = nativeResourceOwnerDestructorFromValue(property->value(), context);

				if (destructor) {
					context.registerNativeResourceFieldOwner(owner, fieldPath, *destructor);

					if (const auto *identifier = property->value() ? property->value()->identifier() : nullptr) {
						context.deactivateAggregateOwner(fbString(identifier->name()));
					}
				}

				registerNativeResourceStructFields(owner, property->value(), context, fieldPath);
			}
		}

		bool isPointerType(const Yogi::Sir::TypeRef *type) {
			const auto *current = type;

			while (current && current->kind() == Yogi::Sir::TypeKind_type_reference && current->resolved()) {
				current = current->resolved();
			}

			return current && current->kind() == Yogi::Sir::TypeKind_pointer_type;
		}

		std::string aggregateRootIdentifier(const Yogi::Sir::ValueRef *value) {
			if (!value) {
				return "";
			}

			if (const auto *identifier = value->identifier()) {
				return fbString(identifier->name());
			}

			if (const auto *access = value->element_access()) {
				return aggregateRootIdentifier(access->object());
			}

			if (const auto *access = value->property_access()) {
				return aggregateRootIdentifier(access->object());
			}

			if (const auto *addressOf = value->address_of()) {
				return aggregateRootIdentifier(addressOf->target());
			}

			if (const auto *dereference = value->dereference()) {
				return aggregateRootIdentifier(dereference->target());
			}

			return "";
		}

		std::string inferFunctionNativeResourceReturnDestructor(const Yogi::Sir::FunctionDeclaration *function, const ModuleLoweringContext &context) {
			if (!function || !isPointerType(function->return_type()) || !function->body() || !function->body()->statements()) {
				return "";
			}

			std::map<std::string, std::string> localDestructors;

			for (const auto *statement: *function->body()->statements()) {
				if (const auto *variable = statement->value_as_VariableDeclaration()) {
					const auto destructor = nativeResourceDestructorFromValue(variable->value(), context);
					if (!destructor.empty()) {
						localDestructors[fbString(variable->name())] = destructor;
						continue;
					}

					if (const auto *identifier = variable->value() ? variable->value()->identifier() : nullptr) {
						const auto source = localDestructors.find(fbString(identifier->name()));
						if (source != localDestructors.end()) {
							localDestructors[fbString(variable->name())] = source->second;
						}
					}
					continue;
				}

				const auto *returnStatement = statement->value_as_ReturnStatement();
				if (!returnStatement) {
					continue;
				}

				const auto direct = nativeResourceDestructorFromValue(returnStatement->value(), context);
				if (!direct.empty()) {
					return direct;
				}

				if (const auto *identifier = returnStatement->value() ? returnStatement->value()->identifier() : nullptr) {
					const auto source = localDestructors.find(fbString(identifier->name()));
					if (source != localDestructors.end()) {
						return source->second;
					}
				}
			}

			return "";
		}

		std::optional<NativeResourceFieldMap> inferNativeResourceStructReturnFromBlock(
			const Yogi::Sir::BlockStatement *block,
			const ModuleLoweringContext &context,
			std::map<std::string, std::string> localPointerDestructors,
			std::map<std::string, NativeResourceFieldMap> localStructFields) {
			if (!block || !block->statements()) {
				return std::nullopt;
			}

			for (const auto *statement: *block->statements()) {
				if (const auto *variable = statement->value_as_VariableDeclaration()) {
					const auto name = fbString(variable->name());
					auto pointerDestructor = nativeResourceDestructorFromValue(variable->value(), context);

					if (pointerDestructor.empty()) {
						const auto *identifier = variable->value() ? variable->value()->identifier() : nullptr;
						if (identifier) {
							const auto source = localPointerDestructors.find(fbString(identifier->name()));
							if (source != localPointerDestructors.end()) {
								pointerDestructor = source->second;
							}
						}
					}

					if (!pointerDestructor.empty() && isPointerType(variable->type())) {
						localPointerDestructors[name] = pointerDestructor;
					}

					const auto fields = nativeResourceStructFieldsFromValue(variable->value(), context, localPointerDestructors, localStructFields);
					if (!fields.empty()) {
						localStructFields[name] = fields;
					}
					continue;
				}

				if (const auto *returnStatement = statement->value_as_ReturnStatement()) {
					const auto fields = nativeResourceStructFieldsFromValue(returnStatement->value(), context, localPointerDestructors, localStructFields);
					if (!fields.empty()) {
						return fields;
					}
					continue;
				}

				if (const auto *nested = statement->value_as_BlockStatement()) {
					auto result = inferNativeResourceStructReturnFromBlock(nested, context, localPointerDestructors, localStructFields);
					if (result && !result->empty()) {
						return result;
					}
					continue;
				}

				if (const auto *ifStatement = statement->value_as_IfStatement()) {
					auto thenResult = inferNativeResourceStructReturnFromBlock(ifStatement->then_block(), context, localPointerDestructors, localStructFields);
					if (thenResult && !thenResult->empty()) {
						return thenResult;
					}

					auto elseResult = inferNativeResourceStructReturnFromBlock(ifStatement->else_block(), context, localPointerDestructors, localStructFields);
					if (elseResult && !elseResult->empty()) {
						return elseResult;
					}
				}
			}

			return std::nullopt;
		}

		NativeResourceFieldMap inferFunctionNativeResourceStructReturnDestructors(const Yogi::Sir::FunctionDeclaration *function, const ModuleLoweringContext &context) {
			if (!function || !function->body()) {
				return {};
			}

			const auto result = inferNativeResourceStructReturnFromBlock(function->body(), context, {}, {});
			return result.value_or(NativeResourceFieldMap{});
		}
	} // namespace

	VariableLowerer::VariableLowerer(ModuleLoweringContext &context, TypeLowerer &types, ValueLowerer &values) : context(context), types(types), values(values) {}

	void VariableLowerer::predeclareGlobals() {
		for (const auto *node: *context.sirModule->nodes()) {
			if (const auto *variable = node->value_as_VariableDeclaration()) {
				declareGlobal(variable);
			}
		}
	}

	::llvm::GlobalVariable *VariableLowerer::declareGlobal(const Yogi::Sir::VariableDeclaration *variable) {
		const auto name = fbString(variable->qualified_name()) != "" ? fbString(variable->qualified_name()) : fbString(variable->name());
		const auto symbolName = "_yogi_" + sanitizeSymbol(name);
		auto *type = types.lower(variable->type());
		auto *global = context.module->getGlobalVariable(symbolName);

		if (global) {
			context.globals[fbString(variable->name())] = global;
			context.globalTypes[fbString(variable->name())] = variable->type();
			context.globalTypeKinds[fbString(variable->name())] = variable->type()->kind();
			return global;
		}

		global = new ::llvm::GlobalVariable(*context.module, type, false, variable->exported() ? ::llvm::GlobalValue::ExternalLinkage : ::llvm::GlobalValue::InternalLinkage, types.zero(type), symbolName);

		context.globals[fbString(variable->name())] = global;
		context.globalTypes[fbString(variable->name())] = variable->type();
		context.globalTypeKinds[fbString(variable->name())] = variable->type()->kind();

		return global;
	}

	void VariableLowerer::lowerVariable(const Yogi::Sir::VariableDeclaration *variable) {
		auto *type = types.lower(variable->type());
		const auto name = fbString(variable->name());
		const auto isGlobalVariable = variable->scope_id() == 0 && context.globals.contains(name);
		const auto isAggregateType = [](const Yogi::Sir::TypeRef *typeRef) {
			if (!typeRef) {
				return false;
			}

			const auto kind = typeRef->resolved() ? typeRef->resolved()->kind() : typeRef->kind();

			return kind == Yogi::Sir::TypeKind_array_type || kind == Yogi::Sir::TypeKind_tuple_type || kind == Yogi::Sir::TypeKind_type_literal;
		};
		const auto isStringType = [](const Yogi::Sir::TypeRef *typeRef) {
			if (!typeRef) {
				return false;
			}

			const auto kind = typeRef->resolved() ? typeRef->resolved()->kind() : typeRef->kind();

			return kind == Yogi::Sir::TypeKind_string_type;
		};
		const auto isBoxedDynamicType = [](const Yogi::Sir::TypeRef *typeRef) {
			while (typeRef && typeRef->kind() == Yogi::Sir::TypeKind_type_reference && typeRef->resolved()) {
				typeRef = typeRef->resolved();
			}

			return typeRef && (
				typeRef->kind() == Yogi::Sir::TypeKind_any_type ||
				typeRef->kind() == Yogi::Sir::TypeKind_union_type
			);
		};
		const auto isStructType = variable->type() && variable->type()->kind() == Yogi::Sir::TypeKind_type_reference && context.structTypes.contains(fbString(variable->type()->name()));
		const auto receiverReturningArrayMethod = [](const Yogi::Sir::ValueRef *value) {
			const auto *call = value ? value->call() : nullptr;
			if (!call || !call->builtin_method()) {
				return false;
			}

			const auto method = fbString(call->builtin_method());
			return method == "array.reverse" || method == "array.fill" || method == "array.copyWithin" || method == "array.sort";
		};
		const auto isStableIterationPlan = [](const Yogi::Sir::ValueRef *value) {
			const auto *call = value ? value->call() : nullptr;
			if (!call || !call->builtin_method()) {
				return false;
			}

			const auto method = fbString(call->builtin_method());
			return method == "__yogiStablePlan" || method == "array.__yogiStablePlan";
		};
		const auto isOwnedAggregateInitializer =
			variable->value() && (values.isAggregateLiteral(variable->value()) || (variable->value()->call() && !receiverReturningArrayMethod(variable->value()) && !borrowedArrayReturnParameter(variable->value()->call()).has_value()));
		const auto isLocalStackAggregate =
			!isGlobalVariable &&
			fbString(variable->storage()) == "stack" &&
			!variable->escapes() &&
			values.isAggregateLiteral(variable->value()) &&
			!isStructType &&
			!isBoxedDynamicType(variable->type());
		const auto isLocalOwnedHeapAggregate = !isGlobalVariable && fbString(variable->storage()) == "stack" && isAggregateType(variable->type()) && isOwnedAggregateInitializer && !isLocalStackAggregate && !isStructType;
		const auto isLocalString = !isGlobalVariable && fbString(variable->storage()) == "stack" && isStringType(variable->type());
		const auto isLocalStruct = !isGlobalVariable && isStructType;
		const auto nativeResourceDestructor = nativeResourceDestructorFromValue(variable->value(), context);
		const auto isLocalNativeResource = !isGlobalVariable && fbString(variable->storage()) == "stack" && isPointerType(variable->type()) && !nativeResourceDestructor.empty();
		const auto shouldRetainEscapedGraph = !isGlobalVariable && variable->escapes() && values.isAggregateLiteral(variable->value());
		const auto isLocalBorrowedFixedShapeView = !isGlobalVariable && !variable->escapes() && createsBorrowedFixedShapeView(variable->value());

		context.pushMemorySourceLocation(variable->position());
		auto *initializer = isLocalStackAggregate ? values.lowerLocalAggregate(variable->value(), name, variable->type())
			: shouldRetainEscapedGraph			  ? values.lowerWithEscapedObjectGraphRetention(variable->value(), type, variable->type())
												  : values.lower(variable->value(), type, variable->type());
		initializer = values.materializeBoxedValueCopy(initializer, variable->value(), variable->type());
		context.popMemorySourceLocation();

		if (isGlobalVariable) {
			context.builder.CreateStore(values.cast(initializer, type, variable->type()), context.globals[name]);
			return;
		}

		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *slot = context.createEntryAlloca(function, name, type);

		const auto inSwitchBody = context.switchBodyDepth > 0;
		if (inSwitchBody && (isLocalStackAggregate || isLocalOwnedHeapAggregate)) {
			auto entryIt = function->getEntryBlock().begin();
			++entryIt;
			::llvm::IRBuilder<> entryBuilder(&function->getEntryBlock(), entryIt);
			entryBuilder.CreateStore(::llvm::Constant::getNullValue(type), slot);
		}

		context.builder.CreateStore(values.cast(initializer, type, variable->type()), slot);
		context.locals[name] = slot;
		context.localTypes[name] = variable->type();
		context.localTypeKinds[name] = variable->type()->kind();

		if (isLocalNativeResource) {
			context.registerNativeResourceOwner(name, variable->symbol_id(), initializer, slot, nativeResourceDestructor, variable->position());
		} else if (const auto *identifier = variable->value() ? variable->value()->identifier() : nullptr) {
			const auto sourceName = fbString(identifier->name());
			const auto sourceDestructor = context.nativeResourceDestroyFunction(sourceName);
			if (sourceDestructor && isPointerType(variable->type())) {
				context.deactivateAggregateOwner(sourceName);
				context.registerNativeResourceOwner(name, variable->symbol_id(), initializer, slot, *sourceDestructor, variable->position());
			}
		}

		if (isLocalBorrowedFixedShapeView) {
			context.registerRuntimeCleanup(name, variable->symbol_id(), initializer, slot, "yogi_array_release", variable->position());

			if (const auto *elementAccess = variable->value() ? variable->value()->element_access() : nullptr) {
				const auto ownerName = aggregateRootIdentifier(elementAccess->object());
				if (!ownerName.empty()) {
					context.aliasAggregateOwner(name, ownerName);
					context.borrowedViewAliases[name] = ownerName;
				}
			}
		} else if (isLocalStackAggregate) {
			context.registerAggregateOwner(name, variable->symbol_id(), variable->type(), initializer, false, inSwitchBody ? slot : nullptr, variable->position());
		} else if (isStableIterationPlan(variable->value())) {
			context.registerRuntimeCleanup(name, variable->symbol_id(), initializer, slot, "yogi_array_iteration_plan_destroy", variable->position());
		} else if (isLocalOwnedHeapAggregate) {
			context.registerAggregateOwner(name, variable->symbol_id(), variable->type(), initializer, true, inSwitchBody ? slot : nullptr, variable->position());
			if (const auto *call = variable->value() ? variable->value()->call() : nullptr) {
				const auto fields = nativeResourceArrayElementFieldsFromCall(call, context);
				if (!fields.empty()) {
					context.registerNativeResourceArrayElementFieldOwners(name, fields);
				}
			}
		} else if (isLocalString) {
			context.registerAggregateOwner(name, variable->symbol_id(), variable->type(), initializer, true, slot, variable->position());
		} else if (isBoxedDynamicType(variable->type())) {
			context.registerRuntimeCleanup(
				name,
				variable->symbol_id(),
				initializer,
				slot,
				"yogi_any_destroy",
				variable->position());
		} else if (isLocalStruct) {
			context.registerAggregateOwner(name, variable->symbol_id(), variable->type(), initializer, false, slot, variable->position());
			registerNativeResourceStructFields(name, variable->value(), context);
		} else if (isAggregateType(variable->type())) {
			if (const auto *identifier = variable->value() ? variable->value()->identifier() : nullptr) {
				context.aliasAggregateOwner(name, fbString(identifier->name()));
			} else if (const auto *elementAccess = variable->value() ? variable->value()->element_access() : nullptr) {
				const auto ownerName = aggregateRootIdentifier(elementAccess->object());
				if (!ownerName.empty()) {
					context.aliasAggregateOwner(name, ownerName);
					context.borrowedViewAliases[name] = ownerName;
				}
			} else if (const auto *dereference = variable->value() ? variable->value()->dereference() : nullptr) {
				const auto ownerName = aggregateRootIdentifier(dereference->target());
				if (!ownerName.empty()) {
					context.aliasAggregateOwner(name, ownerName);
					context.borrowedViewAliases[name] = ownerName;
				}
			} else if (const auto *call = variable->value() ? variable->value()->call() : nullptr) {
				if (const auto parameterIndex = borrowedArrayReturnParameter(call)) {
					if (call->arguments() && *parameterIndex < call->arguments()->size()) {
						const auto ownerName = aggregateOwnerName(call->arguments()->Get(static_cast<flatbuffers::uoffset_t>(*parameterIndex)), context);
						if (!ownerName.empty()) {
							context.aliasAggregateOwner(name, ownerName);
							context.borrowedViewAliases[name] = ownerName;
						}
					}
					return;
				}

				const auto *property = call->callee() ? call->callee()->property_access() : nullptr;
				const auto *receiver = property && property->object() ? property->object()->identifier() : nullptr;

				if (receiverReturningArrayMethod(variable->value()) && receiver) {
					context.aliasAggregateOwner(name, fbString(receiver->name()));
				}
			}
		}
	}

	FunctionLowerer::FunctionLowerer(ModuleLoweringContext &context, TypeLowerer &types, ValueLowerer &values) : context(context), types(types), values(values) {}

	void FunctionLowerer::setStatementLowerer(StatementLowerer *statementLowerer) {
		statements = statementLowerer;
	}

	void FunctionLowerer::lowerFunctions() {
		std::vector<const Yogi::Sir::FunctionDeclaration *> functions;

		for (const auto *node: *context.sirModule->nodes()) {
			if (const auto *function = node->value_as_FunctionDeclaration()) {
				functions.push_back(function);
			}
		}

		for (std::size_t pass = 0; pass < functions.size(); ++pass) {
			bool changed = false;

			for (const auto *function: functions) {
				const auto qualifiedName = fbString(function->qualified_name());
				const auto destructor = inferFunctionNativeResourceReturnDestructor(function, context);
				if (!destructor.empty() && context.nativeResourceReturnDestructors[qualifiedName] != destructor) {
					context.nativeResourceReturnDestructors[qualifiedName] = destructor;
					changed = true;
				}

				const auto structDestructors = inferFunctionNativeResourceStructReturnDestructors(function, context);
				if (!structDestructors.empty() && context.nativeResourceStructReturnDestructors[qualifiedName] != structDestructors) {
					context.nativeResourceStructReturnDestructors[qualifiedName] = structDestructors;
					changed = true;
				}
			}

			if (!changed) {
				break;
			}
		}

		for (const auto *function: functions) {
			lowerFunction(function);
		}
	}

	void FunctionLowerer::lowerFunction(const Yogi::Sir::FunctionDeclaration *function) {
		std::vector<::llvm::Type *> parameterTypes;
		const auto resolvedKind = [](const Yogi::Sir::TypeRef *type) {
			const auto *current = type;

			while (current && current->kind() == Yogi::Sir::TypeKind_type_reference && current->resolved()) {
				current = current->resolved();
			}

			return current ? current->kind() : Yogi::Sir::TypeKind_unknown_type;
		};

		if (function->parameters()) {
			for (const auto *parameter: *function->parameters()) {
				parameterTypes.push_back(types.lower(parameter->type()));
			}
		}

		auto *returnType = types.lower(function->return_type());
		auto *functionType = ::llvm::FunctionType::get(returnType, parameterTypes, false);
		const auto functionName = "_yogi_fn_" + sanitizeSymbol(fbString(function->qualified_name()));
		auto *llvmFunction = context.module->getFunction(functionName);

		if (llvmFunction) {
			if (llvmFunction->getFunctionType() != functionType || !llvmFunction->empty()) {
				throw std::runtime_error("conflicting LLVM declaration for function '" + functionName + "'");
			}

			llvmFunction->setLinkage(function->exported() ? ::llvm::Function::ExternalLinkage : ::llvm::Function::InternalLinkage);
		} else {
			llvmFunction = ::llvm::Function::Create(functionType, function->exported() ? ::llvm::Function::ExternalLinkage : ::llvm::Function::InternalLinkage, functionName, context.module.get());
		}

		auto *entry = ::llvm::BasicBlock::Create(context.llvmContext, "entry", llvmFunction);
		context.builder.SetInsertPoint(entry);
		context.clearLocalState();
		context.currentReturnType = function->return_type();
		context.pushMemoryContext(fbString(function->qualified_name()));

		unsigned index = 0;
		if (function->parameters()) {
			for (const auto *parameter: *function->parameters()) {
				auto *argument = llvmFunction->getArg(index++);
				argument->setName(fbString(parameter->name()));
				auto *storedArgument = static_cast<::llvm::Value *>(argument);
				const auto parameterKind = resolvedKind(parameter->type());
				const auto cloneLocalAggregate =
					parameterKind == Yogi::Sir::TypeKind_string_type ||
					parameterKind == Yogi::Sir::TypeKind_array_type ||
					parameterKind == Yogi::Sir::TypeKind_tuple_type ||
					parameterKind == Yogi::Sir::TypeKind_type_literal;
				const auto cloneLocalDynamicBox = parameterKind == Yogi::Sir::TypeKind_any_type || parameterKind == Yogi::Sir::TypeKind_union_type;
				const auto cloneLocalStruct =
					values.isStructType(parameter->type()) &&
					values.typeRequiresOwnedCopy(parameter->type()) &&
					!values.typeContainsPointer(parameter->type());

				if (cloneLocalAggregate || cloneLocalDynamicBox || cloneLocalStruct) {
					storedArgument = values.copyOwnedValue(argument, parameter->type());
					storedArgument->setName(sanitizeSymbol(fbString(parameter->name())) + ".param.clone");
				}

				auto *slot = context.createEntryAlloca(llvmFunction, fbString(parameter->name()), argument->getType());
				context.builder.CreateStore(storedArgument, slot);
				context.locals[fbString(parameter->name())] = slot;
				context.localTypes[fbString(parameter->name())] = parameter->type();
				context.localTypeKinds[fbString(parameter->name())] = parameter->type()->kind();

				if (cloneLocalAggregate || cloneLocalStruct) {
					context.registerAggregateOwner(fbString(parameter->name()), parameter->symbol_id(), parameter->type(), storedArgument, true, slot, parameter->position());
				} else if (cloneLocalDynamicBox) {
					context.registerRuntimeCleanup(
						fbString(parameter->name()),
						parameter->symbol_id(),
						storedArgument,
						slot,
						"yogi_any_destroy",
						parameter->position());
				}
			}
		}

		statements->lowerBlock(function->body());

		if (!context.builder.GetInsertBlock()->hasTerminator()) {
			statements->emitLocalCleanups();
			context.popMemoryContext();
			if (returnType->isVoidTy()) {
				context.builder.CreateRetVoid();
			} else {
				context.builder.CreateRet(types.zero(returnType));
			}
		}

		context.clearLocalState();
		context.currentReturnType = nullptr;
	}

} // namespace yogi::core::llvm::internal
#endif
