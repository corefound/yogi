// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/lowering/valueLowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Constants.h>
#include <llvm/IR/DerivedTypes.h>
#include <llvm/IR/Function.h>

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

	::llvm::Value *ValueLowerer::lowerBuiltinMethodCall(
		const Yogi::Sir::CallExpression *call,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto *callee = call->callee()->property_access();
		const auto methodName = fbString(callee->property());

		if (methodName == "push") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			const auto *argument = call->arguments() && call->arguments()->size() > 0
				? call->arguments()->Get(0)
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

		if (methodName == "pop") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			auto *result = callRuntime(
				"yogi_array_pop",
				opaquePointer(),
				{array}
			);

			return cast(
				result,
				expectedType ? expectedType : types.lower(call->type()),
				expectedSemanticType ? expectedSemanticType : call->type(),
				call->type()
			);
		}

		if (methodName == "at") {
			auto *array = lower(callee->object(), opaquePointer(), valueSemanticType(callee->object()));
			const auto *argument = call->arguments() && call->arguments()->size() > 0
				? call->arguments()->Get(0)
				: nullptr;
			const auto *argumentSemanticType = valueSemanticType(argument);
			auto *argumentValue = lower(argument, ::llvm::Type::getDoubleTy(context.llvmContext), argumentSemanticType);
			auto *result = callRuntime(
				"yogi_array_at",
				opaquePointer(),
				{array, toIndex(argumentValue)}
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
		auto *object = lower(access->object(), opaquePointer(), valueSemanticType(access->object()));
		auto *property = context.builder.CreateGlobalString(fbString(access->property()));
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
		auto *array = lower(access->object(), opaquePointer(), valueSemanticType(access->object()));
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

		if (!target) {
			return types.zero(targetType);
		}

		auto *value = cast(
			lower(assignment->right(), targetType, targetSemanticType),
			targetType,
			targetSemanticType,
			targetSemanticType
		);
		context.builder.CreateStore(value, target);

		if (context.globals.contains(name)) {
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

			case Yogi::Sir::TypeKind_null_type:
				return callRuntime("yogi_any_to_null", opaquePointer(), {value});

			case Yogi::Sir::TypeKind_undefined_type:
				return callRuntime("yogi_any_to_undefined", opaquePointer(), {value});

			default:
				return value;
		}
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
