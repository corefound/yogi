// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/lowering/valueLowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Constants.h>
#include <llvm/IR/DerivedTypes.h>
#include <llvm/IR/Function.h>

#include <limits>
#include <tuple>

namespace yogi::core::llvm::internal {

	namespace {
		std::string identifierName(const Yogi::Sir::ValueRef *value) {
			const auto *identifier = value ? value->identifier() : nullptr;
			return identifier ? fbString(identifier->name()) : "";
		}
	}

	ValueLowerer::ValueLowerer(ModuleLoweringContext &context, TypeLowerer &types)
		: context(context),
		  types(types) {}

	::llvm::Value *ValueLowerer::lower(
		const Yogi::Sir::ValueRef *value,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		if (!value) {
			return types.zero(expectedType);
		}

		if (const auto *constant = value->constant()) {
			return lowerConstant(constant, expectedType, expectedSemanticType);
		}

		if (const auto *identifier = value->identifier()) {
			return lowerIdentifier(identifier, expectedType, expectedSemanticType);
		}

		if (const auto *binary = value->binary()) {
			return lowerBinary(binary, expectedType, expectedSemanticType);
		}

		if (const auto *assignment = value->assignment()) {
			return lowerAssignment(assignment);
		}

		if (const auto *conditional = value->conditional()) {
			return lowerConditional(conditional, expectedType, expectedSemanticType);
		}

		if (const auto *call = value->call()) {
			return lowerCall(call, expectedType, expectedSemanticType);
		}

		if (const auto *array = value->array()) {
			return lowerArray(array, expectedType, expectedSemanticType);
		}

		if (const auto *object = value->object()) {
			return lowerObject(object, expectedType, expectedSemanticType);
		}

		if (const auto *access = value->property_access()) {
			return lowerPropertyAccess(access, expectedType, expectedSemanticType);
		}

		if (const auto *access = value->element_access()) {
			return lowerElementAccess(access, expectedType, expectedSemanticType);
		}

		if (const auto *assignment = value->aggregate_assignment()) {
			return lowerAggregateAssignment(assignment);
		}

		return types.zero(expectedType);
	}

	::llvm::Value *ValueLowerer::lowerCall(
		const Yogi::Sir::CallExpression *call,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		if (fbString(call->builtin_method()) == "print") {
			return lowerPrintCall(call, expectedType, expectedSemanticType);
		}

		if (call->callee() && call->callee()->property_access()) {
			return lowerBuiltinMethodCall(call, expectedType, expectedSemanticType);
		}

		std::vector<::llvm::Value *> arguments;
		std::vector<::llvm::Type *> argumentTypes;

		if (call->arguments()) {
			for (flatbuffers::uoffset_t index = 0; index < call->arguments()->size(); ++index) {
				const auto *argument = call->arguments()->Get(index);
				const auto *argumentSemanticType = valueSemanticType(argument);
				auto *argumentType = types.lower(argumentSemanticType);
				arguments.push_back(lower(argument, argumentType, argumentSemanticType));
				argumentTypes.push_back(argumentType);

				const auto *effect = call->argument_effects() && index < call->argument_effects()->size()
					? call->argument_effects()->Get(index)
					: nullptr;

				if (effect && effect->escapes()) {
					const auto name = identifierName(argument);
					if (!name.empty()) {
						context.deactivateAggregateOwner(name);
					}
				}
			}
		}

		auto *returnType = types.lower(call->type());
		std::string functionName;

		if (call->external()) {
			if (const auto *identifier = call->callee() ? call->callee()->identifier() : nullptr) {
				functionName = fbString(identifier->name());
			}
		}

		if (functionName.empty()) {
			functionName = "_yogi_fn_" + sanitizeSymbol(fbString(call->qualified_name()));
		}

		auto *function = context.module->getFunction(functionName);

		if (!function) {
			auto *functionType = ::llvm::FunctionType::get(returnType, argumentTypes, false);
			function = ::llvm::Function::Create(
				functionType,
				call->external()
					? ::llvm::Function::ExternalLinkage
					: ::llvm::Function::InternalLinkage,
				functionName,
				context.module.get()
			);
		}

		if (returnType->isVoidTy()) {
			return context.builder.CreateCall(function, arguments);
		}

		auto *result = context.builder.CreateCall(function, arguments, sanitizeSymbol(functionName) + ".call");
		return cast(result, expectedType ? expectedType : returnType, expectedSemanticType, call->type());
	}

	::llvm::Value *ValueLowerer::lowerPrintCall(
		const Yogi::Sir::CallExpression *call,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto *argument = call->arguments() && call->arguments()->size() > 0
			? call->arguments()->Get(0)
			: nullptr;
		const auto *argumentSemanticType = valueSemanticType(argument);
		auto *voidType = ::llvm::Type::getVoidTy(context.llvmContext);

		if (!argument) {
			auto *empty = context.builder.CreateGlobalString("");
			return callRuntime("yogi_print_string", voidType, {empty});
		}

		switch (resolvedTypeKind(argumentSemanticType)) {
			case Yogi::Sir::TypeKind_number_type: {
				auto *value = lower(argument, ::llvm::Type::getDoubleTy(context.llvmContext), argumentSemanticType);
				return callRuntime("yogi_print_number", voidType, {toNumber(value)});
			}

			case Yogi::Sir::TypeKind_boolean_type: {
				auto *value = lower(argument, ::llvm::Type::getInt1Ty(context.llvmContext), argumentSemanticType);
				return callRuntime("yogi_print_boolean", voidType, {toBoolean(value)});
			}

			case Yogi::Sir::TypeKind_string_type: {
				auto *value = lower(argument, opaquePointer(), argumentSemanticType);
				return callRuntime("yogi_print_string", voidType, {value});
			}

			case Yogi::Sir::TypeKind_any_type: {
				auto *value = lower(argument, opaquePointer(), argumentSemanticType);
				return callRuntime("yogi_print_any", voidType, {value});
			}

			case Yogi::Sir::TypeKind_union_type: {
				auto *value = lower(argument, opaquePointer(), argumentSemanticType);
				return callRuntime("yogi_print_any", voidType, {value});
			}

			case Yogi::Sir::TypeKind_array_type:
			case Yogi::Sir::TypeKind_tuple_type: {
				auto *value = lower(argument, opaquePointer(), argumentSemanticType);
				return callRuntime("yogi_print_array", voidType, {value});
			}

			case Yogi::Sir::TypeKind_null_type: {
				auto *value = context.builder.CreateGlobalString("null");
				return callRuntime("yogi_print_string", voidType, {value});
			}

			case Yogi::Sir::TypeKind_undefined_type: {
				auto *value = context.builder.CreateGlobalString("undefined");
				return callRuntime("yogi_print_string", voidType, {value});
			}

			default: {
				auto *value = context.builder.CreateGlobalString("[aggregate]");
				return callRuntime("yogi_print_string", voidType, {value});
			}
		}

		return types.zero(expectedType ? expectedType : types.lower(expectedSemanticType));
	}

