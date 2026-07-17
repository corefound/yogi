// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/lowering/valueLowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Constants.h>
#include <llvm/IR/DerivedTypes.h>
#include <llvm/IR/Function.h>

#include <cstdint>
#include <functional>
#include <limits>
#include <map>
#include <optional>
#include <tuple>
#include <vector>

namespace yogi::core::llvm::internal {

	namespace {
		std::string identifierName(const Yogi::Sir::ValueRef *value) {
			const auto *identifier = value ? value->identifier() : nullptr;
			return identifier ? fbString(identifier->name()) : "";
		}

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
	}

	ValueLowerer::ValueLowerer(ModuleLoweringContext &context, TypeLowerer &types)
		: context(context),
		  types(types) {}

	std::string ValueLowerer::borrowedViewOwnerName(const Yogi::Sir::ValueRef *value) const {
		if (!value) {
			return "";
		}

		if (const auto *identifier = value->identifier()) {
			const auto name = fbString(identifier->name());
			const auto viewAlias = context.borrowedViewAliases.find(name);
			return viewAlias == context.borrowedViewAliases.end()
				? ""
				: viewAlias->second;
		}

		if (const auto *access = value->element_access()) {
			const auto owner = borrowedViewOwnerName(access->object());
			return owner.empty() ? rootIdentifierName(access->object()) : owner;
		}

		if (const auto *access = value->property_access()) {
			return borrowedViewOwnerName(access->object());
		}

		return "";
	}

	void ValueLowerer::retainEscapedBorrowedViewSource(
		const Yogi::Sir::ValueRef *value,
		::llvm::Value *loweredValue
	) {
		if (!value || !loweredValue || !loweredValue->getType()->isPointerTy()) {
			return;
		}

		const auto ownerName = borrowedViewOwnerName(value);
		if (ownerName.empty() || !context.locals.contains(ownerName)) {
			return;
		}

		callRuntime(
			"yogi_array_retain_view_source",
			::llvm::Type::getVoidTy(context.llvmContext),
			{loweredValue}
		);
		context.deactivateAggregateOwner(ownerName);
	}

	void ValueLowerer::deactivateEscapedAggregateGraphOwner(const Yogi::Sir::ValueRef *value) {
		const auto name = identifierName(value);
		if (!name.empty()) {
			context.deactivateAggregateOwner(name);
		}
	}

	::llvm::Value *ValueLowerer::lowerWithEscapedObjectGraphRetention(
		const Yogi::Sir::ValueRef *value,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto previous = context.retainEscapedObjectGraph;
		context.retainEscapedObjectGraph = true;
		auto *result = lower(value, expectedType, expectedSemanticType);
		context.retainEscapedObjectGraph = previous;
		return result;
	}

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

			if (const auto *addressOf = value->address_of()) {
				return lowerAddressOf(addressOf, expectedType, expectedSemanticType);
			}

			if (const auto *dereference = value->dereference()) {
				return lowerDereference(dereference, expectedType, expectedSemanticType);
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
				auto *argumentValue = lower(argument, argumentType, argumentSemanticType);
				arguments.push_back(argumentValue);
				argumentTypes.push_back(argumentType);

				const auto *effect = call->argument_effects() && index < call->argument_effects()->size()
					? call->argument_effects()->Get(index)
					: nullptr;

				if (effect && effect->escapes()) {
					retainEscapedBorrowedViewSource(argument, argumentValue);
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

		const auto structName = structTypeName(argumentSemanticType);
		if (!structName.empty() && context.structTypes.contains(structName)) {
			auto *value = lower(argument, types.lower(argumentSemanticType), argumentSemanticType);
			return printStructObject(structName, value);
		}

		switch (resolvedTypeKind(argumentSemanticType)) {
			case Yogi::Sir::TypeKind_number_type: {
				auto *value = lower(argument, types.lower(argumentSemanticType), argumentSemanticType);
				return callRuntime("yogi_print_number", voidType, {toNumber(value, argumentSemanticType)});
			}

			case Yogi::Sir::TypeKind_boolean_type: {
				auto *value = lower(argument, ::llvm::Type::getInt1Ty(context.llvmContext), argumentSemanticType);
				return callRuntime("yogi_print_boolean", voidType, {toBoolean(value)});
			}

			case Yogi::Sir::TypeKind_string_type: {
				auto *value = lower(argument, opaquePointer(), argumentSemanticType);
				auto *result = callRuntime("yogi_print_string", voidType, {value});
				destroyStringTemporaryIfOwned(value, argument);
				return result;
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

			case Yogi::Sir::TypeKind_type_literal: {
				auto *value = lower(argument, opaquePointer(), argumentSemanticType);
				return callRuntime("yogi_print_object", voidType, {value});
			}

			case Yogi::Sir::TypeKind_type_reference: {
				auto *value = lower(argument, opaquePointer(), argumentSemanticType);
				return callRuntime("yogi_print_object", voidType, {value});
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
		const auto *objectSemanticType = valueSemanticType(callee->object());
		const auto objectKind = resolvedTypeKind(objectSemanticType);
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
		const auto lowerStringArgument = [&](flatbuffers::uoffset_t index, const std::string &defaultValue) -> ::llvm::Value * {
			if (!arguments || index >= arguments->size()) {
				return context.builder.CreateGlobalString(defaultValue);
			}

			const auto *argument = arguments->Get(index);
			return lower(argument, opaquePointer(), valueSemanticType(argument));
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
		const auto arrayReceiverSemanticType = [&](const Yogi::Sir::ValueRef *receiver) -> const Yogi::Sir::TypeRef * {
			const auto *receiverType = valueSemanticType(receiver);
			if (resolvedTypeKind(receiverType) == Yogi::Sir::TypeKind_pointer_type && receiverType->element_type()) {
				return receiverType->element_type();
			}

			return receiverType;
		};
		const auto lowerArrayReceiver = [&](const Yogi::Sir::ValueRef *receiver) -> ::llvm::Value * {
			const auto *receiverType = valueSemanticType(receiver);
			auto *value = lower(receiver, opaquePointer(), receiverType);

			if (resolvedTypeKind(receiverType) == Yogi::Sir::TypeKind_pointer_type && receiverType->element_type()) {
				return lowerPointerArrayDescriptor(value, receiverType->element_type());
			}

			return value;
		};

		if (methodName == "__yogiStablePlan") {
			auto *array = lowerArrayReceiver(callee->object());
			return callRuntime("yogi_array_iteration_plan", opaquePointer(), {array});
		}

		if (methodName == "__yogiStableLength") {
			auto *plan = lower(callee->object(), opaquePointer(), objectSemanticType);
			auto *length = callRuntime("yogi_array_iteration_plan_length", ::llvm::Type::getInt64Ty(context.llvmContext), {plan});
			auto *asNumber = context.builder.CreateUIToFP(
				length,
				::llvm::Type::getDoubleTy(context.llvmContext),
				"array.iteration.plan.length"
			);
			return cast(
				asNumber,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "__yogiStableValid") {
			auto *plan = lower(callee->object(), opaquePointer(), objectSemanticType);
			auto *index = toIndex(lowerNumberArgument(0, 0));
			auto *valid = callRuntime("yogi_array_iteration_plan_valid", ::llvm::Type::getInt1Ty(context.llvmContext), {plan, index});
			return cast(
				valid,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "__yogiStableValue") {
			auto *plan = lower(callee->object(), opaquePointer(), objectSemanticType);
			auto *index = toIndex(lowerNumberArgument(0, 0));
			auto *boxedValue = callRuntime("yogi_array_iteration_plan_value", opaquePointer(), {plan, index});
			auto *targetType = expectedType ? expectedType : types.lower(call->type());
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : call->type();
			return cast(
				unboxAny(boxedValue, targetSemanticType),
				targetType,
				targetSemanticType,
				call->type()
			);
		}

		if (methodName == "__yogiStablePointer") {
			auto *plan = lower(callee->object(), opaquePointer(), objectSemanticType);
			auto *index = toIndex(lowerNumberArgument(0, 0));
			auto *pointer = callRuntime("yogi_array_iteration_plan_pointer", opaquePointer(), {plan, index});
			return cast(
				pointer,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "__yogiStableDestroy") {
			auto *plan = lower(callee->object(), opaquePointer(), objectSemanticType);
			auto *destroy = callRuntime("yogi_array_iteration_plan_destroy", ::llvm::Type::getVoidTy(context.llvmContext), {plan});

			if (const auto *identifier = callee->object() ? callee->object()->identifier() : nullptr) {
				const auto name = fbString(identifier->name());
				if (context.locals.contains(name)) {
					auto *slot = context.locals[name];
					context.builder.CreateStore(::llvm::Constant::getNullValue(slot->getAllocatedType()), slot);
				}
			}

			return destroy;
		}

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

		if (objectKind == Yogi::Sir::TypeKind_string_type) {
			auto *text = lower(callee->object(), opaquePointer(), objectSemanticType);

			if (methodName == "slice" || methodName == "substring") {
				auto *start = lowerNumberArgument(0, 0);
				auto *end = lowerNumberArgument(1, std::numeric_limits<double>::infinity());
				auto *result = callRuntime(
					methodName == "slice" ? "yogi_string_slice" : "yogi_string_substring",
					opaquePointer(),
					{text, start, end}
				);
				destroyStringTemporaryIfOwned(text, callee->object());

				return cast(
					result,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			if (methodName == "includes" || methodName == "startsWith" || methodName == "endsWith") {
				auto *search = lowerStringArgument(0, "");
				const auto *searchSource = arguments && arguments->size() > 0 ? arguments->Get(0) : nullptr;
				auto *position = lowerNumberArgument(
					1,
					methodName == "endsWith" ? std::numeric_limits<double>::infinity() : 0
				);
				const auto runtimeName = methodName == "includes"
					? "yogi_string_includes"
					: methodName == "startsWith"
						? "yogi_string_starts_with"
						: "yogi_string_ends_with";
				auto *result = callRuntime(
					runtimeName,
					::llvm::Type::getInt1Ty(context.llvmContext),
					{text, search, position}
				);
				destroyStringTemporaryIfOwned(search, searchSource);
				destroyStringTemporaryIfOwned(text, callee->object());

				return cast(
					result,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			if (methodName == "indexOf" || methodName == "lastIndexOf") {
				auto *search = lowerStringArgument(0, "");
				const auto *searchSource = arguments && arguments->size() > 0 ? arguments->Get(0) : nullptr;
				auto *position = lowerNumberArgument(
					1,
					methodName == "lastIndexOf" ? std::numeric_limits<double>::infinity() : 0
				);
				auto *result = callRuntime(
					methodName == "indexOf" ? "yogi_string_index_of" : "yogi_string_last_index_of",
					::llvm::Type::getInt64Ty(context.llvmContext),
					{text, search, position}
				);
				auto *asNumber = context.builder.CreateSIToFP(
					result,
					::llvm::Type::getDoubleTy(context.llvmContext),
					"string.search.index"
				);
				destroyStringTemporaryIfOwned(search, searchSource);
				destroyStringTemporaryIfOwned(text, callee->object());

				return cast(
					asNumber,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			if (methodName == "charAt" || methodName == "charCodeAt") {
				auto *index = lowerNumberArgument(0, 0);
				auto *result = callRuntime(
					methodName == "charAt" ? "yogi_string_char_at" : "yogi_string_char_code_at",
					methodName == "charAt" ? opaquePointer() : ::llvm::Type::getDoubleTy(context.llvmContext),
					{text, index}
				);
				destroyStringTemporaryIfOwned(text, callee->object());

				return cast(
					result,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			if (methodName == "repeat") {
				auto *count = lowerNumberArgument(0, 0);
				auto *result = callRuntime("yogi_string_repeat", opaquePointer(), {text, count});
				destroyStringTemporaryIfOwned(text, callee->object());

				return cast(
					result,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			if (methodName == "padStart" || methodName == "padEnd") {
				auto *targetLength = lowerNumberArgument(0, 0);
				auto *pad = lowerStringArgument(1, " ");
				const auto *padSource = arguments && arguments->size() > 1 ? arguments->Get(1) : nullptr;
				auto *result = callRuntime(
					methodName == "padStart" ? "yogi_string_pad_start" : "yogi_string_pad_end",
					opaquePointer(),
					{text, targetLength, pad}
				);
				destroyStringTemporaryIfOwned(pad, padSource);
				destroyStringTemporaryIfOwned(text, callee->object());

				return cast(
					result,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			if (methodName == "concat") {
				auto *empty = context.builder.CreateGlobalString("");
				auto *result = callRuntime("yogi_string_concat", opaquePointer(), {text, empty});
				destroyStringTemporaryIfOwned(text, callee->object());

				for (std::uint32_t index = 0; index < argumentCount; ++index) {
					const auto *argument = arguments->Get(index);
					auto *value = lowerStringArgument(index, "");
					auto *next = callRuntime("yogi_string_concat", opaquePointer(), {result, value});
					destroyStringTemporary(result);
					destroyStringTemporaryIfOwned(value, argument);
					result = next;
				}

				return cast(
					result,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}

			if (
				methodName == "toUpperCase" ||
				methodName == "toLowerCase" ||
				methodName == "trim" ||
				methodName == "trimStart" ||
				methodName == "trimEnd"
			) {
				const auto runtimeName = methodName == "toUpperCase"
					? "yogi_string_to_upper_case"
					: methodName == "toLowerCase"
						? "yogi_string_to_lower_case"
						: methodName == "trimStart"
							? "yogi_string_trim_start"
							: methodName == "trimEnd"
								? "yogi_string_trim_end"
								: "yogi_string_trim";
				auto *result = callRuntime(runtimeName, opaquePointer(), {text});
				destroyStringTemporaryIfOwned(text, callee->object());

				return cast(
					result,
					expectedType ? expectedType : types.lower(call->type()),
					expectedSemanticType ? expectedSemanticType : call->type(),
					call->type()
				);
			}
		}

		if (methodName == "push") {
			auto *array = lowerArrayReceiver(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
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

		if (methodName == "copy") {
			auto *array = lowerArrayReceiver(callee->object());
			auto *i64 = ::llvm::Type::getInt64Ty(context.llvmContext);
			auto *length = callRuntime("yogi_array_length", i64, {array});
			auto *copy = callRuntime("yogi_array_create", opaquePointer(), {length});
			auto *function = context.builder.GetInsertBlock()->getParent();
			auto *condBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.copy.cond", function);
			auto *bodyBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.copy.body", function);
			auto *afterBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.copy.done", function);
			auto *indexSlot = context.builder.CreateAlloca(i64, nullptr, "array.copy.index");
			context.builder.CreateStore(::llvm::ConstantInt::get(i64, 0), indexSlot);
			context.builder.CreateBr(condBlock);

			context.builder.SetInsertPoint(condBlock);
			auto *index = context.builder.CreateLoad(i64, indexSlot, "array.copy.i");
			auto *hasMore = context.builder.CreateICmpULT(index, length, "array.copy.more");
			context.builder.CreateCondBr(hasMore, bodyBlock, afterBlock);

			context.builder.SetInsertPoint(bodyBlock);
			auto *boxedElement = callRuntime("yogi_array_get", opaquePointer(), {array, index});
			callRuntime("yogi_array_set", ::llvm::Type::getVoidTy(context.llvmContext), {copy, index, boxedElement});
			auto *nextIndex = context.builder.CreateAdd(index, ::llvm::ConstantInt::get(i64, 1), "array.copy.next");
			context.builder.CreateStore(nextIndex, indexSlot);
			context.builder.CreateBr(condBlock);

			context.builder.SetInsertPoint(afterBlock);

			return cast(
				copy,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "includes" || methodName == "indexOf" || methodName == "lastIndexOf") {
			auto *array = lowerArrayReceiver(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
			callRuntime("yogi_array_reverse", ::llvm::Type::getVoidTy(context.llvmContext), {array});

			return cast(
				array,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "fill") {
			auto *array = lowerArrayReceiver(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
			auto *result = callRuntime("yogi_array_to_reversed", opaquePointer(), {array});

			return cast(
				result,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "join" || methodName == "toString" || methodName == "toLocaleString") {
			auto *array = lowerArrayReceiver(callee->object());

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
			auto *array = lowerArrayReceiver(callee->object());
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

				const auto *arrayType = arrayReceiverSemanticType(callee->object());
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
				callRuntime("yogi_array_swap_slots", ::llvm::Type::getVoidTy(context.llvmContext), {targetArray, innerIndex, nextInnerIndex});
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
			auto *array = lowerArrayReceiver(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
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

			auto *array = lowerArrayReceiver(callee->object());
			const auto *arrayType = arrayReceiverSemanticType(callee->object());
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
			auto *array = lowerArrayReceiver(callee->object());
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
			if (expectedType && expectedType->isIntegerTy() && !expectedType->isIntegerTy(1)) {
				auto *integerType = ::llvm::cast<::llvm::IntegerType>(expectedType);
				auto literal = static_cast<int64_t>(number->value());
				auto value = ::llvm::APInt(
					integerType->getBitWidth(),
					static_cast<uint64_t>(literal),
					isSignedIntegerSemanticType(expectedSemanticType)
				);
				return ::llvm::ConstantInt::get(integerType, value);
			}

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

	::llvm::Value *ValueLowerer::tagRuntimeCellPointer(::llvm::Value *cell) {
		auto *integerType = ::llvm::Type::getInt64Ty(context.llvmContext);
		auto *address = context.builder.CreatePtrToInt(cell, integerType, "ptr.cell.addr");
		auto *tagged = context.builder.CreateOr(
			address,
			::llvm::ConstantInt::get(integerType, 1),
			"ptr.cell.tag"
		);

		return context.builder.CreateIntToPtr(tagged, opaquePointer(), "ptr.cell.tagged");
	}

	::llvm::Value *ValueLowerer::untagRuntimeCellPointer(::llvm::Value *pointer) {
		auto *integerType = ::llvm::Type::getInt64Ty(context.llvmContext);
		auto *address = context.builder.CreatePtrToInt(pointer, integerType, "ptr.cell.tagged.addr");
		auto *untagged = context.builder.CreateAnd(
			address,
			::llvm::ConstantInt::get(integerType, ~static_cast<uint64_t>(7)),
			"ptr.cell.untag"
		);

		return context.builder.CreateIntToPtr(untagged, opaquePointer(), "ptr.cell.slot");
	}

	::llvm::Value *ValueLowerer::isRuntimeCellPointer(::llvm::Value *pointer) {
		auto *integerType = ::llvm::Type::getInt64Ty(context.llvmContext);
		auto *address = context.builder.CreatePtrToInt(pointer, integerType, "ptr.kind.addr");
		auto *tag = context.builder.CreateAnd(
			address,
			::llvm::ConstantInt::get(integerType, 1),
			"ptr.kind.tag"
		);

		return context.builder.CreateICmpNE(
			tag,
			::llvm::ConstantInt::get(integerType, 0),
			"ptr.kind.is_cell"
		);
	}

	::llvm::Value *ValueLowerer::lowerPointerArrayDescriptor(
		::llvm::Value *pointer,
		const Yogi::Sir::TypeRef *pointeeSemanticType
	) {
		auto *isCell = isRuntimeCellPointer(pointer);
		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *cellBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.array.cell", function);
		auto *rawBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.array.raw", function);
		auto *mergeBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.array.merge", function);

		context.builder.CreateCondBr(isCell, cellBlock, rawBlock);

		context.builder.SetInsertPoint(cellBlock);
		auto *boxed = callRuntime("yogi_pointer_cell_get", opaquePointer(), {pointer});
		auto *cellArray = unboxAny(boxed, pointeeSemanticType);
		context.builder.CreateBr(mergeBlock);
		auto *cellEnd = context.builder.GetInsertBlock();

		context.builder.SetInsertPoint(rawBlock);
		context.builder.CreateBr(mergeBlock);
		auto *rawEnd = context.builder.GetInsertBlock();

		context.builder.SetInsertPoint(mergeBlock);
		auto *phi = context.builder.CreatePHI(opaquePointer(), 2, "ptr.array.descriptor");
		phi->addIncoming(cellArray, cellEnd);
		phi->addIncoming(pointer, rawEnd);

		return phi;
	}

	::llvm::Value *ValueLowerer::lowerPointerRead(
		::llvm::Value *pointer,
		const Yogi::Sir::TypeRef *pointeeSemanticType,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto pointeeKind = resolvedTypeKind(pointeeSemanticType);
		const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : pointeeSemanticType;
		auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

		if (
			pointeeKind == Yogi::Sir::TypeKind_array_type ||
			pointeeKind == Yogi::Sir::TypeKind_tuple_type
		) {
			auto *descriptor = lowerPointerArrayDescriptor(pointer, pointeeSemanticType);
			return cast(descriptor, targetType, targetSemanticType, pointeeSemanticType);
		}

		auto *isCell = isRuntimeCellPointer(pointer);
		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *cellBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.read.cell", function);
		auto *rawBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.read.raw", function);
		auto *mergeBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.read.merge", function);

		context.builder.CreateCondBr(isCell, cellBlock, rawBlock);

		context.builder.SetInsertPoint(cellBlock);
		auto *boxed = callRuntime("yogi_pointer_cell_get", opaquePointer(), {pointer});
		auto *cellValue = cast(
			unboxAny(boxed, targetSemanticType),
			targetType,
			targetSemanticType,
			targetSemanticType
		);
		context.builder.CreateBr(mergeBlock);
		auto *cellEnd = context.builder.GetInsertBlock();

		context.builder.SetInsertPoint(rawBlock);
		auto *loaded = context.builder.CreateLoad(
			types.lower(pointeeSemanticType),
			pointer,
			"ptr.raw.load"
		);
		auto *rawValue = cast(loaded, targetType, targetSemanticType, pointeeSemanticType);
		context.builder.CreateBr(mergeBlock);
		auto *rawEnd = context.builder.GetInsertBlock();

		context.builder.SetInsertPoint(mergeBlock);
		auto *phi = context.builder.CreatePHI(targetType, 2, "ptr.read.value");
		phi->addIncoming(cellValue, cellEnd);
		phi->addIncoming(rawValue, rawEnd);

		return phi;
	}

	void ValueLowerer::lowerPointerWrite(
		::llvm::Value *pointer,
		::llvm::Value *value,
		const Yogi::Sir::TypeRef *pointeeSemanticType,
		const Yogi::Sir::TypeRef *sourceSemanticType
	) {
		auto *isCell = isRuntimeCellPointer(pointer);
		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *cellBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.write.cell", function);
		auto *rawBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.write.raw", function);
		auto *mergeBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.write.merge", function);

		context.builder.CreateCondBr(isCell, cellBlock, rawBlock);

		context.builder.SetInsertPoint(cellBlock);
		auto *boxed = boxAny(value, sourceSemanticType ? sourceSemanticType : pointeeSemanticType);
		callRuntime("yogi_pointer_cell_set", ::llvm::Type::getVoidTy(context.llvmContext), {pointer, boxed});
		context.builder.CreateBr(mergeBlock);

		context.builder.SetInsertPoint(rawBlock);
		auto *storedValue = cast(
			value,
			types.lower(pointeeSemanticType),
			pointeeSemanticType,
			sourceSemanticType
		);
		context.builder.CreateStore(storedValue, pointer);
		context.builder.CreateBr(mergeBlock);

		context.builder.SetInsertPoint(mergeBlock);
	}

	std::optional<ValueLowerer::AddressableSlot> ValueLowerer::lowerStructAddressableSlot(
		const Yogi::Sir::PropertyAccessExpression *property
	) {
		if (!property) {
			return std::nullopt;
		}

		auto objectSlot = lowerStructAddressableSlot(property->object());
		if (!objectSlot) {
			return std::nullopt;
		}

		const auto structName = structTypeName(objectSlot->type);
		if (structName.empty() || !context.structTypes.contains(structName)) {
			return std::nullopt;
		}

		const auto propertyName = fbString(property->property());
		auto *structType = context.structTypes[structName];

		for (const auto &field: context.structFields[structName]) {
			if (field.name != propertyName) {
				continue;
			}

			auto *fieldAddress = context.builder.CreateStructGEP(
				structType,
				objectSlot->address,
				static_cast<unsigned>(field.index),
				"addr." + sanitizeSymbol(structName) + "." + sanitizeSymbol(field.name)
			);

			return AddressableSlot{fieldAddress, field.type};
		}

		return std::nullopt;
	}

	std::optional<ValueLowerer::AddressableSlot> ValueLowerer::lowerStructAddressableSlot(
		const Yogi::Sir::ValueRef *value
	) {
		if (!value) {
			return std::nullopt;
		}

		if (const auto *identifier = value->identifier()) {
			const auto name = fbString(identifier->name());
			::llvm::Value *address = nullptr;
			const Yogi::Sir::TypeRef *type = identifier->type();

			if (!name.empty() && context.locals.contains(name)) {
				address = context.locals[name];
				if (context.localTypes.contains(name)) {
					type = context.localTypes[name];
				}
			} else if (!name.empty() && context.globals.contains(name)) {
				address = context.globals[name];
				if (context.globalTypes.contains(name)) {
					type = context.globalTypes[name];
				}
			} else if (identifier->qualified_name()) {
				const auto qualifiedName = fbString(identifier->qualified_name());
				const auto symbolName = "_yogi_" + sanitizeSymbol(qualifiedName);
				address = context.module->getGlobalVariable(symbolName);

				if (!address) {
					auto *llvmType = types.lower(type);
					address = new ::llvm::GlobalVariable(
						*context.module,
						llvmType,
						false,
						::llvm::GlobalValue::ExternalLinkage,
						nullptr,
						symbolName
					);
				}
			}

			if (!address) {
				return std::nullopt;
			}

			if (
				type &&
				type->kind() == Yogi::Sir::TypeKind_pointer_type &&
				type->element_type() &&
				!structTypeName(type->element_type()).empty()
			) {
				auto *pointer = context.builder.CreateLoad(
					opaquePointer(),
					address,
					sanitizeSymbol(name.empty() ? "struct.ptr" : name) + ".ptr.load"
				);

				return AddressableSlot{pointer, type->element_type()};
			}

			return AddressableSlot{address, type};
		}

		if (const auto *property = value->property_access()) {
			return lowerStructAddressableSlot(property);
		}

		return std::nullopt;
	}

	bool ValueLowerer::collectPointerStructPropertyChain(
		const Yogi::Sir::PropertyAccessExpression *property,
		const Yogi::Sir::ValueRef *&root,
		std::vector<const Yogi::Sir::PropertyAccessExpression *> &chain
	) const {
		root = nullptr;
		chain.clear();

		auto *current = property;
		while (current) {
			chain.push_back(current);

			const auto *object = current->object();
			if (const auto *parent = object ? object->property_access() : nullptr) {
				current = parent;
				continue;
			}

			root = object;
			break;
		}

		if (!root) {
			return false;
		}

		std::reverse(chain.begin(), chain.end());

		const auto *rootType = valueSemanticType(root);
		return rootType &&
			rootType->kind() == Yogi::Sir::TypeKind_pointer_type &&
			rootType->element_type() &&
			!structTypeName(rootType->element_type()).empty();
	}

	std::optional<std::pair<::llvm::Value *, const Yogi::Sir::TypeRef *>>
	ValueLowerer::lowerPointerStructFieldPointer(
		const Yogi::Sir::PropertyAccessExpression *property
	) {
		const Yogi::Sir::ValueRef *root = nullptr;
		std::vector<const Yogi::Sir::PropertyAccessExpression *> chain;

		if (!collectPointerStructPropertyChain(property, root, chain)) {
			return std::nullopt;
		}

		const auto *rootType = valueSemanticType(root);
		auto *pointer = lower(root, opaquePointer(), rootType);
		return lowerPointerStructFieldPointer(pointer, rootType->element_type(), chain, 0);
	}

	std::optional<std::pair<::llvm::Value *, const Yogi::Sir::TypeRef *>>
	ValueLowerer::lowerPointerStructFieldPointer(
		::llvm::Value *pointer,
		const Yogi::Sir::TypeRef *structSemanticType,
		const std::vector<const Yogi::Sir::PropertyAccessExpression *> &chain,
		std::size_t chainIndex
	) {
		if (!pointer || !structSemanticType || chainIndex >= chain.size()) {
			return std::nullopt;
		}

		const auto structName = structTypeName(structSemanticType);
		if (structName.empty() || !context.structTypes.contains(structName)) {
			return std::nullopt;
		}

		const auto propertyName = fbString(chain[chainIndex]->property());
		const auto *fieldType = static_cast<const Yogi::Sir::TypeRef *>(nullptr);
		auto fieldIndex = std::size_t{0};

		for (const auto &field: context.structFields[structName]) {
			if (field.name != propertyName) {
				continue;
			}

			fieldType = field.type;
			fieldIndex = field.index;
			break;
		}

		if (!fieldType) {
			return std::nullopt;
		}

		auto *isCell = isRuntimeCellPointer(pointer);
		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *cellBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.struct.field.cell", function);
		auto *rawBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.struct.field.raw", function);
		auto *mergeBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.struct.field.merge", function);

		context.builder.CreateCondBr(isCell, cellBlock, rawBlock);

		context.builder.SetInsertPoint(cellBlock);
		auto *key = context.builder.CreateGlobalString(propertyName);
		auto *taggedFieldCell = callRuntime("yogi_project_cell", opaquePointer(), {pointer, key});
		context.builder.CreateBr(mergeBlock);
		auto *cellEnd = context.builder.GetInsertBlock();

		context.builder.SetInsertPoint(rawBlock);
		auto *fieldAddress = context.builder.CreateStructGEP(
			context.structTypes[structName],
			pointer,
			static_cast<unsigned>(fieldIndex),
			"ptr.struct.field.addr." + sanitizeSymbol(propertyName)
		);
		context.builder.CreateBr(mergeBlock);
		auto *rawEnd = context.builder.GetInsertBlock();

		context.builder.SetInsertPoint(mergeBlock);
		auto *fieldPointer = context.builder.CreatePHI(opaquePointer(), 2, "ptr.struct.field.pointer");
		fieldPointer->addIncoming(taggedFieldCell, cellEnd);
		fieldPointer->addIncoming(fieldAddress, rawEnd);

		if (chainIndex + 1 >= chain.size()) {
			return std::make_pair(fieldPointer, fieldType);
		}

		return lowerPointerStructFieldPointer(fieldPointer, fieldType, chain, chainIndex + 1);
	}

	::llvm::Value *ValueLowerer::lowerRuntimeObjectCellForPointer(
		const Yogi::Sir::PropertyAccessExpression *property
	) {
		if (!property) {
			return ::llvm::ConstantPointerNull::get(opaquePointer());
		}

		auto *key = context.builder.CreateGlobalString(fbString(property->property()));
		const auto *objectRef = property->object();

		if (const auto *element = objectRef ? objectRef->element_access() : nullptr) {
			auto *ownerPointer = lowerAddressableArrayPointerCell(element);
			return callRuntime("yogi_project_cell", opaquePointer(), {ownerPointer, key});
		}

		if (const auto *parent = objectRef ? objectRef->property_access() : nullptr) {
			auto *ownerPointer = lowerRuntimeObjectCellForPointer(parent);
			return callRuntime("yogi_project_cell", opaquePointer(), {ownerPointer, key});
		}

		auto *object = lowerRuntimeObjectValue(objectRef);
		auto *cell = callRuntime("yogi_object_cell", opaquePointer(), {object, key});
		return tagRuntimeCellPointer(cell);
	}

	::llvm::Value *ValueLowerer::lowerRuntimeObjectCell(
		const Yogi::Sir::PropertyAccessExpression *property
	) {
		auto *object = lowerRuntimeObjectValue(property->object());
		auto *key = context.builder.CreateGlobalString(fbString(property->property()));
		return callRuntime("yogi_object_cell", opaquePointer(), {object, key});
	}

	::llvm::Value *ValueLowerer::lowerRuntimeObjectValue(const Yogi::Sir::ValueRef *value) {
		if (!value) {
			return ::llvm::ConstantPointerNull::get(opaquePointer());
		}

		if (const auto *element = value->element_access()) {
			auto *cell = lowerAddressableArrayCell(element);
			auto *boxed = callRuntime("yogi_cell_get", opaquePointer(), {cell});
			return callRuntime("yogi_any_to_object", opaquePointer(), {boxed});
		}

		if (const auto *property = value->property_access()) {
			if (auto slot = lowerStructAddressableSlot(property)) {
				auto *loaded = context.builder.CreateLoad(
					types.lower(slot->type),
					slot->address,
					"runtime.object.struct.slot.load"
				);
				auto *boxed = boxAny(loaded, slot->type);
				return callRuntime("yogi_any_to_object", opaquePointer(), {boxed});
			}

			auto *cell = lowerRuntimeObjectCell(property);
			auto *boxed = callRuntime("yogi_cell_get", opaquePointer(), {cell});
			return callRuntime("yogi_any_to_object", opaquePointer(), {boxed});
		}

		return lower(value, opaquePointer(), valueSemanticType(value));
	}

	::llvm::Value *ValueLowerer::lowerAddressableArrayCell(
		const Yogi::Sir::ElementAccessExpression *access
	) {
		const auto *objectSemanticType = valueSemanticType(access->object());
		auto objectKind = resolvedTypeKind(objectSemanticType);
		const auto *arraySemanticType = objectSemanticType;
		auto *array = lower(access->object(), opaquePointer(), objectSemanticType);

		if (objectKind == Yogi::Sir::TypeKind_pointer_type) {
			arraySemanticType = objectSemanticType && objectSemanticType->element_type()
				? objectSemanticType->element_type()
				: access->type();
			array = lowerPointerArrayDescriptor(array, arraySemanticType);
			objectKind = resolvedTypeKind(arraySemanticType);
		}

		const auto *indices = access->indices();
		const auto indexCount = indices && indices->size() > 0 ? indices->size() : 1;
		context.pushMemorySourceLocation(access->position());

		if (isFixedShapeArray(arraySemanticType)) {
			const auto shape = fixedShape(arraySemanticType);
			if (static_cast<size_t>(indexCount) < shape.size()) {
				context.popMemorySourceLocation();
				return ::llvm::ConstantPointerNull::get(opaquePointer());
			}

			auto *offset = fixedShapeLinearOffset(access, shape, static_cast<size_t>(indexCount), false);
			auto *cell = callRuntime("yogi_array_cell", opaquePointer(), {array, offset});
			context.popMemorySourceLocation();
			return cell;
		}

		for (flatbuffers::uoffset_t dimension = 0; dimension + 1 < indexCount; ++dimension) {
			const auto *indexRef = indices && indices->size() > 0
				? indices->Get(dimension)
				: access->index();
			auto *indexValue = lower(indexRef, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(indexRef));
			auto *rowValue = callRuntime("yogi_array_get", opaquePointer(), {array, toIndex(indexValue)});
			array = callRuntime("yogi_any_to_array", opaquePointer(), {rowValue});
		}

		const auto *lastIndexRef = indices && indices->size() > 0
			? indices->Get(indexCount - 1)
			: access->index();
		auto *indexValue = lower(lastIndexRef, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(lastIndexRef));
		auto *cell = callRuntime("yogi_array_cell", opaquePointer(), {array, toIndex(indexValue)});
		context.popMemorySourceLocation();

		return cell;
	}

	::llvm::Value *ValueLowerer::lowerAddressableArrayPointerCell(
		const Yogi::Sir::ElementAccessExpression *access
	) {
		const auto *objectSemanticType = valueSemanticType(access->object());
		auto objectKind = resolvedTypeKind(objectSemanticType);
		const auto *arraySemanticType = objectSemanticType;
		auto *array = lower(access->object(), opaquePointer(), objectSemanticType);

		if (objectKind == Yogi::Sir::TypeKind_pointer_type) {
			arraySemanticType = objectSemanticType && objectSemanticType->element_type()
				? objectSemanticType->element_type()
				: access->type();
			array = lowerPointerArrayDescriptor(array, arraySemanticType);
			objectKind = resolvedTypeKind(arraySemanticType);
		}

		const auto *indices = access->indices();
		const auto indexCount = indices && indices->size() > 0 ? indices->size() : 1;
		context.pushMemorySourceLocation(access->position());

		if (isFixedShapeArray(arraySemanticType)) {
			const auto shape = fixedShape(arraySemanticType);
			if (static_cast<size_t>(indexCount) < shape.size()) {
				context.popMemorySourceLocation();
				return ::llvm::ConstantPointerNull::get(opaquePointer());
			}

			auto *offset = fixedShapeLinearOffset(access, shape, static_cast<size_t>(indexCount), false);
			auto *cell = callRuntime("yogi_array_pointer_cell", opaquePointer(), {array, offset});
			context.popMemorySourceLocation();
			return cell;
		}

		for (flatbuffers::uoffset_t dimension = 0; dimension + 1 < indexCount; ++dimension) {
			const auto *indexRef = indices && indices->size() > 0
				? indices->Get(dimension)
				: access->index();
			auto *indexValue = lower(indexRef, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(indexRef));
			auto *rowValue = callRuntime("yogi_array_get", opaquePointer(), {array, toIndex(indexValue)});
			array = callRuntime("yogi_any_to_array", opaquePointer(), {rowValue});
		}

		const auto *lastIndexRef = indices && indices->size() > 0
			? indices->Get(indexCount - 1)
			: access->index();
		auto *indexValue = lower(lastIndexRef, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(lastIndexRef));
		auto *cell = callRuntime("yogi_array_pointer_cell", opaquePointer(), {array, toIndex(indexValue)});
		context.popMemorySourceLocation();

		return cell;
	}

		::llvm::Value *ValueLowerer::lowerAddressOf(
			const Yogi::Sir::AddressOfExpression *addressOf,
			::llvm::Type *expectedType,
			const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto *target = addressOf->target();
		const auto *element = target ? target->element_access() : nullptr;
		const auto *property = target ? target->property_access() : nullptr;

		if (element) {
			auto *taggedPointer = lowerAddressableArrayPointerCell(element);
			return cast(
				taggedPointer,
				expectedType ? expectedType : opaquePointer(),
				expectedSemanticType ? expectedSemanticType : addressOf->type(),
				addressOf->type()
			);
		}

		if (property) {
			if (auto slot = lowerStructAddressableSlot(target)) {
				const auto slotKind = resolvedTypeKind(slot->type);

				if (
					slotKind == Yogi::Sir::TypeKind_array_type ||
					slotKind == Yogi::Sir::TypeKind_tuple_type
				) {
					auto *loaded = context.builder.CreateLoad(
						opaquePointer(),
						slot->address,
						"addr.aggregate.ptr.load"
					);

					return cast(
						loaded,
						expectedType ? expectedType : opaquePointer(),
						expectedSemanticType ? expectedSemanticType : addressOf->type(),
						addressOf->type()
					);
				}

				return cast(
					slot->address,
					expectedType ? expectedType : opaquePointer(),
					expectedSemanticType ? expectedSemanticType : addressOf->type(),
					addressOf->type()
				);
			}

			auto *taggedPointer = lowerRuntimeObjectCellForPointer(property);
			return cast(
				taggedPointer,
				expectedType ? expectedType : opaquePointer(),
				expectedSemanticType ? expectedSemanticType : addressOf->type(),
				addressOf->type()
			);
		}

		const auto *identifier = target ? target->identifier() : nullptr;
		const auto name = identifier ? fbString(identifier->name()) : "";
		::llvm::Value *address = nullptr;

		if (!name.empty() && context.locals.contains(name)) {
			address = context.locals[name];
		} else if (!name.empty() && context.globals.contains(name)) {
			address = context.globals[name];
		} else if (identifier && identifier->qualified_name()) {
			const auto qualifiedName = fbString(identifier->qualified_name());
			const auto symbolName = "_yogi_" + sanitizeSymbol(qualifiedName);
			address = context.module->getGlobalVariable(symbolName);

			if (!address) {
				auto *type = types.lower(identifier->type());
				address = new ::llvm::GlobalVariable(
					*context.module,
					type,
					false,
					::llvm::GlobalValue::ExternalLinkage,
					nullptr,
					symbolName
				);
			}
		}

		if (!address) {
			return types.zero(expectedType ? expectedType : opaquePointer());
		}

		const auto *pointerType = addressOf->type();
		const auto *pointeeSemanticType = pointerType && pointerType->element_type()
			? pointerType->element_type()
			: nullptr;
		const auto pointeeKind = resolvedTypeKind(pointeeSemanticType);

		if (
			pointeeKind == Yogi::Sir::TypeKind_array_type ||
			pointeeKind == Yogi::Sir::TypeKind_tuple_type
		) {
			auto *loaded = context.builder.CreateLoad(
				opaquePointer(),
				address,
				sanitizeSymbol(name.empty() ? "aggregate" : name) + ".ptr.load"
			);

			return cast(
				loaded,
				expectedType ? expectedType : opaquePointer(),
				expectedSemanticType ? expectedSemanticType : addressOf->type(),
				addressOf->type()
			);
		}

		return cast(
			address,
			expectedType ? expectedType : opaquePointer(),
			expectedSemanticType ? expectedSemanticType : addressOf->type(),
				addressOf->type()
			);
		}

		::llvm::Value *ValueLowerer::lowerDereference(
			const Yogi::Sir::DereferenceExpression *dereference,
			::llvm::Type *expectedType,
			const Yogi::Sir::TypeRef *expectedSemanticType
		) {
			const auto *pointerSemanticType = valueSemanticType(dereference->target());
			auto *pointer = lower(dereference->target(), opaquePointer(), pointerSemanticType);
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : dereference->type();
			auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);
			const auto targetKind = resolvedTypeKind(targetSemanticType);

			if (
				targetKind == Yogi::Sir::TypeKind_array_type ||
				targetKind == Yogi::Sir::TypeKind_tuple_type
			) {
				return lowerPointerRead(pointer, dereference->type(), targetType, targetSemanticType);
			}

			return lowerPointerRead(pointer, dereference->type(), targetType, targetSemanticType);
		}

		::llvm::Value *ValueLowerer::lowerArray(
			const Yogi::Sir::ArrayExpression *array,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto shape = fixedShape(expectedSemanticType);
		const auto fixedLength = isFixedLengthArray(expectedSemanticType);
		const auto hasSpread = arrayContainsSpread(array);
		const auto length = fixedLength
			? fixedShapeElementCount(shape)
			: hasSpread
				? 0
				: static_cast<uint64_t>(array->elements() ? array->elements()->size() : 0);
		context.pushMemorySourceLocation(array->position());
		auto *storageMode = context.builder.CreateGlobalString(arrayStorageModeName(array, expectedSemanticType));
		auto *aggregate = callRuntime(
			"yogi_array_create_with_storage",
			opaquePointer(),
			{
				::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), length),
				storageMode,
			}
		);

		if (isFixedShapeArray(expectedSemanticType)) {
			populateFixedShapeArray(array, aggregate, expectedSemanticType);
		} else {
			populateArray(array, aggregate, hasSpread && !fixedLength);
		}
		context.popMemorySourceLocation();

		return cast(aggregate, expectedType ? expectedType : opaquePointer(), expectedSemanticType, array->type());
	}

	::llvm::Value *ValueLowerer::lowerObject(
		const Yogi::Sir::ObjectExpression *object,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto structName = structTypeName(expectedSemanticType);
		if (!structName.empty() && context.structTypes.contains(structName)) {
			return lowerStructObject(
				object,
				structName,
				context.structTypes[structName],
				context.structFields[structName]
			);
		}

		context.pushMemorySourceLocation(object->position());
		auto *aggregate = callRuntime("yogi_object_create", opaquePointer(), {});

		populateObject(object, aggregate);
		context.popMemorySourceLocation();

		return cast(aggregate, expectedType ? expectedType : opaquePointer(), expectedSemanticType, object->type());
	}

	::llvm::Value *ValueLowerer::lowerStructObject(
		const Yogi::Sir::ObjectExpression *object,
		const std::string &structName,
		::llvm::StructType *structType,
		const std::vector<ModuleLoweringContext::StructFieldInfo> &fields
	) {
		std::map<std::string, const Yogi::Sir::ObjectProperty *> properties;

		if (object->properties()) {
			for (const auto *property: *object->properties()) {
				properties[fbString(property->key())] = property;
			}
		}

		::llvm::Value *result = ::llvm::UndefValue::get(structType);

		for (const auto &field: fields) {
			::llvm::Value *fieldValue = types.zero(types.lower(field.type));

			if (properties.contains(field.name)) {
				const auto *property = properties[field.name];
				fieldValue = cast(
					lower(property->value(), types.lower(field.type), field.type),
					types.lower(field.type),
					field.type,
					property->type()
				);
				if (context.retainEscapedObjectGraph) {
					retainEscapedBorrowedViewSource(property->value(), fieldValue);
					deactivateEscapedAggregateGraphOwner(property->value());
				}
			}

			result = context.builder.CreateInsertValue(
				result,
				fieldValue,
				{static_cast<unsigned>(field.index)},
				"struct." + sanitizeSymbol(field.name)
			);
		}

		emitStructValidateChain(structName, result);

		return result;
	}

	::llvm::Value *ValueLowerer::printStructObject(
		const std::string &structName,
		::llvm::Value *structValue
	) {
		auto *voidType = ::llvm::Type::getVoidTy(context.llvmContext);

		if (
			structName.empty() ||
			!structValue ||
			!context.structFields.contains(structName)
		) {
			auto *value = context.builder.CreateGlobalString("[aggregate]");
			return callRuntime("yogi_print_string", voidType, {value});
		}

		auto *object = callRuntime("yogi_object_create", opaquePointer(), {});

		for (const auto &field: context.structFields[structName]) {
			auto *fieldValue = context.builder.CreateExtractValue(
				structValue,
				{static_cast<unsigned>(field.index)},
				"struct.print." + sanitizeSymbol(field.name)
			);
			auto *boxedValue = boxAny(fieldValue, field.type);
			auto *key = context.builder.CreateGlobalString(field.name);
			callRuntime("yogi_object_set", voidType, {object, key, boxedValue});
		}

		auto *result = callRuntime("yogi_print_object", voidType, {object});
		callRuntime("yogi_object_destroy", voidType, {object});
		return result;
	}

	void ValueLowerer::emitStructValidateChain(const std::string &structName, ::llvm::Value *structValue) {
		if (!context.structValidateChains.contains(structName)) {
			return;
		}

		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *booleanType = ::llvm::Type::getInt1Ty(context.llvmContext);
		auto *voidType = ::llvm::Type::getVoidTy(context.llvmContext);
		auto *pointerType = opaquePointer();

		for (const auto &validatorName: context.structValidateChains[structName]) {
			auto validatorStructName = validatorName;
			const auto separator = validatorStructName.rfind(':');
			if (separator != std::string::npos) {
				validatorStructName = validatorStructName.substr(separator + 1);
			}
			const auto suffix = validatorStructName.rfind(".validate");
			if (suffix != std::string::npos) {
				validatorStructName = validatorStructName.substr(0, suffix);
			}

			const auto symbolName = "_yogi_fn_" + sanitizeSymbol(validatorName);
			auto *validator = context.module->getFunction(symbolName);
			auto *validatorArgument = coerceStructForValidator(
				structName,
				validatorStructName,
				structValue
			);

			if (!validator) {
				std::vector<::llvm::Type *> parameters;
				if (validatorArgument) {
					parameters.push_back(validatorArgument->getType());
				}

				auto *validatorType = ::llvm::FunctionType::get(booleanType, parameters, false);
				validator = ::llvm::Function::Create(
					validatorType,
					::llvm::Function::ExternalLinkage,
					symbolName,
					context.module.get()
				);
			}

			auto *isValid = context.builder.CreateCall(
				validator,
				validatorArgument ? std::vector<::llvm::Value *>{validatorArgument} : std::vector<::llvm::Value *>{},
				"struct.validate." + sanitizeSymbol(validatorName)
			);
			auto *continueBlock = ::llvm::BasicBlock::Create(
				context.llvmContext,
				"struct.validate.continue",
				function
			);
			auto *failedBlock = ::llvm::BasicBlock::Create(
				context.llvmContext,
				"struct.validate.failed",
				function
			);

			context.builder.CreateCondBr(isValid, continueBlock, failedBlock);

			context.builder.SetInsertPoint(failedBlock);
			auto *abort = context.runtimeFunction(
				"yogi_struct_validate_failed",
				voidType,
				{pointerType, pointerType}
			);
			context.builder.CreateCall(
				abort,
				{
					context.builder.CreateGlobalString(structName),
					context.builder.CreateGlobalString(validatorName),
				}
			);
			context.builder.CreateUnreachable();

			context.builder.SetInsertPoint(continueBlock);
		}
	}

	::llvm::Value *ValueLowerer::coerceStructForValidator(
		const std::string &sourceStructName,
		const std::string &targetStructName,
		::llvm::Value *structValue
	) {
		if (!structValue || targetStructName.empty()) {
			return structValue;
		}

		if (sourceStructName == targetStructName) {
			return structValue;
		}

		if (
			!context.structTypes.contains(targetStructName) ||
			!context.structFields.contains(targetStructName)
		) {
			return structValue;
		}

		auto *targetType = context.structTypes[targetStructName];
		::llvm::Value *targetValue = ::llvm::UndefValue::get(targetType);

		for (const auto &field: context.structFields[targetStructName]) {
			auto *fieldValue = context.builder.CreateExtractValue(
				structValue,
				{static_cast<unsigned>(field.index)},
				"struct.validate.project." + sanitizeSymbol(field.name)
			);
			targetValue = context.builder.CreateInsertValue(
				targetValue,
				fieldValue,
				{static_cast<unsigned>(field.index)},
				"struct.validate.parent." + sanitizeSymbol(field.name)
			);
		}

		return targetValue;
	}

	bool ValueLowerer::isAggregateLiteral(const Yogi::Sir::ValueRef *value) const {
		return value && (value->array() || value->object());
	}

	::llvm::Value *ValueLowerer::lowerLocalAggregate(
		const Yogi::Sir::ValueRef *value,
		const std::string &name,
		const Yogi::Sir::TypeRef *declaredType
	) {
		if (!value) {
			return ::llvm::ConstantPointerNull::get(opaquePointer());
		}

		const auto safeName = sanitizeSymbol(name);

		if (const auto *array = value->array()) {
			const auto *arrayType = declaredType ? declaredType : valueSemanticType(value);
			const auto shape = fixedShape(arrayType);
			const auto fixedLength = isFixedLengthArray(arrayType);
			const auto hasSpread = arrayContainsSpread(array);
			const auto length = fixedLength
				? fixedShapeElementCount(shape)
				: hasSpread
					? 0
					: static_cast<uint64_t>(array->elements() ? array->elements()->size() : 0);
			context.pushMemorySourceLocation(array->position());
			auto *size = callRuntime("yogi_array_sizeof", ::llvm::Type::getInt64Ty(context.llvmContext), {});
			auto *storage = context.builder.CreateAlloca(
				::llvm::Type::getInt8Ty(context.llvmContext),
				size,
				safeName + ".array.storage"
			);
			auto *storageMode = context.builder.CreateGlobalString(arrayStorageModeName(array, arrayType));

			callRuntime(
				"yogi_array_init_with_storage",
				::llvm::Type::getVoidTy(context.llvmContext),
				{
					storage,
					::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), length),
					storageMode,
				}
			);
			if (isFixedShapeArray(arrayType)) {
				populateFixedShapeArray(array, storage, arrayType);
			} else {
				populateArray(array, storage, hasSpread && !fixedLength);
			}
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

		const auto structName = structTypeName(type);
		if (!structName.empty()) {
			destroyStructFields(structName, value, false);
			return;
		}

		switch (resolvedTypeKind(type)) {
			case Yogi::Sir::TypeKind_string_type:
				callRuntime("yogi_string_destroy", ::llvm::Type::getVoidTy(context.llvmContext), {value});
				return;

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

		const auto structName = structTypeName(type);
		if (!structName.empty()) {
			destroyStructFields(structName, value, true);
			return;
		}

		switch (resolvedTypeKind(type)) {
			case Yogi::Sir::TypeKind_string_type:
				callRuntime("yogi_string_destroy", ::llvm::Type::getVoidTy(context.llvmContext), {value});
				return;

			case Yogi::Sir::TypeKind_array_type:
			case Yogi::Sir::TypeKind_tuple_type:
				callRuntime("yogi_array_destroy", ::llvm::Type::getVoidTy(context.llvmContext), {value});
				return;

			case Yogi::Sir::TypeKind_type_literal:
				callRuntime("yogi_object_destroy", ::llvm::Type::getVoidTy(context.llvmContext), {value});
				return;

			case Yogi::Sir::TypeKind_type_reference:
				return;

			default:
				return;
		}
	}

	bool ValueLowerer::isStructType(const Yogi::Sir::TypeRef *type) const {
		return !structTypeName(type).empty();
	}

	void ValueLowerer::destroyStructFields(
		const std::string &structName,
		::llvm::Value *structValue,
		bool escaped
	) {
		if (
			structName.empty() ||
			!structValue ||
			!context.structFields.contains(structName)
		) {
			return;
		}

		for (const auto &field: context.structFields[structName]) {
			if (!field.type) {
				continue;
			}

			const auto fieldStructName = structTypeName(field.type);
			const auto fieldKind = resolvedTypeKind(field.type);
			const auto shouldDestroy =
				!fieldStructName.empty() ||
				fieldKind == Yogi::Sir::TypeKind_string_type ||
				fieldKind == Yogi::Sir::TypeKind_array_type ||
				fieldKind == Yogi::Sir::TypeKind_tuple_type ||
				fieldKind == Yogi::Sir::TypeKind_type_literal;

			if (!shouldDestroy) {
				continue;
			}

			auto *fieldValue = context.builder.CreateExtractValue(
				structValue,
				{static_cast<unsigned>(field.index)},
				"struct.destroy." + sanitizeSymbol(field.name)
			);

			destroyEscapedAggregate(field.type, fieldValue);
		}
	}

	void ValueLowerer::populateArray(
		const Yogi::Sir::ArrayExpression *array,
		::llvm::Value *aggregate,
		bool appendMode
	) {
		if (!array->elements()) {
			return;
		}

		auto *i64 = ::llvm::Type::getInt64Ty(context.llvmContext);
		auto *voidType = ::llvm::Type::getVoidTy(context.llvmContext);
		auto *targetIndexSlot = context.builder.CreateAlloca(i64, nullptr, "array.literal.index");
		context.builder.CreateStore(::llvm::ConstantInt::get(i64, 0), targetIndexSlot);

		const auto emitBoxedValue = [&](::llvm::Value *boxedValue) {
			if (appendMode) {
				callRuntime("yogi_array_push", i64, {aggregate, boxedValue});
				return;
			}

			auto *targetIndex = context.builder.CreateLoad(i64, targetIndexSlot, "array.literal.target");
			callRuntime("yogi_array_set", voidType, {aggregate, targetIndex, boxedValue});
			auto *nextTargetIndex = context.builder.CreateAdd(
				targetIndex,
				::llvm::ConstantInt::get(i64, 1),
				"array.literal.next.target"
			);
			context.builder.CreateStore(nextTargetIndex, targetIndexSlot);
		};

		for (const auto *element: *array->elements()) {
			if (const auto *spread = element ? element->spread() : nullptr) {
				auto *sourceArray = lower(spread->expression(), opaquePointer(), spread->type());
				auto *sourceLength = callRuntime("yogi_array_length", i64, {sourceArray});
				auto *function = context.builder.GetInsertBlock()->getParent();
				auto *conditionBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.spread.cond", function);
				auto *bodyBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.spread.body", function);
				auto *afterBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.spread.done", function);
				auto *sourceIndexSlot = context.builder.CreateAlloca(i64, nullptr, "array.spread.index");
				context.builder.CreateStore(::llvm::ConstantInt::get(i64, 0), sourceIndexSlot);
				context.builder.CreateBr(conditionBlock);

				context.builder.SetInsertPoint(conditionBlock);
				auto *sourceIndex = context.builder.CreateLoad(i64, sourceIndexSlot, "array.spread.i");
				auto *hasMore = context.builder.CreateICmpULT(sourceIndex, sourceLength, "array.spread.more");
				context.builder.CreateCondBr(hasMore, bodyBlock, afterBlock);

				context.builder.SetInsertPoint(bodyBlock);
				auto *boxedElement = callRuntime("yogi_array_get", opaquePointer(), {sourceArray, sourceIndex});
				emitBoxedValue(boxedElement);
				auto *nextSourceIndex = context.builder.CreateAdd(
					sourceIndex,
					::llvm::ConstantInt::get(i64, 1),
					"array.spread.next"
				);
				context.builder.CreateStore(nextSourceIndex, sourceIndexSlot);
				context.builder.CreateBr(conditionBlock);

				context.builder.SetInsertPoint(afterBlock);
				continue;
			}

			const auto *elementType = valueSemanticType(element);
			auto *elementValue = lower(element, types.lower(elementType), elementType);
			if (context.retainEscapedObjectGraph) {
				retainEscapedBorrowedViewSource(element, elementValue);
				deactivateEscapedAggregateGraphOwner(element);
			}
			auto *boxedValue = boxAny(elementValue, elementType);
			emitBoxedValue(boxedValue);
		}
	}

	void ValueLowerer::populateFixedShapeArray(
		const Yogi::Sir::ArrayExpression *array,
		::llvm::Value *aggregate,
		const Yogi::Sir::TypeRef *arrayType
	) {
		uint64_t flatIndex = 0;
		const auto *elementType = arrayType ? arrayType->element_type() : nullptr;
		const std::function<void(const Yogi::Sir::ArrayExpression *)> emitElements =
			[&](const Yogi::Sir::ArrayExpression *current) {
				if (!current || !current->elements()) {
					return;
				}

				for (const auto *element: *current->elements()) {
					if (const auto *nestedArray = element ? element->array() : nullptr) {
						emitElements(nestedArray);
						continue;
					}

					const auto *actualType = valueSemanticType(element);
					const auto *lowerType = actualType ? actualType : elementType;
					const auto *boxedType = lowerType;
					auto *elementValue = lower(element, types.lower(lowerType), lowerType);
					auto *boxedValue = boxAny(elementValue, boxedType);
					callRuntime(
						"yogi_array_set",
						::llvm::Type::getVoidTy(context.llvmContext),
						{
							aggregate,
							::llvm::ConstantInt::get(::llvm::Type::getInt64Ty(context.llvmContext), flatIndex++),
							boxedValue,
						}
					);
				}
			};

		emitElements(array);
	}

	bool ValueLowerer::isFixedShapeArray(const Yogi::Sir::TypeRef *type) const {
		return type &&
			type->kind() == Yogi::Sir::TypeKind_array_type &&
			type->fixed() &&
			type->shape() &&
			type->shape()->size() > 1;
	}

	bool ValueLowerer::isFixedLengthArray(const Yogi::Sir::TypeRef *type) const {
		return type &&
			type->kind() == Yogi::Sir::TypeKind_array_type &&
			type->fixed() &&
			type->shape() &&
			type->shape()->size() > 0;
	}

	bool ValueLowerer::arrayContainsSpread(const Yogi::Sir::ArrayExpression *array) const {
		if (!array || !array->elements()) {
			return false;
		}

		for (const auto *element: *array->elements()) {
			if (!element) {
				continue;
			}

			if (element->spread()) {
				return true;
			}

			if (const auto *nestedArray = element->array()) {
				if (arrayContainsSpread(nestedArray)) {
					return true;
				}
			}
		}

		return false;
	}

	std::string ValueLowerer::arrayStorageModeName(
		const Yogi::Sir::ArrayExpression *array,
		const Yogi::Sir::TypeRef *arrayType
	) const {
		if (isFixedLengthArray(arrayType)) {
			return "contiguous_fast_path";
		}

		const auto *mode = array ? array->storage_mode() : nullptr;
		const auto value = mode ? mode->str() : "";

		return value == "pointer_safe_chunked_mode"
			? "pointer_safe_chunked_mode"
			: "contiguous_fast_path";
	}

	std::vector<int64_t> ValueLowerer::fixedShape(const Yogi::Sir::TypeRef *type) const {
		std::vector<int64_t> result;

		if (!type || !type->shape()) {
			return result;
		}

		for (const auto dimension: *type->shape()) {
			result.push_back(static_cast<int64_t>(dimension));
		}

		return result;
	}

	uint64_t ValueLowerer::fixedShapeElementCount(const std::vector<int64_t> &shape, size_t start) const {
		uint64_t count = 1;

		for (size_t index = start; index < shape.size(); ++index) {
			count *= static_cast<uint64_t>(shape[index]);
		}

		return count;
	}

	::llvm::Value *ValueLowerer::fixedShapeLinearOffset(
		const Yogi::Sir::ElementAccessExpression *access,
		const std::vector<int64_t> &shape,
		size_t consumedDimensions,
		bool sliceStart
	) {
		auto *i64 = ::llvm::Type::getInt64Ty(context.llvmContext);
		::llvm::Value *offset = ::llvm::ConstantInt::get(i64, 0);
		const auto *indices = access->indices();

		for (size_t dimension = 0; dimension < consumedDimensions; ++dimension) {
			const auto *indexRef = indices && indices->size() > 0
				? indices->Get(static_cast<flatbuffers::uoffset_t>(dimension))
				: access->index();
			auto *indexValue = lower(indexRef, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(indexRef));
			auto *index = toIndex(indexValue);
			auto *dimensionSize = ::llvm::ConstantInt::get(i64, static_cast<uint64_t>(shape[dimension]));
			auto *inBounds = context.builder.CreateICmpULT(index, dimensionSize, "array.shape.inbounds");
			auto *inBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.shape.ok", context.builder.GetInsertBlock()->getParent());
			auto *abortBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.shape.abort", context.builder.GetInsertBlock()->getParent());
			context.builder.CreateCondBr(inBounds, inBlock, abortBlock);

			context.builder.SetInsertPoint(abortBlock);
			context.pushMemorySourceLocation(access->position());
			auto *operationString = context.builder.CreateGlobalString("array subscript");
			callRuntime("yogi_runtime_abort_range", ::llvm::Type::getVoidTy(context.llvmContext), {operationString, index, dimensionSize});
			context.builder.CreateUnreachable();

			context.builder.SetInsertPoint(inBlock);
			offset = context.builder.CreateAdd(
				context.builder.CreateMul(offset, dimensionSize, "array.shape.stride.mul"),
				index,
				"array.shape.offset"
			);
		}

		if (sliceStart && consumedDimensions < shape.size()) {
			auto *remaining = ::llvm::ConstantInt::get(i64, fixedShapeElementCount(shape, consumedDimensions));
			offset = context.builder.CreateMul(offset, remaining, "array.shape.slice.start");
		}

		return offset;
	}

	::llvm::Value *ValueLowerer::createBorrowedFixedShapeView(
		::llvm::Value *array,
		::llvm::Value *startOffset,
		uint64_t length
	) {
		auto *i64 = ::llvm::Type::getInt64Ty(context.llvmContext);
		return callRuntime(
			"yogi_array_view",
			opaquePointer(),
			{
				array,
				startOffset,
				::llvm::ConstantInt::get(i64, length),
			}
		);
	}

	void ValueLowerer::copyFixedShapeSlice(
		::llvm::Value *targetArray,
		::llvm::Value *targetStart,
		::llvm::Value *sourceArray,
		uint64_t length
	) {
		auto *i64 = ::llvm::Type::getInt64Ty(context.llvmContext);
		auto *voidType = ::llvm::Type::getVoidTy(context.llvmContext);

		for (uint64_t index = 0; index < length; ++index) {
			auto *sourceIndex = ::llvm::ConstantInt::get(i64, index);
			auto *targetIndex = context.builder.CreateAdd(
				targetStart,
				sourceIndex,
				"array.shape.slice.copy.index"
			);
			auto *boxedValue = callRuntime("yogi_array_get", opaquePointer(), {sourceArray, sourceIndex});
			callRuntime("yogi_array_set", voidType, {targetArray, targetIndex, boxedValue});
		}
	}

	void ValueLowerer::populateObject(const Yogi::Sir::ObjectExpression *object, ::llvm::Value *aggregate) {
		if (object->properties()) {
			for (const auto *property: *object->properties()) {
				const auto *propertyType = property->type();
				auto *value = lower(property->value(), types.lower(propertyType), propertyType);
				if (context.retainEscapedObjectGraph) {
					retainEscapedBorrowedViewSource(property->value(), value);
					deactivateEscapedAggregateGraphOwner(property->value());
				}
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

		if (propertyName == "length" && objectKind == Yogi::Sir::TypeKind_pointer_type) {
			const auto *pointeeSemanticType = objectSemanticType && objectSemanticType->element_type()
				? objectSemanticType->element_type()
				: nullptr;
			const auto pointeeKind = resolvedTypeKind(pointeeSemanticType);

			if (
				pointeeKind == Yogi::Sir::TypeKind_array_type ||
				pointeeKind == Yogi::Sir::TypeKind_tuple_type
			) {
				auto *pointer = lower(access->object(), opaquePointer(), objectSemanticType);
				auto *array = lowerPointerArrayDescriptor(pointer, pointeeSemanticType);
				auto *length = callRuntime("yogi_array_length", ::llvm::Type::getInt64Ty(context.llvmContext), {array});
				auto *asNumber = context.builder.CreateUIToFP(
					length,
					::llvm::Type::getDoubleTy(context.llvmContext),
					"ptr.array.length"
				);
				const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
				auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

				return cast(asNumber, targetType, targetSemanticType, access->type());
			}
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

		if (auto fieldPointer = lowerPointerStructFieldPointer(access)) {
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
			auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

			return lowerPointerRead(fieldPointer->first, fieldPointer->second, targetType, targetSemanticType);
		}

		if (auto slot = lowerStructAddressableSlot(access)) {
			auto *value = context.builder.CreateLoad(
				types.lower(slot->type),
				slot->address,
				"struct.field.load." + sanitizeSymbol(propertyName)
			);
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
			auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

			return cast(value, targetType, targetSemanticType, slot->type);
		}

		const auto structName = structTypeName(objectSemanticType);
		if (!structName.empty() && context.structTypes.contains(structName)) {
			auto *structType = context.structTypes[structName];
			auto *object = lower(access->object(), structType, objectSemanticType);

			for (const auto &field: context.structFields[structName]) {
				if (field.name != propertyName) {
					continue;
				}

				auto *value = context.builder.CreateExtractValue(
					object,
					{static_cast<unsigned>(field.index)},
					"struct.field." + sanitizeSymbol(field.name)
				);
				const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
				auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

				return cast(value, targetType, targetSemanticType, field.type);
			}
		}

		auto *object = lowerRuntimeObjectValue(access->object());
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
		if (objectKind == Yogi::Sir::TypeKind_pointer_type) {
			auto *pointer = lower(access->object(), opaquePointer(), objectSemanticType);
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
			auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);
			const auto *pointeeSemanticType = objectSemanticType && objectSemanticType->element_type()
				? objectSemanticType->element_type()
				: access->type();

			if (resolvedTypeKind(pointeeSemanticType) == Yogi::Sir::TypeKind_array_type) {
				auto *array = lowerPointerArrayDescriptor(pointer, pointeeSemanticType);
				const auto *indices = access->indices();
				const auto indexCount = indices && indices->size() > 0 ? indices->size() : 1;
				::llvm::Value *boxedValue = nullptr;

				if (isFixedLengthArray(pointeeSemanticType)) {
					const auto shape = fixedShape(pointeeSemanticType);
					const auto consumedDimensions = static_cast<size_t>(indexCount);

					if (consumedDimensions < shape.size()) {
						auto *startOffset = fixedShapeLinearOffset(access, shape, consumedDimensions, true);
						auto *view = createBorrowedFixedShapeView(
							array,
							startOffset,
							fixedShapeElementCount(shape, consumedDimensions)
						);
						return cast(view, targetType, targetSemanticType, targetSemanticType);
					}

					auto *offset = fixedShapeLinearOffset(access, shape, consumedDimensions, false);
					boxedValue = callRuntime("yogi_array_get", opaquePointer(), {array, offset});
				} else {
					const auto *indexRef = indices && indices->size() > 0
						? indices->Get(0)
						: access->index();
					auto *indexValue = lower(indexRef, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(indexRef));
					auto *index = toIndex(indexValue);
					auto *length = callRuntime("yogi_array_length", ::llvm::Type::getInt64Ty(context.llvmContext), {array});
					auto *inBounds = context.builder.CreateICmpULT(index, length, "ptr.array.elem.inbounds");
					auto *inBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.array.elem.ok", context.builder.GetInsertBlock()->getParent());
					auto *abortBlock = ::llvm::BasicBlock::Create(context.llvmContext, "ptr.array.elem.abort", context.builder.GetInsertBlock()->getParent());
					context.builder.CreateCondBr(inBounds, inBlock, abortBlock);

					context.builder.SetInsertPoint(abortBlock);
					context.pushMemorySourceLocation(access->position());
					auto *operationString = context.builder.CreateGlobalString("array subscript");
					callRuntime("yogi_runtime_abort_range", ::llvm::Type::getVoidTy(context.llvmContext), {operationString, index, length});
					context.builder.CreateUnreachable();

					context.builder.SetInsertPoint(inBlock);
					boxedValue = callRuntime("yogi_array_get", opaquePointer(), {array, index});
				}

				return cast(unboxAny(boxedValue, targetSemanticType), targetType, targetSemanticType, targetSemanticType);
			}

			return lowerPointerRead(pointer, pointeeSemanticType, targetType, targetSemanticType);
		}

		if (objectKind == Yogi::Sir::TypeKind_string_type) {
			auto *text = lower(access->object(), opaquePointer(), objectSemanticType);
			auto *indexValue = lower(access->index(), ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(access->index()));
			auto *character = callRuntime("yogi_string_at", opaquePointer(), {text, toIndex(indexValue)});
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
			auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

			return cast(character, targetType, targetSemanticType, targetSemanticType);
		}

		auto *array = lower(access->object(), opaquePointer(), objectSemanticType);
		const auto *indices = access->indices();
		const auto indexCount = indices && indices->size() > 0 ? indices->size() : 1;

		if (isFixedShapeArray(objectSemanticType)) {
			const auto shape = fixedShape(objectSemanticType);
			const auto consumedDimensions = static_cast<size_t>(indexCount);
			const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
			auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

			if (consumedDimensions < shape.size()) {
				auto *startOffset = fixedShapeLinearOffset(access, shape, consumedDimensions, true);
				auto *view = createBorrowedFixedShapeView(array, startOffset, fixedShapeElementCount(shape, consumedDimensions));
				return cast(view, targetType, targetSemanticType, targetSemanticType);
			}

			auto *offset = fixedShapeLinearOffset(access, shape, consumedDimensions, false);
			auto *boxedValue = callRuntime("yogi_array_get", opaquePointer(), {array, offset});
			return cast(unboxAny(boxedValue, targetSemanticType), targetType, targetSemanticType, targetSemanticType);
		}

		auto *boxedValue = static_cast<::llvm::Value *>(nullptr);

		for (flatbuffers::uoffset_t dimension = 0; dimension < indexCount; ++dimension) {
			const auto *indexRef = indices && indices->size() > 0
				? indices->Get(dimension)
				: access->index();
			auto *indexValue = lower(indexRef, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(indexRef));
			auto *index = toIndex(indexValue);
			auto *length = callRuntime("yogi_array_length", ::llvm::Type::getInt64Ty(context.llvmContext), {array});
			auto *inBounds = context.builder.CreateICmpULT(index, length, "array.elem.inbounds");
			auto *inBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.elem.ok", context.builder.GetInsertBlock()->getParent());
			auto *abortBlock = ::llvm::BasicBlock::Create(context.llvmContext, "array.elem.abort", context.builder.GetInsertBlock()->getParent());
			context.builder.CreateCondBr(inBounds, inBlock, abortBlock);

			context.builder.SetInsertPoint(abortBlock);
			context.pushMemorySourceLocation(access->position());
			auto *operationString = context.builder.CreateGlobalString("array subscript");
			callRuntime("yogi_runtime_abort_range", ::llvm::Type::getVoidTy(context.llvmContext), {operationString, index, length});
			context.builder.CreateUnreachable();

			context.builder.SetInsertPoint(inBlock);
			boxedValue = callRuntime("yogi_array_get", opaquePointer(), {array, index});

			if (dimension + 1 < indexCount) {
				array = callRuntime("yogi_any_to_array", opaquePointer(), {boxedValue});
			}
		}

		const auto *targetSemanticType = expectedSemanticType ? expectedSemanticType : access->type();
		auto *targetType = expectedType ? expectedType : types.lower(targetSemanticType);

		return cast(unboxAny(boxedValue, targetSemanticType), targetType, targetSemanticType, targetSemanticType);
	}

	::llvm::Value *ValueLowerer::lowerAggregateAssignment(
		const Yogi::Sir::AggregateAssignmentExpression *assignment
	) {
		const auto *target = assignment->target();
		const auto *rightType = valueSemanticType(assignment->right());
		const auto targetRoot = rootIdentifierName(target);
		const auto targetEscapes =
			!targetRoot.empty() &&
			context.globals.contains(targetRoot) &&
			isAggregateLiteral(assignment->right());
		auto *rightValue = targetEscapes
			? lowerWithEscapedObjectGraphRetention(assignment->right(), types.lower(rightType), rightType)
			: lower(assignment->right(), types.lower(rightType), rightType);
		const auto rightKind = resolvedTypeKind(rightType);
		if (
			rightKind == Yogi::Sir::TypeKind_array_type ||
			rightKind == Yogi::Sir::TypeKind_tuple_type
		) {
			retainEscapedBorrowedViewSource(assignment->right(), rightValue);
		}

			if (const auto *dereference = target ? target->dereference() : nullptr) {
				auto *pointer = lower(
					dereference->target(),
					opaquePointer(),
					valueSemanticType(dereference->target())
				);
				lowerPointerWrite(pointer, rightValue, dereference->type(), rightType);
				return cast(rightValue, types.lower(assignment->type()), assignment->type(), rightType);
			}

			if (const auto *element = target ? target->element_access() : nullptr) {
				const auto *objectType = valueSemanticType(element->object());
				if (resolvedTypeKind(objectType) == Yogi::Sir::TypeKind_pointer_type) {
				auto *pointer = lower(element->object(), opaquePointer(), objectType);
				const auto *pointeeSemanticType = objectType && objectType->element_type()
					? objectType->element_type()
					: element->type();

				if (resolvedTypeKind(pointeeSemanticType) == Yogi::Sir::TypeKind_array_type) {
					auto *array = lowerPointerArrayDescriptor(pointer, pointeeSemanticType);
					const auto *indices = element->indices();
					const auto indexCount = indices && indices->size() > 0 ? indices->size() : 1;
					context.pushMemorySourceLocation(element->position());

					if (isFixedLengthArray(pointeeSemanticType)) {
						const auto shape = fixedShape(pointeeSemanticType);
						if (static_cast<size_t>(indexCount) < shape.size()) {
							auto *startOffset = fixedShapeLinearOffset(
								element,
								shape,
								static_cast<size_t>(indexCount),
								true
							);
							copyFixedShapeSlice(
								array,
								startOffset,
								rightValue,
								fixedShapeElementCount(shape, static_cast<size_t>(indexCount))
							);
							context.popMemorySourceLocation();
							return cast(rightValue, types.lower(assignment->type()), assignment->type(), rightType);
						}

						auto *boxedValue = boxAny(rightValue, rightType);
						auto *offset = fixedShapeLinearOffset(element, shape, static_cast<size_t>(indexCount), false);
						callRuntime("yogi_array_set", ::llvm::Type::getVoidTy(context.llvmContext), {array, offset, boxedValue});
						context.popMemorySourceLocation();
						return cast(rightValue, types.lower(assignment->type()), assignment->type(), rightType);
					}

					auto *boxedValue = boxAny(rightValue, rightType);
					const auto *indexRef = indices && indices->size() > 0
						? indices->Get(0)
						: element->index();
					auto *indexValue = lower(indexRef, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(indexRef));
					callRuntime("yogi_array_set", ::llvm::Type::getVoidTy(context.llvmContext), {array, toIndex(indexValue), boxedValue});
					context.popMemorySourceLocation();
					return cast(rightValue, types.lower(assignment->type()), assignment->type(), rightType);
				}

				lowerPointerWrite(pointer, rightValue, element->type(), rightType);
				return cast(rightValue, types.lower(assignment->type()), assignment->type(), rightType);
			}
		}

		if (const auto *property = target ? target->property_access() : nullptr) {
			if (auto fieldPointer = lowerPointerStructFieldPointer(property)) {
				lowerPointerWrite(fieldPointer->first, rightValue, fieldPointer->second, rightType);
				return cast(rightValue, types.lower(property->type()), property->type(), rightType);
			}

			if (auto slot = lowerStructAddressableSlot(target)) {
				const auto slotStructName = structTypeName(slot->type);
				const auto slotKind = resolvedTypeKind(slot->type);
				const auto slotOwnsResource =
					!slotStructName.empty() ||
					slotKind == Yogi::Sir::TypeKind_string_type ||
					slotKind == Yogi::Sir::TypeKind_array_type ||
					slotKind == Yogi::Sir::TypeKind_tuple_type ||
					slotKind == Yogi::Sir::TypeKind_type_literal;

				if (slotOwnsResource) {
					auto *previousValue = context.builder.CreateLoad(
						types.lower(slot->type),
						slot->address,
						"struct.assign.previous." + sanitizeSymbol(fbString(property->property()))
					);
					destroyEscapedAggregate(slot->type, previousValue);
				}

				auto *fieldValue = cast(
					rightValue,
					types.lower(slot->type),
					slot->type,
					rightType
				);

				context.builder.CreateStore(fieldValue, slot->address);
				const auto rightName = identifierName(assignment->right());
				if (!rightName.empty()) {
					context.deactivateAggregateOwner(rightName);
				}
				return cast(fieldValue, types.lower(property->type()), property->type(), slot->type);
				}

				auto *cell = lowerRuntimeObjectCell(property);
				lowerPointerWrite(tagRuntimeCellPointer(cell), rightValue, property->type(), rightType);
			const auto objectName = identifierName(property->object());
			const auto rightName = identifierName(assignment->right());

			if (!objectName.empty() && context.globals.contains(objectName) && !rightName.empty()) {
				context.deactivateAggregateOwner(rightName);
			}

			return cast(rightValue, types.lower(property->type()), property->type(), rightType);
		}

		if (const auto *element = target ? target->element_access() : nullptr) {
			auto *array = lower(element->object(), opaquePointer(), valueSemanticType(element->object()));
			const auto *objectSemanticType = valueSemanticType(element->object());
			const auto *indices = element->indices();
			const auto indexCount = indices && indices->size() > 0 ? indices->size() : 1;
			context.pushMemorySourceLocation(element->position());

			if (isFixedShapeArray(objectSemanticType)) {
				const auto shape = fixedShape(objectSemanticType);
				if (static_cast<size_t>(indexCount) < shape.size()) {
					auto *startOffset = fixedShapeLinearOffset(
						element,
						shape,
						static_cast<size_t>(indexCount),
						true
					);
					copyFixedShapeSlice(
						array,
						startOffset,
						rightValue,
						fixedShapeElementCount(shape, static_cast<size_t>(indexCount))
					);
					context.popMemorySourceLocation();
					return cast(rightValue, types.lower(element->type()), element->type(), rightType);
				}

				auto *boxedValue = boxAny(rightValue, rightType);
				auto *offset = fixedShapeLinearOffset(element, shape, static_cast<size_t>(indexCount), false);
				callRuntime("yogi_array_set", ::llvm::Type::getVoidTy(context.llvmContext), {array, offset, boxedValue});
				context.popMemorySourceLocation();
				return cast(rightValue, types.lower(element->type()), element->type(), rightType);
			}

			auto *boxedValue = boxAny(rightValue, rightType);
			for (flatbuffers::uoffset_t dimension = 0; dimension + 1 < indexCount; ++dimension) {
				const auto *indexRef = indices->Get(dimension);
				auto *indexValue = lower(indexRef, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(indexRef));
				auto *rowValue = callRuntime("yogi_array_get", opaquePointer(), {array, toIndex(indexValue)});
				array = callRuntime("yogi_any_to_array", opaquePointer(), {rowValue});
			}

			const auto *lastIndexRef = indices && indices->size() > 0
				? indices->Get(indexCount - 1)
				: element->index();
			auto *indexValue = lower(lastIndexRef, ::llvm::Type::getDoubleTy(context.llvmContext), valueSemanticType(lastIndexRef));
			callRuntime("yogi_array_set", ::llvm::Type::getVoidTy(context.llvmContext), {array, toIndex(indexValue), boxedValue});
			context.popMemorySourceLocation();
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

		const auto targetKind = resolvedTypeKind(targetSemanticType);
		if (
			targetKind == Yogi::Sir::TypeKind_array_type &&
			!isFixedLengthArray(targetSemanticType) &&
			targetType->isPointerTy()
		) {
			const auto receiverReturningArrayMethod = [](const Yogi::Sir::ValueRef *value) {
				const auto *call = value ? value->call() : nullptr;
				if (!call || !call->builtin_method()) {
					return false;
				}

				const auto method = fbString(call->builtin_method());
				return method == "array.reverse" ||
					method == "array.fill" ||
					method == "array.copyWithin" ||
					method == "array.sort";
			};
			const auto *right = assignment->right();
			const auto shouldDestroySource =
				isAggregateLiteral(right) ||
				(right && right->call() && !receiverReturningArrayMethod(right));
			const auto shouldRetainGraph = targetIsGlobal && isAggregateLiteral(right);
			auto *source = cast(
				shouldRetainGraph
					? lowerWithEscapedObjectGraphRetention(right, targetType, targetSemanticType)
					: lower(right, targetType, targetSemanticType),
				targetType,
				targetSemanticType,
				targetSemanticType
			);
			auto *previousValue = context.builder.CreateLoad(
				targetType,
				target,
				sanitizeSymbol(name) + ".array.previous"
			);
			auto *hasPrevious = context.builder.CreateIsNotNull(previousValue);
			auto *sameArray = context.builder.CreateICmpEQ(
				previousValue,
				source,
				sanitizeSymbol(name) + ".array.same"
			);
			auto *shouldReplace = context.builder.CreateAnd(
				hasPrevious,
				context.builder.CreateNot(sameArray),
				sanitizeSymbol(name) + ".array.should_replace"
			);
			auto *function = context.builder.GetInsertBlock()->getParent();
			auto *replaceBlock = ::llvm::BasicBlock::Create(
				context.llvmContext,
				sanitizeSymbol(name) + ".array.replace",
				function
			);
			auto *storeBlock = ::llvm::BasicBlock::Create(
				context.llvmContext,
				sanitizeSymbol(name) + ".array.store",
				function
			);
			auto *mergeBlock = ::llvm::BasicBlock::Create(
				context.llvmContext,
				sanitizeSymbol(name) + ".array.assignment.done",
				function
			);

			context.builder.CreateCondBr(shouldReplace, replaceBlock, storeBlock);

			context.builder.SetInsertPoint(replaceBlock);
			callRuntime("yogi_array_replace_from", ::llvm::Type::getVoidTy(context.llvmContext), {previousValue, source});
			if (shouldDestroySource) {
				destroyEscapedAggregate(targetSemanticType, source);
			}
			context.builder.CreateBr(mergeBlock);

			context.builder.SetInsertPoint(storeBlock);
			context.builder.CreateStore(source, target);
			context.builder.CreateBr(mergeBlock);

			context.builder.SetInsertPoint(mergeBlock);
			return context.builder.CreateLoad(targetType, target, sanitizeSymbol(name) + ".array.assignment.value");
		}

		const auto retainGraph = targetIsGlobal && isAggregateLiteral(assignment->right());
		auto *value = cast(
			retainGraph
				? lowerWithEscapedObjectGraphRetention(assignment->right(), targetType, targetSemanticType)
				: lower(assignment->right(), targetType, targetSemanticType),
			targetType,
			targetSemanticType,
			targetSemanticType
		);

		const auto targetIsAggregate =
			targetKind == Yogi::Sir::TypeKind_array_type ||
			targetKind == Yogi::Sir::TypeKind_tuple_type ||
			targetKind == Yogi::Sir::TypeKind_type_literal ||
			targetKind == Yogi::Sir::TypeKind_type_reference ||
			targetKind == Yogi::Sir::TypeKind_string_type;

		if (
			targetIsGlobal &&
			targetIsAggregate &&
			(
				targetKind == Yogi::Sir::TypeKind_array_type ||
				targetKind == Yogi::Sir::TypeKind_tuple_type
			)
		) {
			retainEscapedBorrowedViewSource(assignment->right(), value);
		}

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

		if (!targetIsGlobal && targetKind == Yogi::Sir::TypeKind_string_type && targetType->isPointerTy()) {
			auto *previousValue = context.builder.CreateLoad(
				targetType,
				target,
				sanitizeSymbol(name) + ".local.previous"
			);
			auto *hasPrevious = context.builder.CreateIsNotNull(previousValue);
			auto *isReplacement = context.builder.CreateICmpNE(previousValue, value);
			auto *shouldDestroyPrevious = context.builder.CreateAnd(
				hasPrevious,
				isReplacement,
				sanitizeSymbol(name) + ".local.should_destroy"
			);
			auto *currentBlock = context.builder.GetInsertBlock();
			auto *function = currentBlock->getParent();
			auto *destroyBlock = ::llvm::BasicBlock::Create(
				context.llvmContext,
				sanitizeSymbol(name) + ".local.replace.destroy",
				function
			);
			auto *storeBlock = ::llvm::BasicBlock::Create(
				context.llvmContext,
				sanitizeSymbol(name) + ".local.replace.store",
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
			auto *result = callRuntime(
				"yogi_string_concat",
				opaquePointer(),
				{left, right}
			);
			destroyStringTemporaryIfOwned(left, binary->left());
			destroyStringTemporaryIfOwned(right, binary->right());

			return result;
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

		if (
			(op == "==" || op == "===" || op == "!=" || op == "!==") &&
			resolvedTypeKind(leftSemanticType) == Yogi::Sir::TypeKind_string_type &&
			resolvedTypeKind(rightSemanticType) == Yogi::Sir::TypeKind_string_type
		) {
			auto *result = callRuntime("yogi_string_equals", ::llvm::Type::getInt1Ty(context.llvmContext), {left, right});
			destroyStringTemporaryIfOwned(left, binary->left());
			destroyStringTemporaryIfOwned(right, binary->right());
			return (op == "==" || op == "===") ? result : context.builder.CreateNot(result, "string.netmp");
		}

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

	::llvm::Value *ValueLowerer::toNumber(::llvm::Value *value, const Yogi::Sir::TypeRef *semanticType) {
		if (value->getType()->isDoubleTy()) {
			return value;
		}

		if (value->getType()->isIntegerTy(1)) {
			return context.builder.CreateUIToFP(value, ::llvm::Type::getDoubleTy(context.llvmContext), "booltofptmp");
		}

		if (value->getType()->isIntegerTy()) {
			if (isSignedIntegerSemanticType(semanticType)) {
				return context.builder.CreateSIToFP(value, ::llvm::Type::getDoubleTy(context.llvmContext), "inttodouble");
			}

			return context.builder.CreateUIToFP(value, ::llvm::Type::getDoubleTy(context.llvmContext), "uinttodouble");
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

	bool ValueLowerer::isOwnedStringExpression(const Yogi::Sir::ValueRef *value) const {
		if (!value) {
			return false;
		}

		if (value->constant() || value->identifier()) {
			return false;
		}

		return resolvedTypeKind(valueSemanticType(value)) == Yogi::Sir::TypeKind_string_type;
	}

	void ValueLowerer::destroyStringTemporary(::llvm::Value *value) {
		if (!value || !value->getType()->isPointerTy()) {
			return;
		}

		callRuntime("yogi_string_destroy", ::llvm::Type::getVoidTy(context.llvmContext), {value});
	}

	void ValueLowerer::destroyStringTemporaryIfOwned(
		::llvm::Value *value,
		const Yogi::Sir::ValueRef *source
	) {
		if (!isOwnedStringExpression(source)) {
			return;
		}

		destroyStringTemporary(value);
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
			return toNumber(value, sourceSemanticType);
		}

		if (targetType->isIntegerTy(1)) {
			return toBoolean(value);
		}

		if (targetType->isIntegerTy()) {
			if (value->getType()->isDoubleTy()) {
				if (isSignedIntegerSemanticType(targetSemanticType)) {
					return context.builder.CreateFPToSI(value, targetType, "doubletosint");
				}

				return context.builder.CreateFPToUI(value, targetType, "doubletouint");
			}

			if (value->getType()->isIntegerTy()) {
				return context.builder.CreateIntCast(value, targetType, isSignedIntegerSemanticType(sourceSemanticType), "intcasttmp");
			}
		}

		if (targetType->isPointerTy()) {
			if (value->getType()->isPointerTy()) {
				return context.builder.CreatePointerCast(value, targetType, "ptrcasttmp");
			}

			return ::llvm::ConstantPointerNull::get(::llvm::cast<::llvm::PointerType>(targetType));
		}

		return types.zero(targetType);
	}

	bool ValueLowerer::isSignedIntegerSemanticType(const Yogi::Sir::TypeRef *type) const {
		if (!type || type->kind() != Yogi::Sir::TypeKind_type_reference) {
			return true;
		}

		const auto name = fbString(type->name());
		if (name.empty() || !context.structLayouts.contains(name)) {
			return true;
		}

		const auto *layout = context.structLayouts.at(name);
		if (!layout || layout->bits() == 0) {
			return true;
		}

		return layout->signed_();
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

			case Yogi::Sir::TypeKind_type_literal:
				return callRuntime("yogi_any_from_object", opaquePointer(), {value});

		case Yogi::Sir::TypeKind_type_reference: {
			const auto structName = structTypeName(sourceSemanticType);
			if (!structName.empty() && context.structFields.contains(structName)) {
				auto *voidType = ::llvm::Type::getVoidTy(context.llvmContext);
				auto *object = callRuntime("yogi_object_create", opaquePointer(), {});
				for (const auto &field : context.structFields[structName]) {
					auto *fieldValue = context.builder.CreateExtractValue(
						value,
						{static_cast<unsigned>(field.index)},
						"boxstruct." + sanitizeSymbol(field.name)
					);
					auto *boxedField = boxAny(fieldValue, field.type);
					auto *key = context.builder.CreateGlobalString(field.name);
					callRuntime("yogi_object_set", voidType, {object, key, boxedField});
				}
				return callRuntime("yogi_any_from_object", opaquePointer(), {object});
			}

			switch (resolvedTypeKind(sourceSemanticType)) {
				case Yogi::Sir::TypeKind_number_type:
					return callRuntime("yogi_any_from_number", opaquePointer(), {toNumber(value, sourceSemanticType)});

				case Yogi::Sir::TypeKind_boolean_type:
					return callRuntime("yogi_any_from_boolean", opaquePointer(), {toBoolean(value)});

				case Yogi::Sir::TypeKind_string_type:
					return callRuntime("yogi_any_from_string", opaquePointer(), {value});

				case Yogi::Sir::TypeKind_array_type:
				case Yogi::Sir::TypeKind_tuple_type:
					return callRuntime("yogi_any_from_array", opaquePointer(), {value});

				case Yogi::Sir::TypeKind_type_literal:
					return callRuntime("yogi_any_from_object", opaquePointer(), {value});

				case Yogi::Sir::TypeKind_any_type:
				case Yogi::Sir::TypeKind_union_type:
					return value ? value : ::llvm::ConstantPointerNull::get(opaquePointer());

				case Yogi::Sir::TypeKind_null_type:
					return callRuntime("yogi_any_null", opaquePointer(), {});

				case Yogi::Sir::TypeKind_undefined_type:
					return callRuntime("yogi_any_undefined", opaquePointer(), {});

				default:
					return callRuntime("yogi_any_null", opaquePointer(), {});
			}
		}

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

			case Yogi::Sir::TypeKind_type_literal:
				return callRuntime("yogi_any_to_object", opaquePointer(), {value});

		case Yogi::Sir::TypeKind_type_reference: {
			const auto structName = structTypeName(targetSemanticType);
			if (!structName.empty() && context.structFields.contains(structName)) {
				auto *object = callRuntime("yogi_any_to_object", opaquePointer(), {value});
				auto *structType = types.lower(targetSemanticType);
				::llvm::Value *result = ::llvm::UndefValue::get(structType);
				for (const auto &field : context.structFields[structName]) {
					auto *key = context.builder.CreateGlobalString(field.name);
					auto *fieldAny = callRuntime("yogi_object_get", opaquePointer(), {object, key});
					auto *fieldValue = unboxAny(fieldAny, field.type);
					result = context.builder.CreateInsertValue(
						result,
						fieldValue,
						{static_cast<unsigned>(field.index)},
						"unboxstruct." + sanitizeSymbol(field.name)
					);
				}
				return result;
			}

			switch (resolvedTypeKind(targetSemanticType)) {
				case Yogi::Sir::TypeKind_number_type:
					return callRuntime("yogi_any_to_number", ::llvm::Type::getDoubleTy(context.llvmContext), {value});

				case Yogi::Sir::TypeKind_boolean_type:
					return callRuntime("yogi_any_to_boolean", ::llvm::Type::getInt1Ty(context.llvmContext), {value});

				case Yogi::Sir::TypeKind_string_type:
					return callRuntime("yogi_any_to_string", opaquePointer(), {value});

				case Yogi::Sir::TypeKind_array_type:
				case Yogi::Sir::TypeKind_tuple_type:
					return callRuntime("yogi_any_to_array", opaquePointer(), {value});

				case Yogi::Sir::TypeKind_type_literal:
					return callRuntime("yogi_any_to_object", opaquePointer(), {value});

				case Yogi::Sir::TypeKind_null_type:
					return callRuntime("yogi_any_to_null", opaquePointer(), {value});

				case Yogi::Sir::TypeKind_undefined_type:
					return callRuntime("yogi_any_to_undefined", opaquePointer(), {value});

				default:
					return value;
			}
		}

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
		const auto targetKind = resolvedTypeKind(targetSemanticType);
		const auto targetIsString = targetKind == Yogi::Sir::TypeKind_string_type;

		if (
			!value ||
			!targetType ||
			!value->getType()->isPointerTy() ||
			(targetType->isPointerTy() && !targetIsString)
		) {
			return value;
		}

		if (
			targetSemanticType &&
			(
				targetSemanticType->kind() == Yogi::Sir::TypeKind_number_type ||
				targetSemanticType->kind() == Yogi::Sir::TypeKind_boolean_type ||
				targetSemanticType->kind() == Yogi::Sir::TypeKind_string_type ||
				targetSemanticType->kind() == Yogi::Sir::TypeKind_type_reference
			)
		) {
			return unboxAny(value, targetSemanticType);
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

			if (const auto *addressOf = value->address_of()) {
				return addressOf->type();
			}

			if (const auto *dereference = value->dereference()) {
				return dereference->type();
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

	std::string ValueLowerer::structTypeName(const Yogi::Sir::TypeRef *type) const {
		if (!type) {
			return "";
		}

		if (type->kind() == Yogi::Sir::TypeKind_type_reference) {
			const auto name = fbString(type->name());

			if (context.structTypes.contains(name) || context.structScalarTypes.contains(name)) {
				return name;
			}
		}

		return "";
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

		if (kind == Yogi::Sir::TypeKind_type_reference) {
			const auto name = fbString(type->name());

			if (context.structScalarTypes.contains(name)) {
				return resolvedTypeKind(context.structScalarTypes[name]);
			}
		}

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