	::llvm::Value *ValueLowerer::lowerBuiltinMethodCall(
		const Yogi::Sir::CallExpression *call,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto *callee = call->callee()->property_access();
		const auto methodName = fbString(callee->property());
		const auto *arguments = call->arguments();
		const auto argumentCount = arguments ? arguments->size() : 0;
		const auto numberConstant = [&](double value) {
			return ::llvm::ConstantFP::get(::llvm::Type::getDoubleTy(context.llvmContext), value);
		};
		const auto lowerNumberArgument = [&](flatbuffers::uoffset_t index, double defaultValue) -> ::llvm::Value * {
			if (!arguments || index >= arguments->size()) {
				return numberConstant(defaultValue);
			}

			const auto *argument = arguments->Get(index);
			return lower(argument, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(argument));
		};
		const auto getCallbackFunction = [&]() -> ::llvm::Function * {
			const auto *callbackArgument = arguments && arguments->size() > 0
				? arguments->Get(0)
				: nullptr;
			const auto *identifier = callbackArgument ? callbackArgument->identifier() : nullptr;

			if (!identifier || !identifier->qualified_name()) {
				return nullptr;
			}

			const auto callbackName = "_yogi_fn_" + sanitizeSymbol(fbString(identifier->qualified_name()));
			return context.module->getFunction(callbackName);
		};
		const auto getInlineCallback = [&]() -> const Yogi::Sir::FunctionExpression * {
			const auto *callbackArgument = arguments && arguments->size() > 0
				? arguments->Get(0)
				: nullptr;

			return callbackArgument ? callbackArgument->function_expression() : nullptr;
		};
		const auto indexAsNumber = [&](::llvm::Value *index) {
			return context.builder.CreateUIToFP(
				index,
				::llvm::Type::getDoubleTy(context.llvmContext),
				"array.callback.index"
			);
		};
		const auto lowerInlineCallback = [&](const Yogi::Sir::FunctionExpression *inlineCallback, const std::vector<std::pair<::llvm::Value *, const Yogi::Sir::TypeRef *>> &callbackArguments) -> ::llvm::Value * {
			auto *function = context.builder.GetInsertBlock()->getParent();
			auto previousLocals = context.locals;
			auto previousLocalTypes = context.localTypes;
			auto previousLocalTypeKinds = context.localTypeKinds;
			const auto *parameters = inlineCallback->parameters();
			auto *callbackReturnType = types.lower(inlineCallback->return_type());

			if (parameters) {
				for (flatbuffers::uoffset_t argumentIndex = 0; argumentIndex < parameters->size() && argumentIndex < callbackArguments.size(); ++argumentIndex) {
					const auto *parameter = parameters->Get(argumentIndex);
					auto *value = callbackArguments[argumentIndex].first;
					const auto *valueType = callbackArguments[argumentIndex].second;
					if (value && value->getType()->isPointerTy() && !types.lower(parameter->type())->isPointerTy()) {
						value = unboxAny(value, parameter->type());
					}
				auto *slotType = types.lower(parameter->type());
				auto *slot = context.createEntryAlloca(function, fbString(parameter->name()), slotType);
					context.builder.CreateStore(cast(value, slotType, parameter->type(), valueType), slot);
				context.locals[fbString(parameter->name())] = slot;
				context.localTypes[fbString(parameter->name())] = parameter->type();
				context.localTypeKinds[fbString(parameter->name())] = parameter->type()->kind();
				}
			}

			::llvm::Value *result = types.zero(callbackReturnType);
			const auto *statements = inlineCallback->body() ? inlineCallback->body()->statements() : nullptr;

			if (statements) {
				for (const auto *statement: *statements) {
					if (!statement) {
						continue;
					}

					if (const auto *variable = statement->value_as_VariableDeclaration()) {
						auto *type = types.lower(variable->type());
						auto *initializer = lower(variable->value(), type, variable->type());
						auto *slot = context.createEntryAlloca(function, fbString(variable->name()), type);
						context.builder.CreateStore(cast(initializer, type, variable->type(), variable->type()), slot);
						context.locals[fbString(variable->name())] = slot;
						context.localTypes[fbString(variable->name())] = variable->type();
						context.localTypeKinds[fbString(variable->name())] = variable->type()->kind();
						continue;
					}

					if (const auto *assignment = statement->value_as_AssignmentExpression()) {
						lowerAssignment(assignment);
						continue;
					}

					if (const auto *aggregateAssignment = statement->value_as_AggregateAssignmentExpression()) {
						lowerAggregateAssignment(aggregateAssignment);
						continue;
					}

					if (const auto *call = statement->value_as_CallExpression()) {
						lowerCall(call, types.lower(call->type()), call->type());
						continue;
					}

					if (const auto *binary = statement->value_as_BinaryExpression()) {
						lowerBinary(binary, types.lower(binary->type()), binary->type());
						continue;
					}

					if (const auto *conditional = statement->value_as_ConditionalExpression()) {
						lowerConditional(conditional, types.lower(conditional->type()), conditional->type());
						continue;
					}

					if (const auto *returnStatement = statement->value_as_ReturnStatement()) {
						result = returnStatement->value()
							? lower(returnStatement->value(), callbackReturnType, inlineCallback->return_type())
							: types.zero(callbackReturnType);
						break;
					}
				}
			}

			context.locals = previousLocals;
			context.localTypes = previousLocalTypes;
			context.localTypeKinds = previousLocalTypeKinds;

			return result;
		};
		const auto callCallback = [&](::llvm::Function *function, const Yogi::Sir::FunctionExpression *inlineCallback, const std::vector<std::pair<::llvm::Value *, const Yogi::Sir::TypeRef *>> &rawArguments) -> ::llvm::Value * {
			if (inlineCallback) {
				return lowerInlineCallback(inlineCallback, rawArguments);
			}

			std::vector<::llvm::Value *> callbackArguments;
			for (unsigned argumentIndex = 0; argumentIndex < function->arg_size() && argumentIndex < rawArguments.size(); ++argumentIndex) {
				auto *value = rawArguments[argumentIndex].first;
				const auto *valueType = rawArguments[argumentIndex].second;
				auto *parameterType = function->getFunctionType()->getParamType(argumentIndex);
				if (value && value->getType()->isPointerTy() && !parameterType->isPointerTy()) {
					value = unboxAny(value, valueType);
				}
				callbackArguments.push_back(cast(value, parameterType, valueType, valueType));
			}

			if (function->getReturnType()->isVoidTy()) {
				return context.builder.CreateCall(function, callbackArguments);
			}

			return context.builder.CreateCall(function, callbackArguments, "array.callback.result");
		};
		const auto createInsertArray = [&](flatbuffers::uoffset_t startIndex) -> ::llvm::Value * {
			const auto count = arguments && arguments->size() > startIndex
				? arguments->size() - startIndex
				: 0;
			auto *inserted = callRuntime(
				"yogi_array_create",
				opaquePointer(),
				{::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), count)}
			);

			if (arguments) {
				for (flatbuffers::uoffset_t index = startIndex; index < arguments->size(); ++index) {
					const auto *argument = arguments->Get(index);
					const auto *argumentSemanticType = valueSemanticType(argument);
					auto *argumentValue = lower(argument, types.lower(argumentSemanticType), argumentSemanticType);
					auto *boxedValue = boxAny(argumentValue, argumentSemanticType);
					callRuntime(
						"yogi_array_set",
						::llvm::Type::getVoidTy(context.llvmContext),
						{
							inserted,
							::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), index - startIndex),
							boxedValue,
						}
					);
				}
			}

			return inserted;
		};
		const auto createCallbackLoop = [&](const std::string &name, ::llvm::Value *array, const Yogi::Sir::TypeRef *elementType) {
			auto *function = context.builder.GetInsertBlock()->getParent();
			auto *condition = ::llvm::BasicBlock::Create(context.llvmContext, name + ".condition", function);
			auto *body = ::llvm::BasicBlock::Create(context.llvmContext, name + ".body", function);
			auto *after = ::llvm::BasicBlock::Create(context.llvmContext, name + ".after", function);
			auto *length = callRuntime("yogi_array_length", ::llvm::Type::getInt64Ty(context.llvmContext), {array});
			auto *zero = ::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), 0);

			context.builder.CreateBr(condition);
			context.builder.SetInsertPoint(condition);
			auto *index = context.builder.CreatePHI(::llvm::Type::getInt64Ty(context.llvmContext), 2, name + ".index");
			index->addIncoming(zero, condition->getSinglePredecessor());
			auto *inBounds = context.builder.CreateICmpULT(index, length, name + ".in.bounds");
			context.builder.CreateCondBr(inBounds, body, after);
			context.builder.SetInsertPoint(body);

			return std::tuple<::llvm::BasicBlock *, ::llvm::BasicBlock *, ::llvm::PHINode *, ::llvm::Value *>{
				condition,
				after,
				index,
				length
			};
		};
		const auto continueCallbackLoop = [&](::llvm::BasicBlock *condition, ::llvm::PHINode *index) {
			auto *one = ::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), 1);
			auto *nextIndex = context.builder.CreateAdd(index, one, "array.callback.next");
			auto *continueBlock = context.builder.GetInsertBlock();
			context.builder.CreateBr(condition);
			index->addIncoming(nextIndex, continueBlock);
		};
		const auto createReverseCallbackLoop = [&](const std::string &name, ::llvm::Value *array) {
			auto *function = context.builder.GetInsertBlock()->getParent();
			auto *condition = ::llvm::BasicBlock::Create(context.llvmContext, name + ".condition", function);
			auto *body = ::llvm::BasicBlock::Create(context.llvmContext, name + ".body", function);
			auto *after = ::llvm::BasicBlock::Create(context.llvmContext, name + ".after", function);
			auto *length = callRuntime("yogi_array_length", ::llvm::Type::getInt64Ty(context.llvmContext), {array});
			auto *one = ::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), 1);
			auto *start = context.builder.CreateSub(length, one, name + ".start");

			context.builder.CreateBr(condition);
			context.builder.SetInsertPoint(condition);
			auto *index = context.builder.CreatePHI(::llvm::Type::getInt64Ty(context.llvmContext), 2, name + ".index");
			index->addIncoming(start, condition->getSinglePredecessor());
			auto *inBounds = context.builder.CreateICmpULT(index, length, name + ".in.bounds");
			context.builder.CreateCondBr(inBounds, body, after);
			context.builder.SetInsertPoint(body);

			return std::tuple<::llvm::BasicBlock *, ::llvm::BasicBlock *, ::llvm::PHINode *, ::llvm::Value *>{
				condition,
				after,
				index,
				length
			};
		};
		const auto continueReverseCallbackLoop = [&](::llvm::BasicBlock *condition, ::llvm::PHINode *index) {
			auto *one = ::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), 1);
			auto *nextIndex = context.builder.CreateSub(index, one, "array.callback.previous");
			auto *continueBlock = context.builder.GetInsertBlock();
			context.builder.CreateBr(condition);
			index->addIncoming(nextIndex, continueBlock);
		};

		if (methodName == "push") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			const auto *argument = arguments && argumentCount > 0
				? arguments->Get(0)
				: nullptr;
			const auto *argumentSemanticType = valueSemanticType(argument);
			auto *argumentValue = lower(argument, types.lower(argumentSemanticType), argumentSemanticType);
			auto *boxedValue = boxAny(argumentValue, argumentSemanticType);
			auto *length = callRuntime(
				"yogi_array_push",
				::llvm::Type::getInt64Ty(context.llvmContext),
				{array, boxedValue}
			);
			auto *asNumber = context.builder.CreateUIToFP(
				length,
				::llvm::Type::getDoubleTy(context.llvmContext),
				"array.push.length"
			);

			return cast(
				asNumber,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "unshift") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *length = callRuntime("yogi_array_length", ::llvm::Type::getInt64Ty(context.llvmContext), {array});

			if (arguments) {
				for (auto index = arguments->size(); index > 0; --index) {
					const auto *argument = arguments->Get(index - 1);
					const auto *argumentSemanticType = valueSemanticType(argument);
					auto *argumentValue = lower(argument, types.lower(argumentSemanticType), argumentSemanticType);
					auto *boxedValue = boxAny(argumentValue, argumentSemanticType);
					length = callRuntime(
						"yogi_array_unshift",
						::llvm::Type::getInt64Ty(context.llvmContext),
						{array, boxedValue}
					);
				}
			}

			auto *asNumber = context.builder.CreateUIToFP(
				length,
				::llvm::Type::getDoubleTy(context.llvmContext),
				"array.unshift.length"
			);

			return cast(
				asNumber,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "pop") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *result = callRuntime(
				"yogi_array_pop",
				opaquePointer(),
				{array}
			);

			auto *targetType = expectedType ? expectedType : types.lower(call->type());
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : call->type();
			return cast(
				unboxArrayElement(result, targetType, targetSemanticType, call->type()),
				targetType,
				targetSemanticType,
				call->type()
			);
		}

		if (methodName == "shift") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *result = callRuntime(
				"yogi_array_shift",
				opaquePointer(),
				{array}
			);

			auto *targetType = expectedType ? expectedType : types.lower(call->type());
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : call->type();
			return cast(
				unboxArrayElement(result, targetType, targetSemanticType, call->type()),
				targetType,
				targetSemanticType,
				call->type()
			);
		}

		if (methodName == "at") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *argumentValue = lowerNumberArgument(0, 0);
			auto *result = callRuntime(
				"yogi_array_at_index",
				opaquePointer(),
				{array, argumentValue}
			);

			auto *targetType = expectedType ? expectedType : types.lower(call->type());
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : call->type();
			return cast(
				unboxArrayElement(result, targetType, targetSemanticType, call->type()),
				targetType,
				targetSemanticType,
				call->type()
			);
		}

		if (methodName == "includes" || methodName == "indexOf" || methodName == "lastIndexOf") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			const auto *argument = arguments && argumentCount > 0
				? arguments->Get(0)
				: nullptr;
			const auto *argumentSemanticType = valueSemanticType(argument);
			auto *argumentValue = lower(argument, types.lower(argumentSemanticType), argumentSemanticType);
			auto *boxedValue = boxAny(argumentValue, argumentSemanticType);
			auto *fromIndex = methodName == "lastIndexOf"
				? lowerNumberArgument(1, std::numeric_limits<double>::infinity())
				: lowerNumberArgument(1, 0);

			if (methodName == "includes") {
				auto *result = callRuntime(
					"yogi_array_includes",
					::llvm::Type::getInt1Ty(context.llvmContext),
					{array, boxedValue, fromIndex}
				);

				return cast(
					result,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			auto *result = callRuntime(
				methodName == "indexOf" ? "yogi_array_index_of" : "yogi_array_last_index_of",
				::llvm::Type::getInt64Ty(context.llvmContext),
				{array, boxedValue, fromIndex}
			);
			auto *asNumber = context.builder.CreateSIToFP(
				result,
				::llvm::Type::getDoubleTy(context.llvmContext),
				"array.search.index"
			);

			return cast(
				asNumber,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "concat") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *result = callRuntime("yogi_array_clone", opaquePointer(), {array});

			if (arguments) {
				for (flatbuffers::uoffset_t index = 0; index < arguments->size(); ++index) {
					const auto *argument = arguments->Get(index);
					const auto *argumentSemanticType = valueSemanticType(argument);
					const auto argumentKind = resolvedTypeKind(argumentSemanticType);

					if (
						argumentKind == Yogi::Sir::TypeKind_array_type ||
						argumentKind == Yogi::Sir::TypeKind_tuple_type
					) {
						auto *source = lower(argument, opaquePointer(), argumentSemanticType);
						callRuntime("yogi_array_append_array", ::llvm::Type::getVoidTy(context.llvmContext), {result, source});
						continue;
					}

					auto *argumentValue = lower(argument, types.lower(argumentSemanticType), argumentSemanticType);
					auto *boxedValue = boxAny(argumentValue, argumentSemanticType);
					callRuntime(
						"yogi_array_push",
						::llvm::Type::getInt64Ty(context.llvmContext),
						{result, boxedValue}
					);
				}
			}

			return cast(
				result,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "reverse") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			callRuntime("yogi_array_reverse", ::llvm::Type::getVoidTy(context.llvmContext), {array});

			return cast(
				array,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "fill") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			const auto *argument = arguments && argumentCount > 0
				? arguments->Get(0)
				: nullptr;
			const auto *argumentSemanticType = valueSemanticType(argument);
			auto *argumentValue = lower(argument, types.lower(argumentSemanticType), argumentSemanticType);
			auto *boxedValue = boxAny(argumentValue, argumentSemanticType);
			auto *start = lowerNumberArgument(1, 0);
			auto *end = lowerNumberArgument(2, std::numeric_limits<double>::infinity());

			callRuntime(
				"yogi_array_fill",
				::llvm::Type::getVoidTy(context.llvmContext),
				{array, boxedValue, start, end}
			);

			return cast(
				array,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "copyWithin") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *target = lowerNumberArgument(0, 0);
			auto *start = lowerNumberArgument(1, 0);
			auto *end = lowerNumberArgument(2, std::numeric_limits<double>::infinity());

			callRuntime(
				"yogi_array_copy_within",
				::llvm::Type::getVoidTy(context.llvmContext),
				{array, target, start, end}
			);

			return cast(
				array,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "splice" || methodName == "toSpliced") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *start = lowerNumberArgument(0, 0);
			auto *deleteCount = lowerNumberArgument(1, std::numeric_limits<double>::infinity());
			auto *inserted = createInsertArray(2);
			auto *result = callRuntime(
				methodName == "splice" ? "yogi_array_splice" : "yogi_array_to_spliced",
				opaquePointer(),
				{array, start, deleteCount, inserted}
			);
			callRuntime("yogi_array_destroy", ::llvm::Type::getVoidTy(context.llvmContext), {inserted});

			return cast(
				result,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "toReversed") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *result = callRuntime("yogi_array_to_reversed", opaquePointer(), {array});

			return cast(
				result,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "join" || methodName == "toString" || methodName == "toLocaleString") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));

			if (methodName == "join") {
				::llvm::Value *separator = nullptr;
				if (arguments && arguments->size() > 0) {
					const auto *argument = arguments->Get(0);
					separator = lower(argument, opaquePointer(), valueSemanticType(argument));
				} else {
					separator = context.builder.CreateGlobalString(",");
				}

				auto *result = callRuntime("yogi_array_join", opaquePointer(), {array, separator});
				return cast(
					result,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			auto *result = callRuntime("yogi_array_to_string", opaquePointer(), {array});
			return cast(
				result,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "sort" || methodName == "toSorted") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *targetArray = array;

			if (methodName == "toSorted") {
				targetArray = callRuntime("yogi_array_clone", opaquePointer(), {array});
			}

			if (arguments && arguments->size() > 0) {
				auto *callback = getCallbackFunction();
				const auto *inlineCallback = getInlineCallback();
				if (!callback && !inlineCallback) {
					return cast(
						targetArray,
						expectedType ? expectedType : types.lower(call->type()),
						expectedSemanticType ? expectedSemanticType : call->type(),
						call->type()
					);
				}

				const auto *arrayType = valueSemanticType(callee->object());
				const auto *elementType = arrayType && arrayType->element_type()
					? arrayType->element_type()
					: call->type();
				auto *length = callRuntime("yogi_array_length", ::llvm::Type::getInt64Ty(context.llvmContext), {targetArray});
				auto *function = context.builder.GetInsertBlock()->getParent();
				auto *outerCondition = ::llvm::BasicBlock::Create(context.llvmContext, "array.sort.outer.condition", function);
				auto *outerBody = ::llvm::BasicBlock::Create(context.llvmContext, "array.sort.outer.body", function);
				auto *innerCondition = ::llvm::BasicBlock::Create(context.llvmContext, "array.sort.inner.condition", function);
				auto *innerBody = ::llvm::BasicBlock::Create(context.llvmContext, "array.sort.inner.body", function);
				auto *swapBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.sort.swap", function);
				auto *innerContinue = ::llvm::BasicBlock::Create(context.llvmContext, "array.sort.inner.continue", function);
				auto *outerContinue = ::llvm::BasicBlock::Create(context.llvmContext, "array.sort.outer.continue", function);
				auto *after = ::llvm::BasicBlock::Create(context.llvmContext, "array.sort.after", function);
				auto *zero = ::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), 0);
				auto *one = ::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), 1);

				context.builder.CreateBr(outerCondition);
				context.builder.SetInsertPoint(outerCondition);
				auto *outerIndex = context.builder.CreatePHI(::llvm::Type::getInt64Ty(context.llvmContext), 2, "array.sort.i");
				outerIndex->addIncoming(zero, outerCondition->getSinglePredecessor());
				auto *outerInBounds = context.builder.CreateICmpULT(outerIndex, length, "array.sort.outer.in.bounds");
				context.builder.CreateCondBr(outerInBounds, outerBody, after);

				context.builder.SetInsertPoint(outerBody);
				context.builder.CreateBr(innerCondition);

				context.builder.SetInsertPoint(innerCondition);
				auto *innerIndex = context.builder.CreatePHI(::llvm::Type::getInt64Ty(context.llvmContext), 2, "array.sort.j");
				innerIndex->addIncoming(zero, outerBody);
				auto *nextInnerIndex = context.builder.CreateAdd(innerIndex, one, "array.sort.j.next");
				auto *innerInBounds = context.builder.CreateICmpULT(nextInnerIndex, length, "array.sort.inner.in.bounds");
				context.builder.CreateCondBr(innerInBounds, innerBody, outerContinue);

				context.builder.SetInsertPoint(innerBody);
				auto *leftBoxed = callRuntime("yogi_array_get", opaquePointer(), {targetArray, innerIndex});
				auto *rightBoxed = callRuntime("yogi_array_get", opaquePointer(), {targetArray, nextInnerIndex});
				auto *leftValue = unboxAny(leftBoxed, elementType);
				auto *rightValue = unboxAny(rightBoxed, elementType);
				auto *compareResult = callCallback(
					callback,
					inlineCallback,
					{
						{leftValue, elementType},
						{rightValue, elementType},
					}
				);
				auto *shouldSwap = context.builder.CreateFCmpOGT(
					toNumber(compareResult),
					::llvm::ConstantFP::get(::llvm::Type::getDoubleTy(context.llvmContext), 0.0),
					"array.sort.should.swap"
				);
				context.builder.CreateCondBr(shouldSwap, swapBlock, innerContinue);

				context.builder.SetInsertPoint(swapBlock);
				callRuntime("yogi_array_set", ::llvm::Type::getVoidTy(context.llvmContext), {targetArray, innerIndex, rightBoxed});
				callRuntime("yogi_array_set", ::llvm::Type::getVoidTy(context.llvmContext), {targetArray, nextInnerIndex, leftBoxed});
				context.builder.CreateBr(innerContinue);

				context.builder.SetInsertPoint(innerContinue);
				innerIndex->addIncoming(nextInnerIndex, innerContinue);
				context.builder.CreateBr(innerCondition);

				context.builder.SetInsertPoint(outerContinue);
				auto *outerNext = context.builder.CreateAdd(outerIndex, one, "array.sort.i.next");
				outerIndex->addIncoming(outerNext, outerContinue);
				context.builder.CreateBr(outerCondition);

				context.builder.SetInsertPoint(after);
				return cast(
					targetArray,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			if (methodName == "sort") {
				callRuntime("yogi_array_sort", ::llvm::Type::getVoidTy(context.llvmContext), {targetArray});
				return cast(
					targetArray,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			callRuntime("yogi_array_sort", ::llvm::Type::getVoidTy(context.llvmContext), {targetArray});
			return cast(
				targetArray,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "flat" || methodName == "keys" || methodName == "values" || methodName == "entries") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			::llvm::Value *result = nullptr;

			if (methodName == "flat") {
				auto *depth = toIndex(lowerNumberArgument(0, 1));
				result = callRuntime("yogi_array_flat", opaquePointer(), {array, depth});
			} else if (methodName == "keys") {
				result = callRuntime("yogi_array_keys", opaquePointer(), {array});
			} else if (methodName == "values") {
				result = callRuntime("yogi_array_values", opaquePointer(), {array});
			} else {
				result = callRuntime("yogi_array_entries", opaquePointer(), {array});
			}

			return cast(
				result,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "with") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *index = lowerNumberArgument(0, 0);
			const auto *argument = arguments && argumentCount > 1
				? arguments->Get(1)
				: nullptr;
			const auto *argumentSemanticType = valueSemanticType(argument);
			auto *argumentValue = lower(argument, types.lower(argumentSemanticType), argumentSemanticType);
			auto *boxedValue = boxAny(argumentValue, argumentSemanticType);
			auto *result = callRuntime("yogi_array_with", opaquePointer(), {array, index, boxedValue});

			return cast(
				result,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (
			methodName == "forEach" ||
			methodName == "map" ||
			methodName == "filter" ||
			methodName == "some" ||
			methodName == "every" ||
			methodName == "find" ||
			methodName == "findIndex" ||
			methodName == "findLast" ||
			methodName == "findLastIndex" ||
			methodName == "flatMap" ||
			methodName == "reduce" ||
			methodName == "reduceRight"
		) {
			auto *callback = getCallbackFunction();
			const auto *inlineCallback = getInlineCallback();
			if (!callback && !inlineCallback) {
				return types.zero(expectedType ? expectedType : types.lower(expectedSemanticType));
			}

			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			const auto *arrayType = valueSemanticType(callee->object());
			const auto *elementType = arrayType && arrayType->element_type()
				? arrayType->element_type()
				: call->type();
			auto *returnType = expectedType ? expectedType : types.lower(call->type());

			if (methodName == "map" || methodName == "filter" || methodName == "flatMap") {
				auto *result = callRuntime(
					"yogi_array_create",
					opaquePointer(),
					{::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), 0)}
				);
				auto [condition, after, index, _] = createCallbackLoop("array." + methodName, array, elementType);
				auto *boxedElement = callRuntime("yogi_array_get", opaquePointer(), {array, index});
				auto *element = unboxAny(boxedElement, elementType);
				auto *callbackResult = callCallback(
					callback,
					inlineCallback,
					{
						{element, elementType},
						{indexAsNumber(index), call->type()},
					}
				);

				if (methodName == "map") {
					const auto *mappedType = call->type() && call->type()->element_type()
						? call->type()->element_type()
						: nullptr;
					auto *boxedMapped = boxAny(callbackResult, mappedType);
					callRuntime("yogi_array_push", ::llvm::Type::getInt64Ty(context.llvmContext), {result, boxedMapped});
				} else if (methodName == "flatMap") {
					callRuntime("yogi_array_append_array", ::llvm::Type::getVoidTy(context.llvmContext), {result, callbackResult});
				} else {
					auto *keep = toBoolean(callbackResult);
					auto *pushBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.filter.push", context.builder.GetInsertBlock()->getParent());
					auto *continueBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.filter.continue", context.builder.GetInsertBlock()->getParent());
					context.builder.CreateCondBr(keep, pushBlock, continueBlock);
					context.builder.SetInsertPoint(pushBlock);
					callRuntime("yogi_array_push", ::llvm::Type::getInt64Ty(context.llvmContext), {result, boxedElement});
					context.builder.CreateBr(continueBlock);
					context.builder.SetInsertPoint(continueBlock);
				}

				continueCallbackLoop(condition, index);
				context.builder.SetInsertPoint(after);
				return cast(result, returnType, expectedSemanticType ? expectedSemanticType : call->type(), call->type());
			}

			if (methodName == "forEach") {
				auto [condition, after, index, _] = createCallbackLoop("array.forEach", array, elementType);
				auto *boxedElement = callRuntime("yogi_array_get", opaquePointer(), {array, index});
				auto *element = unboxAny(boxedElement, elementType);
				callCallback(
					callback,
					inlineCallback,
					{
						{element, elementType},
						{indexAsNumber(index), call->type()},
					}
				);
				continueCallbackLoop(condition, index);
				context.builder.SetInsertPoint(after);
				return types.zero(returnType);
			}

			if (methodName == "some" || methodName == "every") {
				auto [condition, after, index, _] = createCallbackLoop("array." + methodName, array, elementType);
				auto *boxedElement = callRuntime("yogi_array_get", opaquePointer(), {array, index});
				auto *element = unboxAny(boxedElement, elementType);
				auto *callbackResult = callCallback(
					callback,
					inlineCallback,
					{
						{element, elementType},
						{indexAsNumber(index), call->type()},
					}
				);
				auto *predicate = toBoolean(callbackResult);
				auto *foundBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array." + methodName + ".short", context.builder.GetInsertBlock()->getParent());
				auto *continueBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array." + methodName + ".continue", context.builder.GetInsertBlock()->getParent());

				if (methodName == "some") {
					context.builder.CreateCondBr(predicate, foundBlock, continueBlock);
				} else {
					context.builder.CreateCondBr(predicate, continueBlock, foundBlock);
				}

				context.builder.SetInsertPoint(foundBlock);
				auto *shortValue = ::llvm::ConstantInt::get(::llvm::Type::getInt1Ty(context.llvmContext), methodName == "some");
				context.builder.CreateBr(after);
				auto *shortBlock = context.builder.GetInsertBlock();

				context.builder.SetInsertPoint(continueBlock);
				continueCallbackLoop(condition, index);

				context.builder.SetInsertPoint(after);
				auto *result = context.builder.CreatePHI(::llvm::Type::getInt1Ty(context.llvmContext), 2, "array.callback.boolean");
				result->addIncoming(::llvm::ConstantInt::get(::llvm::Type::getInt1Ty(context.llvmContext), methodName == "every"), condition);
				result->addIncoming(shortValue, shortBlock);
				return cast(result, returnType, expectedSemanticType ? expectedSemanticType : call->type(), call->type());
			}

			if (methodName == "find" || methodName == "findIndex" || methodName == "findLast" || methodName == "findLastIndex") {
				const auto returnsIndex = methodName == "findIndex" || methodName == "findLastIndex";
				const auto reverseSearch = methodName == "findLast" || methodName == "findLastIndex";
				auto *defaultFindValue = !returnsIndex
					? callRuntime("yogi_any_undefined", opaquePointer(), {})
					: nullptr;
				auto [condition, after, index, _] = reverseSearch
					? createReverseCallbackLoop("array." + methodName, array)
					: createCallbackLoop("array." + methodName, array, elementType);
				auto *boxedElement = callRuntime("yogi_array_get", opaquePointer(), {array, index});
				auto *element = unboxAny(boxedElement, elementType);
				auto *callbackResult = callCallback(
					callback,
					inlineCallback,
					{
						{element, elementType},
						{indexAsNumber(index), call->type()},
					}
				);
				auto *predicate = toBoolean(callbackResult);
				auto *foundBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array." + methodName + ".found", context.builder.GetInsertBlock()->getParent());
				auto *continueBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array." + methodName + ".continue", context.builder.GetInsertBlock()->getParent());
				context.builder.CreateCondBr(predicate, foundBlock, continueBlock);

				context.builder.SetInsertPoint(foundBlock);
				::llvm::Value *foundValue = boxedElement;
				if (returnsIndex) {
					foundValue = context.builder.CreateUIToFP(
						index,
						::llvm::Type::getDoubleTy(context.llvmContext),
						"array.findIndex.value"
					);
				}
				context.builder.CreateBr(after);
				auto *foundIncoming = context.builder.GetInsertBlock();

				context.builder.SetInsertPoint(continueBlock);
				if (reverseSearch) {
					continueReverseCallbackLoop(condition, index);
				} else {
					continueCallbackLoop(condition, index);
				}

				context.builder.SetInsertPoint(after);
				if (returnsIndex) {
					auto *result = context.builder.CreatePHI(::llvm::Type::getDoubleTy(context.llvmContext), 2, "array.findIndex.result");
					result->addIncoming(numberConstant(-1), condition);
					result->addIncoming(foundValue, foundIncoming);
					return cast(result, returnType, expectedSemanticType ? expectedSemanticType : call->type(), call->type());
				}

				auto *result = context.builder.CreatePHI(opaquePointer(), 2, "array.find.result");
				result->addIncoming(defaultFindValue, condition);
				result->addIncoming(foundValue, foundIncoming);
				const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : call->type();
				return cast(
					unboxArrayElement(result, returnType, targetSemanticType, call->type()),
					returnType,
					targetSemanticType,
					call->type()
				);
			}

			if (methodName == "reduce" || methodName == "reduceRight") {
				const auto reverseReduce = methodName == "reduceRight";
				const auto hasInitialValue = arguments && arguments->size() > 1;
				const auto *accumulatorType = call->type();
				auto *length = callRuntime("yogi_array_length", ::llvm::Type::getInt64Ty(context.llvmContext), {array});
				auto *one = ::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), 1);
				auto *startIndex = reverseReduce
					? context.builder.CreateSub(length, one, "array.reduceRight.start")
					: ::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), 0);
				::llvm::Value *initialAccumulator = nullptr;

				if (hasInitialValue) {
					const auto *initialValue = arguments->Get(1);
					const auto *initialType = valueSemanticType(initialValue);
					initialAccumulator = lower(initialValue, types.lower(initialType), initialType);
				} else {
					auto *initialBoxed = callRuntime("yogi_array_get", opaquePointer(), {array, startIndex});
					initialAccumulator = unboxAny(initialBoxed, accumulatorType);
					startIndex = reverseReduce
						? context.builder.CreateSub(startIndex, one, "array.reduceRight.previous.start")
						: context.builder.CreateAdd(startIndex, one, "array.reduce.next.start");
				}

				auto *function = context.builder.GetInsertBlock()->getParent();
				auto *condition = ::llvm::BasicBlock::Create(context.llvmContext, "array." + methodName + ".condition", function);
				auto *body = ::llvm::BasicBlock::Create(context.llvmContext, "array." + methodName + ".body", function);
				auto *after = ::llvm::BasicBlock::Create(context.llvmContext, "array." + methodName + ".after", function);

				context.builder.CreateBr(condition);
				context.builder.SetInsertPoint(condition);
				auto *index = context.builder.CreatePHI(::llvm::Type::getInt64Ty(context.llvmContext), 2, "array." + methodName + ".index");
				auto *accumulator = context.builder.CreatePHI(types.lower(accumulatorType), 2, "array." + methodName + ".accumulator");
				index->addIncoming(startIndex, condition->getSinglePredecessor());
				accumulator->addIncoming(cast(initialAccumulator, types.lower(accumulatorType), accumulatorType, accumulatorType), condition->getSinglePredecessor());
				auto *inBounds = context.builder.CreateICmpULT(index, length, "array." + methodName + ".in.bounds");
				context.builder.CreateCondBr(inBounds, body, after);

				context.builder.SetInsertPoint(body);
				auto *boxedElement = callRuntime("yogi_array_get", opaquePointer(), {array, index});
				auto *element = unboxAny(boxedElement, elementType);
				auto *nextAccumulator = callCallback(
					callback,
					inlineCallback,
					{
						{accumulator, accumulatorType},
						{element, elementType},
						{indexAsNumber(index), accumulatorType},
					}
				);
				auto *nextIndex = reverseReduce
					? context.builder.CreateSub(index, one, "array.reduce.previous")
					: context.builder.CreateAdd(index, one, "array.reduce.next");
				auto *bodyBlock = context.builder.GetInsertBlock();
				context.builder.CreateBr(condition);
				index->addIncoming(nextIndex, bodyBlock);
				accumulator->addIncoming(cast(nextAccumulator, types.lower(accumulatorType), accumulatorType, accumulatorType), bodyBlock);

				context.builder.SetInsertPoint(after);
				return cast(accumulator, returnType, expectedSemanticType ? expectedSemanticType : call->type(), call->type());
			}
		}

		if (methodName == "slice") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *start = lowerNumberArgument(0, 0);
			auto *end = lowerNumberArgument(1, std::numeric_limits<double>::infinity());
			auto *result = callRuntime(
				"yogi_array_slice",
				opaquePointer(),
				{array, start, end}
			);

			return cast(
				result,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		return types.zero(expectedType ? expectedType : types.lower(expectedSemanticType));
	}

	::llvm::Value *ValueLowerer::lowerConstant(
		const Yogi::Sir::Constant *constant,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		if (const auto *number = constant->value_as_NumberConstant()) {
			auto *value = ::llvm::ConstantFP::get(::llvm::Type::getDoubleTy(context.llvmContext), number->value());
			return cast(value, expectedType, expectedSemanticType, constant->type());
		}

		if (const auto *string = constant->value_as_StringConstant()) {
			auto *value = context.builder.CreateGlobalString(fbString(string->value()));
			return cast(value, expectedType, expectedSemanticType, constant->type());
		}

		if (const auto *boolean = constant->value_as_BooleanConstant()) {
			auto *value = ::llvm::ConstantInt::get(::llvm::Type::getInt1Ty(context.llvmContext), boolean->value());
			return cast(value, expectedType, expectedSemanticType, constant->type());
		}

		if (constant->value_as_NullConstant() || constant->value_as_UndefinedConstant()) {
			if (isAnyType(expectedSemanticType)) {
				return boxAny(nullptr, constant->type());
			}

			return types.zero(expectedType);
		}

		return types.zero(expectedType);
	}

	::llvm::Value *ValueLowerer::lowerIdentifier(
		const Yogi::Sir::IdentifierExpression *identifier,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto name = fbString(identifier->name());
		const auto identifierTypeKind = identifier->type()
			? identifier->type()->kind()
			: Yogi::Sir::TypeKind_unknown_type;
		const auto loadValue = [&](::llvm::Value *loaded, Yogi::Sir::TypeKind storedType) -> ::llvm::Value * {
			if (
				storedType == Yogi::Sir::TypeKind_any_type &&
				expectedSemanticType &&
				!isAnyType(expectedSemanticType)
			) {
				return unboxAny(loaded, expectedSemanticType);
			}

			return cast(loaded, expectedType, expectedSemanticType, identifier->type());
		};

		if (context.locals.contains(name)) {
			auto *slot = context.locals[name];
			auto *loaded = context.builder.CreateLoad(slot->getAllocatedType(), slot, sanitizeSymbol(name) + ".load");
			const auto type = context.localTypeKinds.contains(name)
				? context.localTypeKinds[name]
				: identifierTypeKind;
			return loadValue(loaded, type);
		}

		if (context.globals.contains(name)) {
			auto *global = context.globals[name];
			auto *loaded = context.builder.CreateLoad(global->getValueType(), global, sanitizeSymbol(name) + ".load");
			const auto type = context.globalTypeKinds.contains(name)
				? context.globalTypeKinds[name]
				: identifierTypeKind;
			return loadValue(loaded, type);
		}

		const auto qualifiedName = fbString(identifier->qualified_name());

		if (!qualifiedName.empty()) {
			const auto symbolName = "_yogi_" + sanitizeSymbol(qualifiedName);
			auto *global = context.module->getGlobalVariable(symbolName);

			if (!global) {
				auto *type = types.lower(identifier->type());
				global = new ::llvm::GlobalVariable(
					*context.module,
					type,
					false,
					::llvm::GlobalValue::ExternalLinkage,
					nullptr,
					symbolName
				);
			}

			context.globals[name] = global;
			context.globalTypes[name] = identifier->type();
			context.globalTypeKinds[name] = identifierTypeKind;
			auto *loaded = context.builder.CreateLoad(global->getValueType(), global, sanitizeSymbol(name) + ".load");
			return loadValue(loaded, identifierTypeKind);
		}

		return types.zero(expectedType);
	}

	::llvm::Value *ValueLowerer::lowerArray(
		const Yogi::Sir::ArrayExpression *array,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto length = array->elements() ? array->elements()->size() : 0;
		context.pushMemorySourceLocation(array->position());
		auto *aggregate = callRuntime(
			"yogi_array_create",
			opaquePointer(),
			{::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), length)}
		);

		populateArray(array, aggregate);
		context.popMemorySourceLocation();

		return cast(aggregate, expectedType ? expectedType : opaquePointer(), expectedSemanticType, array->type());
	}

	::llvm::Value *ValueLowerer::lowerObject(
		const Yogi::Sir::ObjectExpression *object,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		context.pushMemorySourceLocation(object->position());
		auto *aggregate = callRuntime("yogi_object_create", opaquePointer(), {});

		populateObject(object, aggregate);
		context.popMemorySourceLocation();

		return cast(aggregate, expectedType ? expectedType : opaquePointer(), expectedSemanticType, object->type());
	}

	bool ValueLowerer::isAggregateLiteral(const Yogi::Sir::ValueRef *value) const {
		return value && (value->array() || value->object());
	}

	::llvm::Value *ValueLowerer::lowerLocalAggregate(
		const Yogi::Sir::ValueRef *value,
		const std::string &name
	) {
		if (!value) {
			return ::llvm::ConstantPointerNull::get(opaquePointer());
		}

		const auto safeName = sanitizeSymbol(name);

		if (const auto *array = value->array()) {
			const auto length = array->elements() ? array->elements()->size() : 0;
			context.pushMemorySourceLocation(array->position());
			auto *size = callRuntime("yogi_array_sizeof", ::llvm::Type::getInt64Ty(context.llvmContext), {});
			auto *storage = context.builder.CreateAlloca(
				::llvm::Type::getInt8Ty(context.llvmContext),
				size,
				safeName + ".array.storage"
			);

			callRuntime(
				"yogi_array_init",
				::llvm::Type::getVoidTy(context.llvmContext),
				{
					storage,
					::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), length),
				}
			);
			populateArray(array, storage);
			context.popMemorySourceLocation();

			return storage;
		}

		if (const auto *object = value->object()) {
			context.pushMemorySourceLocation(object->position());
			auto *size = callRuntime("yogi_object_sizeof", ::llvm::Type::getInt64Ty(context.llvmContext), {});
			auto *storage = context.builder.CreateAlloca(
				::llvm::Type::getInt8Ty(context.llvmContext),
				size,
				safeName + ".object.storage"
			);

			callRuntime("yogi_object_init", ::llvm::Type::getVoidTy(context.llvmContext), {storage});
			populateObject(object, storage);
			context.popMemorySourceLocation();

			return storage;
		}

		return lower(value, opaquePointer(), valueSemanticType(value));
	}

	void ValueLowerer::dropLocalAggregate(const Yogi::Sir::TypeRef *type, ::llvm::Value *value) {
		if (!type || !value) {
			return;
		}

		switch (resolvedTypeKind(type)) {
			case Yogi::Sir::TypeKind_array_type:
			case Yogi::Sir::TypeKind_tuple_type:
				callRuntime("yogi_array_drop", ::llvm::Type::getVoidTy(context.llvmContext), {value});
				return;

			case Yogi::Sir::TypeKind_type_literal:
			case Yogi::Sir::TypeKind_type_reference:
				callRuntime("yogi_object_drop", ::llvm::Type::getVoidTy(context.llvmContext), {value});
				return;

			default:
				return;
		}
	}

	void ValueLowerer::destroyEscapedAggregate(const Yogi::Sir::TypeRef *type, ::llvm::Value *value) {
		if (!type || !value) {
			return;
		}

		switch (resolvedTypeKind(type)) {
			case Yogi::Sir::TypeKind_array_type:
			case Yogi::Sir::TypeKind_tuple_type:
				callRuntime("yogi_array_destroy", ::llvm::Type::getVoidTy(context.llvmContext), {value});
				return;

			case Yogi::Sir::TypeKind_type_literal:
			case Yogi::Sir::TypeKind_type_reference:
				callRuntime("yogi_object_destroy", ::llvm::Type::getVoidTy(context.llvmContext), {value});
				return;

			default:
				return;
		}
	}

	void ValueLowerer::populateArray(const Yogi::Sir::ArrayExpression *array, ::llvm::Value *aggregate) {
		if (array->elements()) {
			for (flatbuffers::uoffset_t index = 0; index < array->elements()->size(); ++index) {
				const auto *element = array->elements()->Get(index);
				const auto *elementType = valueSemanticType(element);
				auto *elementValue = lower(element, types.lower(elementType), elementType);
				auto *boxedValue = boxAny(elementValue, elementType);

				callRuntime(
					"yogi_array_set",
					::llvm::Type::getVoidTy(context.llvmContext),
					{
						aggregate,
						::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), index),
						boxedValue,
					}
				);
			}
		}
	}

	void ValueLowerer::populateObject(const Yogi::Sir::ObjectExpression *object, ::llvm::Value *aggregate) {
		if (object->properties()) {
			for (const auto *property: *object->properties()) {
				const auto *propertyType = property->type();
				auto *value = lower(property->value(), types.lower(propertyType), propertyType);
				auto *boxedValue = boxAny(value, propertyType);
				auto *key = context.builder.CreateGlobalString(fbString(property->key()));

				callRuntime(
					"yogi_object_set",
					::llvm::Type::getVoidTy(context.llvmContext),
					{aggregate, key, boxedValue}
				);
			}
		}
	}

	::llvm::Value *ValueLowerer::lowerPropertyAccess(
		const Yogi::Sir::PropertyAccessExpression *access,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto propertyName = fbString(access->property());
		const auto *objectSemanticType = valueSemanticType(access->object());
		const auto objectKind = resolvedTypeKind(objectSemanticType);

		if (
			propertyName == "length" &&
			(objectKind == Yogi::Sir::TypeKind_array_type || objectKind == Yogi::Sir::TypeKind_tuple_type)
		) {
			auto *array = lower(access->object(), opaquePointer(), objectSemanticType);
			auto *length = callRuntime("yogi_array_length", ::llvm::Type::getInt64Ty(context.llvmContext), {array});
			auto *asNumber = context.builder.CreateUIToFP(
				length,
				::llvm::Type::getDoubleTy(context.llvmContext),
				"array.length"
			);
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
			auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

			return cast(asNumber, targetType, targetSemanticType, access->type());
		}

		if (propertyName == "length" && objectKind == Yogi::Sir::TypeKind_string_type) {
			auto *text = lower(access->object(), opaquePointer(), objectSemanticType);
			auto *length = callRuntime("yogi_string_length", ::llvm::Type::getInt64Ty(context.llvmContext), {text});
			auto *asNumber = context.builder.CreateUIToFP(
				length,
				::llvm::Type::getDoubleTy(context.llvmContext),
				"string.length"
			);
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
			auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

			return cast(asNumber, targetType, targetSemanticType, access->type());
		}

		auto *object = lower(access->object(), opaquePointer(), valueSemanticType(access->object()));
		auto *property = context.builder.CreateGlobalString(propertyName);
		auto *boxedValue = callRuntime("yogi_object_get", opaquePointer(), {object, property});
		const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
		auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

		return cast(unboxAny(boxedValue, targetSemanticType), targetType, targetSemanticType, targetSemanticType);
	}

	::llvm::Value *ValueLowerer::lowerElementAccess(
		const Yogi::Sir::ElementAccessExpression *access,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto *objectSemanticType = valueSemanticType(access->object());
		const auto objectKind = resolvedTypeKind(objectSemanticType);
		if (objectKind == Yogi::Sir::TypeKind_string_type) {
			auto *text = lower(access->object(), opaquePointer(), objectSemanticType);
			auto *indexValue = lower(access->index(), ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(access->index()));
			auto *character = callRuntime("yogi_string_at", opaquePointer(), {text, toIndex(indexValue)});
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
			auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

			return cast(character, targetType, targetSemanticType, targetSemanticType);
		}

		auto *array = lower(access->object(), opaquePointer(), objectSemanticType);
		auto *indexValue = lower(access->index(), ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(access->index()));
		auto *boxedValue = callRuntime("yogi_array_get", opaquePointer(), {array, toIndex(indexValue)});
		const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
		auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

		return cast(unboxAny(boxedValue, targetSemanticType), targetType, targetSemanticType, targetSemanticType);
	}

	::llvm::Value *ValueLowerer::lowerAggregateAssignment(
		const Yogi::Sir::AggregateAssignmentExpression *assignment
	) {
		const auto *target = assignment->target();
		const auto *rightType = valueSemanticType(assignment->right());
		auto *rightValue = lower(assignment->right(), types.lower(rightType), rightType);
		auto *boxedValue = boxAny(rightValue, rightType);

		if (const auto *property = target ? target->property_access() : nullptr) {
			auto *object = lower(property->object(), opaquePointer(), valueSemanticType(property->object()));
			auto *key = context.builder.CreateGlobalString(fbString(property->property()));
			callRuntime("yogi_object_set", ::llvm::Type::getVoidTy(context.llvmContext), {object, key, boxedValue});
			const auto objectName = identifierName(property->object());
			const auto rightName = identifierName(assignment->right());

			if (!objectName.empty() && context.globals.contains(objectName) && !rightName.empty()) {
				context.deactivateAggregateOwner(rightName);
			}

			return cast(rightValue, types.lower(property->type()), property->type(), rightType);
		}

		if (const auto *element = target ? target->element_access() : nullptr) {
			auto *array = lower(element->object(), opaquePointer(), valueSemanticType(element->object()));
			auto *indexValue = lower(element->index(), ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(element->index()));
			callRuntime("yogi_array_set", ::llvm::Type::getVoidTy(context.llvmContext), {array, toIndex(indexValue), boxedValue});
			const auto objectName = identifierName(element->object());
			const auto rightName = identifierName(assignment->right());

			if (!objectName.empty() && context.globals.contains(objectName) && !rightName.empty()) {
				context.deactivateAggregateOwner(rightName);
			}

			return cast(rightValue, types.lower(element->type()), element->type(), rightType);
		}

		return types.zero(types.lower(assignment->type()));
	}

	::llvm::Value *ValueLowerer::lowerAssignment(const Yogi::Sir::AssignmentExpression *assignment) {
		const auto name = fbString(assignment->left()->name());
		::llvm::Type *targetType = types.lower(assignment->type());
		const Yogi::Sir::TypeRef *targetSemanticType = assignment->type();
		::llvm::Value *target = nullptr;
		bool targetIsGlobal = false;

		if (context.locals.contains(name)) {
			target = context.locals[name];
			targetType = context.locals[name]->getAllocatedType();
			if (context.localTypes.contains(name)) {
				targetSemanticType = context.localTypes[name];
			}
		} else if (context.globals.contains(name)) {
			targetIsGlobal = true;
			target = context.globals[name];
			targetType = context.globals[name]->getValueType();
			if (context.globalTypes.contains(name)) {
				targetSemanticType = context.globalTypes[name];
			}
		}

		if (!target) {
			return types.zero(targetType);
		}

		auto *value = cast(
			lower(assignment->right(), targetType, targetSemanticType),
			targetType,
			targetSemanticType,
			targetSemanticType
		);

		const auto targetKind = resolvedTypeKind(targetSemanticType);
		const auto targetIsAggregate =
			targetKind == Yogi::Sir::TypeKind_array_type ||
			targetKind == Yogi::Sir::TypeKind_tuple_type ||
			targetKind == Yogi::Sir::TypeKind_type_literal ||
			targetKind == Yogi::Sir::TypeKind_type_reference;

		if (targetIsGlobal && targetIsAggregate && targetType->isPointerTy()) {
			auto *previousValue = context.builder.CreateLoad(
				targetType,
				target,
				sanitizeSymbol(name) + ".global.previous"
			);
			auto *hasPrevious = context.builder.CreateIsNotNull(previousValue);
			auto *isReplacement = context.builder.CreateICmpNE(previousValue, value);
			auto *shouldDestroyPrevious = context.builder.CreateAnd(
				hasPrevious,
				isReplacement,
				sanitizeSymbol(name) + ".global.should_destroy"
			);
			auto *currentBlock = context.builder.GetInsertBlock();
			auto *function = currentBlock->getParent();
			auto *destroyBlock = ::llvm::BasicBlock::Create(
				context.llvmContext,
				sanitizeSymbol(name) + ".global.replace.destroy",
				function
			);
			auto *storeBlock = ::llvm::BasicBlock::Create(
				context.llvmContext,
				sanitizeSymbol(name) + ".global.replace.store",
				function
			);

			context.builder.CreateCondBr(shouldDestroyPrevious, destroyBlock, storeBlock);
			context.builder.SetInsertPoint(destroyBlock);
			destroyEscapedAggregate(targetSemanticType, previousValue);
			context.builder.CreateBr(storeBlock);
			context.builder.SetInsertPoint(storeBlock);
		}

		context.builder.CreateStore(value, target);

		if (targetIsGlobal) {
			const auto rightName = identifierName(assignment->right());
			if (!rightName.empty()) {
				context.deactivateAggregateOwner(rightName);
			}
		} else if (const auto *rightIdentifier = assignment->right() ? assignment->right()->identifier() : nullptr) {
			context.aliasAggregateOwner(name, fbString(rightIdentifier->name()));
		}

		return value;
	}

	::llvm::Value *ValueLowerer::lowerBinary(
		const Yogi::Sir::BinaryExpression *binary,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto op = fbString(binary->operator_());

		if (op == "??") {
			return lowerNullish(binary, expectedType, expectedSemanticType);
		}

		if (op == std::string("?") + "?=") {
			return lowerNullishAssignment(binary, expectedType, expectedSemanticType);
		}

		const auto *leftSemanticType = valueSemanticType(binary->left());
		const auto *rightSemanticType = valueSemanticType(binary->right());

		auto *left = lower(binary->left(), types.lower(leftSemanticType), leftSemanticType);
		auto *right = lower(binary->right(), types.lower(rightSemanticType), rightSemanticType);

		if (op == "+" && resolvedTypeKind(binary->type()) == Yogi::Sir::TypeKind_string_type) {
			return callRuntime(
				"yogi_string_concat",
				opaquePointer(),
				{toStringValue(left, leftSemanticType), toStringValue(right, rightSemanticType)}
			);
		}

		if (op == "+") return context.builder.CreateFAdd(toNumber(left), toNumber(right), "addtmp");
		if (op == "-") return context.builder.CreateFSub(toNumber(left), toNumber(right), "subtmp");
		if (op == "*") return context.builder.CreateFMul(toNumber(left), toNumber(right), "multmp");
		if (op == "/") return context.builder.CreateFDiv(toNumber(left), toNumber(right), "divtmp");
		if (op == "%") return context.builder.CreateFRem(toNumber(left), toNumber(right), "modtmp");

		if (op == "<") return context.builder.CreateFCmpOLT(toNumber(left), toNumber(right), "cmptmp");
		if (op == "<=") return context.builder.CreateFCmpOLE(toNumber(left), toNumber(right), "cmptmp");
		if (op == ">") return context.builder.CreateFCmpOGT(toNumber(left), toNumber(right), "cmptmp");
		if (op == ">=") return context.builder.CreateFCmpOGE(toNumber(left), toNumber(right), "cmptmp");

		if (op == "&&") return context.builder.CreateAnd(toBoolean(left), toBoolean(right), "andtmp");
		if (op == "||") return context.builder.CreateOr(toBoolean(left), toBoolean(right), "ortmp");

		if (op == "==" || op == "===") {
			return compare(left, right, true);
		}

		if (op == "!=" || op == "!==") {
			return compare(left, right, false);
		}

		return types.zero(expectedType ? expectedType : types.lower(expectedSemanticType));
	}

	::llvm::Value *ValueLowerer::lowerConditional(
		const Yogi::Sir::ConditionalExpression *conditional,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		auto *resultType = expectedType ? expectedType : types.lower(conditional->type());
		const auto *resultSemanticType = expectedSemanticType ? expectedSemanticType : conditional->type();
		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *condition = toBoolean(lower(
			conditional->condition(),
			::llvm::Type::getInt1Ty(context.llvmContext),
			valueSemanticType(conditional->condition())
		));

		auto *thenBlock = ::llvm::BasicBlock::Create(context.llvmContext, "cond.then", function);
		auto *elseBlock = ::llvm::BasicBlock::Create(context.llvmContext, "cond.else", function);
		auto *mergeBlock = ::llvm::BasicBlock::Create(context.llvmContext, "cond.end", function);

		context.builder.CreateCondBr(condition, thenBlock, elseBlock);

		context.builder.SetInsertPoint(thenBlock);
		auto *thenValue = cast(
			lower(conditional->when_true(), resultType, resultSemanticType),
			resultType,
			resultSemanticType,
			valueSemanticType(conditional->when_true())
		);
		auto *thenEnd = context.builder.GetInsertBlock();
		if (!thenEnd->hasTerminator()) {
			context.builder.CreateBr(mergeBlock);
		}

		context.builder.SetInsertPoint(elseBlock);
		auto *elseValue = cast(
			lower(conditional->when_false(), resultType, resultSemanticType),
			resultType,
			resultSemanticType,
			valueSemanticType(conditional->when_false())
		);
		auto *elseEnd = context.builder.GetInsertBlock();
		if (!elseEnd->hasTerminator()) {
			context.builder.CreateBr(mergeBlock);
		}

		context.builder.SetInsertPoint(mergeBlock);
		auto *phi = context.builder.CreatePHI(resultType, 2, "condtmp");
		phi->addIncoming(thenValue, thenEnd);
		phi->addIncoming(elseValue, elseEnd);

		return phi;
	}

	::llvm::Value *ValueLowerer::lowerNullish(
		const Yogi::Sir::BinaryExpression *binary,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		auto *resultType = expectedType ? expectedType : types.lower(binary->type());
		const auto *resultSemanticType = expectedSemanticType ? expectedSemanticType : binary->type();
		const auto *leftSemanticType = valueSemanticType(binary->left());
		auto *leftStorageType = types.lower(leftSemanticType);
		auto *leftValue = lower(binary->left(), leftStorageType, leftSemanticType);
		const bool leftIsAggregateAccess = binary->left() && (binary->left()->property_access() || binary->left()->element_access());
		auto *nullish = leftIsAggregateAccess
			? callRuntime("yogi_any_is_nullish", ::llvm::Type::getInt1Ty(context.llvmContext), {leftValue})
			: isNullish(leftValue);
		auto *hasValue = context.builder.CreateNot(nullish, "nullish.has_value");
		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *presentBlock = ::llvm::BasicBlock::Create(context.llvmContext, "nullish.present", function);
		auto *fallbackBlock = ::llvm::BasicBlock::Create(context.llvmContext, "nullish.fallback", function);
		auto *mergeBlock = ::llvm::BasicBlock::Create(context.llvmContext, "nullish.end", function);

		context.builder.CreateCondBr(hasValue, presentBlock, fallbackBlock);

		context.builder.SetInsertPoint(presentBlock);
		auto *presentRawValue = leftIsAggregateAccess
			? unboxAny(leftValue, resultSemanticType)
			: leftValue;
		auto *presentValue = cast(presentRawValue, resultType, resultSemanticType, leftSemanticType);
		auto *presentEnd = context.builder.GetInsertBlock();
		context.builder.CreateBr(mergeBlock);

		context.builder.SetInsertPoint(fallbackBlock);
		auto *fallbackValue = cast(
			lower(binary->right(), resultType, resultSemanticType),
			resultType,
			resultSemanticType,
			valueSemanticType(binary->right())
		);
		auto *fallbackEnd = context.builder.GetInsertBlock();
		context.builder.CreateBr(mergeBlock);

		context.builder.SetInsertPoint(mergeBlock);
		auto *phi = context.builder.CreatePHI(resultType, 2, "nullishtmp");
		phi->addIncoming(presentValue, presentEnd);
		phi->addIncoming(fallbackValue, fallbackEnd);

		return phi;
	}

	::llvm::Value *ValueLowerer::lowerNullishAssignment(
		const Yogi::Sir::BinaryExpression *binary,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto *identifier = binary->left() ? binary->left()->identifier() : nullptr;

		if (!identifier) {
			return types.zero(expectedType ? expectedType : types.lower(expectedSemanticType));
		}

		const auto name = fbString(identifier->name());
		::llvm::Value *target = nullptr;
		::llvm::Type *targetType = nullptr;
		const Yogi::Sir::TypeRef *targetSemanticType = identifier->type();

		if (context.locals.contains(name)) {
			target = context.locals[name];
			targetType = context.locals[name]->getAllocatedType();
			if (context.localTypes.contains(name)) {
				targetSemanticType = context.localTypes[name];
			}
		} else if (context.globals.contains(name)) {
			target = context.globals[name];
			targetType = context.globals[name]->getValueType();
			if (context.globalTypes.contains(name)) {
				targetSemanticType = context.globalTypes[name];
			}
		}

		if (!target || !targetType) {
			return types.zero(expectedType ? expectedType : types.lower(expectedSemanticType));
		}

		auto *currentValue = context.builder.CreateLoad(targetType, target, sanitizeSymbol(name) + ".nullish.load");
		auto *hasValue = context.builder.CreateNot(isNullish(currentValue), "nullishassign.has_value");
		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *presentBlock = ::llvm::BasicBlock::Create(context.llvmContext, "nullishassign.present", function);
		auto *assignBlock = ::llvm::BasicBlock::Create(context.llvmContext, "nullishassign.assign", function);
		auto *mergeBlock = ::llvm::BasicBlock::Create(context.llvmContext, "nullishassign.end", function);

		context.builder.CreateCondBr(hasValue, presentBlock, assignBlock);

		context.builder.SetInsertPoint(presentBlock);
		auto *presentValue = currentValue;
		auto *presentEnd = context.builder.GetInsertBlock();
		context.builder.CreateBr(mergeBlock);

		context.builder.SetInsertPoint(assignBlock);
		auto *assignedValue = cast(
			lower(binary->right(), targetType, targetSemanticType),
			targetType,
			targetSemanticType,
			valueSemanticType(binary->right())
		);
		context.builder.CreateStore(assignedValue, target);
		auto *assignEnd = context.builder.GetInsertBlock();
		context.builder.CreateBr(mergeBlock);

		context.builder.SetInsertPoint(mergeBlock);
		auto *storedPhi = context.builder.CreatePHI(targetType, 2, "nullishassigntmp");
		storedPhi->addIncoming(presentValue, presentEnd);
		storedPhi->addIncoming(assignedValue, assignEnd);

		auto *resultType = expectedType ? expectedType : types.lower(binary->type());
		const auto *resultSemanticType = expectedSemanticType ? expectedSemanticType : binary->type();

		return cast(storedPhi, resultType, resultSemanticType, targetSemanticType);
	}

	::llvm::Value *ValueLowerer::compare(::llvm::Value *left, ::llvm::Value *right, bool equals) {
		if (left->getType()->isDoubleTy() || right->getType()->isDoubleTy()) {
			auto *result = context.builder.CreateFCmpOEQ(toNumber(left), toNumber(right), "eqtmp");
			return equals ? result : context.builder.CreateNot(result, "netmp");
		}

		if (left->getType()->isPointerTy() || right->getType()->isPointerTy()) {
			auto *targetType = left->getType()->isPointerTy() ? left->getType() : right->getType();
			auto *lhs = cast(left, targetType);
			auto *rhs = cast(right, targetType);
			auto *result = context.builder.CreateICmpEQ(lhs, rhs, "eqtmp");
			return equals ? result : context.builder.CreateNot(result, "netmp");
		}

		auto *result = context.builder.CreateICmpEQ(toBoolean(left), toBoolean(right), "eqtmp");
		return equals ? result : context.builder.CreateNot(result, "netmp");
	}

	::llvm::Value *ValueLowerer::toNumber(::llvm::Value *value) {
		if (value->getType()->isDoubleTy()) {
			return value;
		}

		if (value->getType()->isIntegerTy(1)) {
			return context.builder.CreateUIToFP(value, ::llvm::Type::getDoubleTy(context.llvmContext), "booltofptmp");
		}

		return ::llvm::ConstantFP::get(::llvm::Type::getDoubleTy(context.llvmContext), 0.0);
	}

	::llvm::Value *ValueLowerer::toBoolean(::llvm::Value *value) {
		if (value->getType()->isIntegerTy(1)) {
			return value;
		}

		if (value->getType()->isDoubleTy()) {
			return context.builder.CreateFCmpONE(
				value,
				::llvm::ConstantFP::get(::llvm::Type::getDoubleTy(context.llvmContext), 0.0),
				"numtobooltmp"
			);
		}

		if (value->getType()->isPointerTy()) {
			auto *null = ::llvm::ConstantPointerNull::get(::llvm::cast<::llvm::PointerType>(value->getType()));
			return context.builder.CreateICmpNE(value, null, "ptrtobooltmp");
		}

		return ::llvm::ConstantInt::getFalse(context.llvmContext);
	}

	::llvm::Value *ValueLowerer::toStringValue(
		::llvm::Value *value,
		const Yogi::Sir::TypeRef *sourceSemanticType
	) {
		switch (resolvedTypeKind(sourceSemanticType)) {
			case Yogi::Sir::TypeKind_string_type:
				return value;
			case Yogi::Sir::TypeKind_number_type:
				return callRuntime("yogi_string_from_number", opaquePointer(), {toNumber(value)});
			case Yogi::Sir::TypeKind_boolean_type:
				return callRuntime("yogi_string_from_boolean", opaquePointer(), {toBoolean(value)});
			default:
				return context.builder.CreateGlobalString("");
		}
	}

	::llvm::Value *ValueLowerer::isNullish(::llvm::Value *value) {
		if (!value) {
			return ::llvm::ConstantInt::getTrue(context.llvmContext);
		}

		if (value->getType()->isPointerTy()) {
			auto *null = ::llvm::ConstantPointerNull::get(::llvm::cast<::llvm::PointerType>(value->getType()));
			return context.builder.CreateICmpEQ(value, null, "isnullishtmp");
		}

		return ::llvm::ConstantInt::getFalse(context.llvmContext);
	}

	::llvm::Value *ValueLowerer::toIndex(::llvm::Value *value) {
		auto *indexType = ::llvm::Type::getInt64Ty(context.llvmContext);

		if (!value) {
			return ::llvm::ConstantInt::get(indexType, 0);
		}

		if (value->getType()->isIntegerTy(64)) {
			return value;
		}

		if (value->getType()->isIntegerTy(1)) {
			return context.builder.CreateZExt(value, indexType, "booltoindextmp");
		}

		if (value->getType()->isDoubleTy()) {
			return context.builder.CreateFPToUI(value, indexType, "numtoindextmp");
		}

		return ::llvm::ConstantInt::get(indexType, 0);
	}

	::llvm::Value *ValueLowerer::cast(
		::llvm::Value *value,
		::llvm::Type *targetType,
		const Yogi::Sir::TypeRef *targetSemanticType,
		const Yogi::Sir::TypeRef *sourceSemanticType
	) {
		if (!value || !targetType) {
			return types.zero(targetType);
		}

		if (isAnyType(targetSemanticType)) {
			return boxAny(value, sourceSemanticType);
		}

		if (isAnyType(sourceSemanticType)) {
			return unboxAny(value, targetSemanticType);
		}

		if (
			sourceSemanticType &&
			sourceSemanticType->kind() == Yogi::Sir::TypeKind_union_type &&
			value->getType()->isPointerTy() &&
			!targetType->isPointerTy()
		) {
			return unboxAny(value, targetSemanticType);
		}

		if (value->getType() == targetType) {
			return value;
		}

		if (targetType->isDoubleTy()) {
			return toNumber(value);
		}

		if (targetType->isIntegerTy(1)) {
			return toBoolean(value);
		}

		if (targetType->isPointerTy()) {
			if (value->getType()->isPointerTy()) {
				return context.builder.CreatePointerCast(value, targetType, "ptrcasttmp");
			}

			return ::llvm::ConstantPointerNull::get(::llvm::cast<::llvm::PointerType>(targetType));
		}

		return types.zero(targetType);
	}

	::llvm::Value *ValueLowerer::boxAny(::llvm::Value *value, const Yogi::Sir::TypeRef *sourceSemanticType) {
		if (isAnyType(sourceSemanticType)) {
			return value ? value : ::llvm::ConstantPointerNull::get(opaquePointer());
		}

		if (!sourceSemanticType) {
			if (value && value->getType()->isDoubleTy()) {
				return callRuntime("yogi_any_from_number", opaquePointer(), {value});
			}

			if (value && value->getType()->isIntegerTy(1)) {
				return callRuntime("yogi_any_from_boolean", opaquePointer(), {value});
			}

			if (value && value->getType()->isPointerTy()) {
				return value;
			}

			return callRuntime("yogi_any_null", opaquePointer(), {});
		}

		switch (sourceSemanticType->kind()) {
			case Yogi::Sir::TypeKind_number_type:
				return callRuntime("yogi_any_from_number", opaquePointer(), {toNumber(value)});

			case Yogi::Sir::TypeKind_boolean_type:
				return callRuntime("yogi_any_from_boolean", opaquePointer(), {toBoolean(value)});

			case Yogi::Sir::TypeKind_string_type: {
				auto *stringValue = value && value->getType()->isPointerTy()
					? value
					: ::llvm::ConstantPointerNull::get(opaquePointer());
				return callRuntime("yogi_any_from_string", opaquePointer(), {stringValue});
			}

			case Yogi::Sir::TypeKind_array_type:
			case Yogi::Sir::TypeKind_tuple_type:
				return callRuntime("yogi_any_from_array", opaquePointer(), {value});

			case Yogi::Sir::TypeKind_null_type:
				return callRuntime("yogi_any_null", opaquePointer(), {});

			case Yogi::Sir::TypeKind_undefined_type:
				return callRuntime("yogi_any_undefined", opaquePointer(), {});

			default:
				return callRuntime("yogi_any_null", opaquePointer(), {});
		}
	}

	::llvm::Value *ValueLowerer::unboxAny(::llvm::Value *value, const Yogi::Sir::TypeRef *targetSemanticType) {
		if (!targetSemanticType || isAnyType(targetSemanticType)) {
			return value;
		}

		switch (targetSemanticType->kind()) {
			case Yogi::Sir::TypeKind_number_type:
				return callRuntime("yogi_any_to_number", ::llvm::Type::getDoubleTy(context.llvmContext), {value});

			case Yogi::Sir::TypeKind_boolean_type:
				return callRuntime("yogi_any_to_boolean", ::llvm::Type::getInt1Ty(context.llvmContext), {value});

			case Yogi::Sir::TypeKind_string_type:
				return callRuntime("yogi_any_to_string", opaquePointer(), {value});

			case Yogi::Sir::TypeKind_array_type:
			case Yogi::Sir::TypeKind_tuple_type:
				return callRuntime("yogi_any_to_array", opaquePointer(), {value});

			case Yogi::Sir::TypeKind_null_type:
				return callRuntime("yogi_any_to_null", opaquePointer(), {value});

			case Yogi::Sir::TypeKind_undefined_type:
				return callRuntime("yogi_any_to_undefined", opaquePointer(), {value});

			default:
				return value;
		}
	}

	::llvm::Value *ValueLowerer::unboxArrayElement(
		::llvm::Value *value,
		::llvm::Type *targetType,
		const Yogi::Sir::TypeRef *targetSemanticType,
		const Yogi::Sir::TypeRef *sourceSemanticType
	) {
		if (!value || !targetType || !value->getType()->isPointerTy() || targetType->isPointerTy()) {
			return value;
		}

		if (
			sourceSemanticType &&
			(
				sourceSemanticType->kind() == Yogi::Sir::TypeKind_union_type ||
				sourceSemanticType->kind() == Yogi::Sir::TypeKind_any_type
			)
		) {
			return unboxAny(value, targetSemanticType);
		}

		return value;
	}

	::llvm::Value *ValueLowerer::callRuntime(
		const std::string &name,
		::llvm::Type *returnType,
		const std::vector<::llvm::Value *> &arguments
	) {
		std::vector<::llvm::Type *> parameterTypes;
		parameterTypes.reserve(arguments.size());

		for (auto *argument: arguments) {
			parameterTypes.push_back(argument->getType());
		}

		auto *function = context.runtimeFunction(name, returnType, parameterTypes);
		if (returnType->isVoidTy()) {
			return context.builder.CreateCall(function, arguments);
		}

		return context.builder.CreateCall(function, arguments, sanitizeSymbol(name) + ".call");
	}

	const Yogi::Sir::TypeRef *ValueLowerer::valueSemanticType(const Yogi::Sir::ValueRef *value) const {
		if (!value) {
			return nullptr;
		}

		if (const auto *constant = value->constant()) {
			return constant->type();
		}

		if (const auto *identifier = value->identifier()) {
			return identifier->type();
		}

		if (const auto *binary = value->binary()) {
			return binary->type();
		}

		if (const auto *assignment = value->assignment()) {
			return assignment->type();
		}

		if (const auto *conditional = value->conditional()) {
			return conditional->type();
		}

		if (const auto *array = value->array()) {
			return array->type();
		}

		if (const auto *object = value->object()) {
			return object->type();
		}

		if (const auto *access = value->property_access()) {
			return access->type();
		}

		if (const auto *access = value->element_access()) {
			return access->type();
		}

		if (const auto *assignment = value->aggregate_assignment()) {
			return assignment->type();
		}

		if (const auto *functionExpression = value->function_expression()) {
			return functionExpression->type();
		}

		if (const auto *call = value->call()) {
			return call->type();
		}

		return nullptr;
	}

	bool ValueLowerer::isAnyType(const Yogi::Sir::TypeRef *type) const {
		return type && type->kind() == Yogi::Sir::TypeKind_any_type;
	}

	Yogi::Sir::TypeKind ValueLowerer::resolvedTypeKind(const Yogi::Sir::TypeRef *type) const {
		if (!type) {
			return Yogi::Sir::TypeKind_unknown;
		}

		const auto kind = type->kind();
		const auto *resolved = type->resolved();

		if (kind == Yogi::Sir::TypeKind_type_reference && resolved) {
			return resolvedTypeKind(resolved);
		}

		return kind;
	}

	::llvm::PointerType *ValueLowerer::opaquePointer() const {
		return ::llvm::PointerType::get(context.llvmContext, 0);
	}

} // namespace yogi::core::llvm::internal
#endif
