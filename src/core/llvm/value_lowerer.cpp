#include "value_lowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Constants.h>
#include <llvm/IR/DerivedTypes.h>
#include <llvm/IR/Function.h>

namespace yogi::core::llvm::internal {

	ValueLowerer::ValueLowerer(ModuleLoweringContext &context, TypeLowerer &types)
		: context_(context),
		  types_(types) {}

	::llvm::Value *ValueLowerer::lower(
		const Yogi::Sir::ValueRef *value,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		if (!value) {
			return types_.zero(expectedType);
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

		return types_.zero(expectedType);
	}

	::llvm::Value *ValueLowerer::lowerConstant(
		const Yogi::Sir::Constant *constant,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		if (const auto *number = constant->value_as_NumberConstant()) {
			auto *value = ::llvm::ConstantFP::get(::llvm::Type::getDoubleTy(context_.llvm_context), number->value());
			return cast(value, expectedType, expectedSemanticType, constant->type());
		}

		if (const auto *string = constant->value_as_StringConstant()) {
			auto *value = context_.builder.CreateGlobalString(fb_string(string->value()));
			return cast(value, expectedType, expectedSemanticType, constant->type());
		}

		if (const auto *boolean = constant->value_as_BooleanConstant()) {
			auto *value = ::llvm::ConstantInt::get(::llvm::Type::getInt1Ty(context_.llvm_context), boolean->value());
			return cast(value, expectedType, expectedSemanticType, constant->type());
		}

		if (constant->value_as_NullConstant() || constant->value_as_UndefinedConstant()) {
			if (isAnyType(expectedSemanticType)) {
				return boxAny(nullptr, constant->type());
			}

			return types_.zero(expectedType);
		}

		return types_.zero(expectedType);
	}

	::llvm::Value *ValueLowerer::lowerIdentifier(
		const Yogi::Sir::IdentifierExpression *identifier,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto name = fb_string(identifier->name());
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

		if (context_.locals.contains(name)) {
			auto *slot = context_.locals[name];
			auto *loaded = context_.builder.CreateLoad(slot->getAllocatedType(), slot, sanitize_symbol(name) + ".load");
			const auto type = context_.localTypeKinds.contains(name)
				? context_.localTypeKinds[name]
				: identifierTypeKind;
			return loadValue(loaded, type);
		}

		if (context_.globals.contains(name)) {
			auto *global = context_.globals[name];
			auto *loaded = context_.builder.CreateLoad(global->getValueType(), global, sanitize_symbol(name) + ".load");
			const auto type = context_.globalTypeKinds.contains(name)
				? context_.globalTypeKinds[name]
				: identifierTypeKind;
			return loadValue(loaded, type);
		}

		const auto qualifiedName = fb_string(identifier->qualified_name());

		if (!qualifiedName.empty()) {
			const auto symbolName = "_yogi_" + sanitize_symbol(qualifiedName);
			auto *global = context_.module->getGlobalVariable(symbolName);

			if (!global) {
				auto *type = types_.lower(identifier->type());
				global = new ::llvm::GlobalVariable(
					*context_.module,
					type,
					false,
					::llvm::GlobalValue::ExternalLinkage,
					nullptr,
					symbolName
				);
			}

			context_.globals[name] = global;
			context_.globalTypes[name] = identifier->type();
			context_.globalTypeKinds[name] = identifierTypeKind;
			auto *loaded = context_.builder.CreateLoad(global->getValueType(), global, sanitize_symbol(name) + ".load");
			return loadValue(loaded, identifierTypeKind);
		}

		return types_.zero(expectedType);
	}

	::llvm::Value *ValueLowerer::lowerAssignment(const Yogi::Sir::AssignmentExpression *assignment) {
		const auto name = fb_string(assignment->left()->name());
		::llvm::Type *targetType = types_.lower(assignment->type());
		const Yogi::Sir::TypeRef *targetSemanticType = assignment->type();
		::llvm::Value *target = nullptr;

		if (context_.locals.contains(name)) {
			target = context_.locals[name];
			targetType = context_.locals[name]->getAllocatedType();
			if (context_.localTypes.contains(name)) {
				targetSemanticType = context_.localTypes[name];
			}
		} else if (context_.globals.contains(name)) {
			target = context_.globals[name];
			targetType = context_.globals[name]->getValueType();
			if (context_.globalTypes.contains(name)) {
				targetSemanticType = context_.globalTypes[name];
			}
		}

		if (!target) {
			return types_.zero(targetType);
		}

		auto *value = cast(
			lower(assignment->right(), targetType, targetSemanticType),
			targetType,
			targetSemanticType,
			targetSemanticType
		);
		context_.builder.CreateStore(value, target);

		return value;
	}

	::llvm::Value *ValueLowerer::lowerBinary(
		const Yogi::Sir::BinaryExpression *binary,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		const auto op = fb_string(binary->operator_());

		if (op == "??") {
			return lowerNullish(binary, expectedType, expectedSemanticType);
		}

		if (op == std::string("?") + "?=") {
			return lowerNullishAssignment(binary, expectedType, expectedSemanticType);
		}

		const auto *leftSemanticType = valueSemanticType(binary->left());
		const auto *rightSemanticType = valueSemanticType(binary->right());

		auto *left = lower(binary->left(), types_.lower(leftSemanticType), leftSemanticType);
		auto *right = lower(binary->right(), types_.lower(rightSemanticType), rightSemanticType);

		if (op == "+") return context_.builder.CreateFAdd(toNumber(left), toNumber(right), "addtmp");
		if (op == "-") return context_.builder.CreateFSub(toNumber(left), toNumber(right), "subtmp");
		if (op == "*") return context_.builder.CreateFMul(toNumber(left), toNumber(right), "multmp");
		if (op == "/") return context_.builder.CreateFDiv(toNumber(left), toNumber(right), "divtmp");
		if (op == "%") return context_.builder.CreateFRem(toNumber(left), toNumber(right), "modtmp");

		if (op == "<") return context_.builder.CreateFCmpOLT(toNumber(left), toNumber(right), "cmptmp");
		if (op == "<=") return context_.builder.CreateFCmpOLE(toNumber(left), toNumber(right), "cmptmp");
		if (op == ">") return context_.builder.CreateFCmpOGT(toNumber(left), toNumber(right), "cmptmp");
		if (op == ">=") return context_.builder.CreateFCmpOGE(toNumber(left), toNumber(right), "cmptmp");

		if (op == "&&") return context_.builder.CreateAnd(toBoolean(left), toBoolean(right), "andtmp");
		if (op == "||") return context_.builder.CreateOr(toBoolean(left), toBoolean(right), "ortmp");

		if (op == "==" || op == "===") {
			return compare(left, right, true);
		}

		if (op == "!=" || op == "!==") {
			return compare(left, right, false);
		}

		return types_.zero(expectedType ? expectedType : types_.lower(expectedSemanticType));
	}

	::llvm::Value *ValueLowerer::lowerConditional(
		const Yogi::Sir::ConditionalExpression *conditional,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		auto *resultType = expectedType ? expectedType : types_.lower(conditional->type());
		const auto *resultSemanticType = expectedSemanticType ? expectedSemanticType : conditional->type();
		auto *function = context_.builder.GetInsertBlock()->getParent();
		auto *condition = toBoolean(lower(
			conditional->condition(),
			::llvm::Type::getInt1Ty(context_.llvm_context),
			valueSemanticType(conditional->condition())
		));

		auto *thenBlock = ::llvm::BasicBlock::Create(context_.llvm_context, "cond.then", function);
		auto *elseBlock = ::llvm::BasicBlock::Create(context_.llvm_context, "cond.else", function);
		auto *mergeBlock = ::llvm::BasicBlock::Create(context_.llvm_context, "cond.end", function);

		context_.builder.CreateCondBr(condition, thenBlock, elseBlock);

		context_.builder.SetInsertPoint(thenBlock);
		auto *thenValue = cast(
			lower(conditional->when_true(), resultType, resultSemanticType),
			resultType,
			resultSemanticType,
			valueSemanticType(conditional->when_true())
		);
		auto *thenEnd = context_.builder.GetInsertBlock();
		if (!thenEnd->hasTerminator()) {
			context_.builder.CreateBr(mergeBlock);
		}

		context_.builder.SetInsertPoint(elseBlock);
		auto *elseValue = cast(
			lower(conditional->when_false(), resultType, resultSemanticType),
			resultType,
			resultSemanticType,
			valueSemanticType(conditional->when_false())
		);
		auto *elseEnd = context_.builder.GetInsertBlock();
		if (!elseEnd->hasTerminator()) {
			context_.builder.CreateBr(mergeBlock);
		}

		context_.builder.SetInsertPoint(mergeBlock);
		auto *phi = context_.builder.CreatePHI(resultType, 2, "condtmp");
		phi->addIncoming(thenValue, thenEnd);
		phi->addIncoming(elseValue, elseEnd);

		return phi;
	}

	::llvm::Value *ValueLowerer::lowerNullish(
		const Yogi::Sir::BinaryExpression *binary,
		::llvm::Type *expectedType,
		const Yogi::Sir::TypeRef *expectedSemanticType
	) {
		auto *resultType = expectedType ? expectedType : types_.lower(binary->type());
		const auto *resultSemanticType = expectedSemanticType ? expectedSemanticType : binary->type();
		const auto *leftSemanticType = valueSemanticType(binary->left());
		auto *leftStorageType = types_.lower(leftSemanticType);
		auto *leftValue = lower(binary->left(), leftStorageType, leftSemanticType);
		auto *hasValue = context_.builder.CreateNot(isNullish(leftValue), "nullish.has_value");
		auto *function = context_.builder.GetInsertBlock()->getParent();
		auto *presentBlock = ::llvm::BasicBlock::Create(context_.llvm_context, "nullish.present", function);
		auto *fallbackBlock = ::llvm::BasicBlock::Create(context_.llvm_context, "nullish.fallback", function);
		auto *mergeBlock = ::llvm::BasicBlock::Create(context_.llvm_context, "nullish.end", function);

		context_.builder.CreateCondBr(hasValue, presentBlock, fallbackBlock);

		context_.builder.SetInsertPoint(presentBlock);
		auto *presentValue = cast(leftValue, resultType, resultSemanticType, leftSemanticType);
		auto *presentEnd = context_.builder.GetInsertBlock();
		context_.builder.CreateBr(mergeBlock);

		context_.builder.SetInsertPoint(fallbackBlock);
		auto *fallbackValue = cast(
			lower(binary->right(), resultType, resultSemanticType),
			resultType,
			resultSemanticType,
			valueSemanticType(binary->right())
		);
		auto *fallbackEnd = context_.builder.GetInsertBlock();
		context_.builder.CreateBr(mergeBlock);

		context_.builder.SetInsertPoint(mergeBlock);
		auto *phi = context_.builder.CreatePHI(resultType, 2, "nullishtmp");
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
			return types_.zero(expectedType ? expectedType : types_.lower(expectedSemanticType));
		}

		const auto name = fb_string(identifier->name());
		::llvm::Value *target = nullptr;
		::llvm::Type *targetType = nullptr;
		const Yogi::Sir::TypeRef *targetSemanticType = identifier->type();

		if (context_.locals.contains(name)) {
			target = context_.locals[name];
			targetType = context_.locals[name]->getAllocatedType();
			if (context_.localTypes.contains(name)) {
				targetSemanticType = context_.localTypes[name];
			}
		} else if (context_.globals.contains(name)) {
			target = context_.globals[name];
			targetType = context_.globals[name]->getValueType();
			if (context_.globalTypes.contains(name)) {
				targetSemanticType = context_.globalTypes[name];
			}
		}

		if (!target || !targetType) {
			return types_.zero(expectedType ? expectedType : types_.lower(expectedSemanticType));
		}

		auto *currentValue = context_.builder.CreateLoad(targetType, target, sanitize_symbol(name) + ".nullish.load");
		auto *hasValue = context_.builder.CreateNot(isNullish(currentValue), "nullishassign.has_value");
		auto *function = context_.builder.GetInsertBlock()->getParent();
		auto *presentBlock = ::llvm::BasicBlock::Create(context_.llvm_context, "nullishassign.present", function);
		auto *assignBlock = ::llvm::BasicBlock::Create(context_.llvm_context, "nullishassign.assign", function);
		auto *mergeBlock = ::llvm::BasicBlock::Create(context_.llvm_context, "nullishassign.end", function);

		context_.builder.CreateCondBr(hasValue, presentBlock, assignBlock);

		context_.builder.SetInsertPoint(presentBlock);
		auto *presentValue = currentValue;
		auto *presentEnd = context_.builder.GetInsertBlock();
		context_.builder.CreateBr(mergeBlock);

		context_.builder.SetInsertPoint(assignBlock);
		auto *assignedValue = cast(
			lower(binary->right(), targetType, targetSemanticType),
			targetType,
			targetSemanticType,
			valueSemanticType(binary->right())
		);
		context_.builder.CreateStore(assignedValue, target);
		auto *assignEnd = context_.builder.GetInsertBlock();
		context_.builder.CreateBr(mergeBlock);

		context_.builder.SetInsertPoint(mergeBlock);
		auto *storedPhi = context_.builder.CreatePHI(targetType, 2, "nullishassigntmp");
		storedPhi->addIncoming(presentValue, presentEnd);
		storedPhi->addIncoming(assignedValue, assignEnd);

		auto *resultType = expectedType ? expectedType : types_.lower(binary->type());
		const auto *resultSemanticType = expectedSemanticType ? expectedSemanticType : binary->type();

		return cast(storedPhi, resultType, resultSemanticType, targetSemanticType);
	}

	::llvm::Value *ValueLowerer::compare(::llvm::Value *left, ::llvm::Value *right, bool equals) {
		if (left->getType()->isDoubleTy() || right->getType()->isDoubleTy()) {
			auto *result = context_.builder.CreateFCmpOEQ(toNumber(left), toNumber(right), "eqtmp");
			return equals ? result : context_.builder.CreateNot(result, "netmp");
		}

		if (left->getType()->isPointerTy() || right->getType()->isPointerTy()) {
			auto *targetType = left->getType()->isPointerTy() ? left->getType() : right->getType();
			auto *lhs = cast(left, targetType);
			auto *rhs = cast(right, targetType);
			auto *result = context_.builder.CreateICmpEQ(lhs, rhs, "eqtmp");
			return equals ? result : context_.builder.CreateNot(result, "netmp");
		}

		auto *result = context_.builder.CreateICmpEQ(toBoolean(left), toBoolean(right), "eqtmp");
		return equals ? result : context_.builder.CreateNot(result, "netmp");
	}

	::llvm::Value *ValueLowerer::toNumber(::llvm::Value *value) {
		if (value->getType()->isDoubleTy()) {
			return value;
		}

		if (value->getType()->isIntegerTy(1)) {
			return context_.builder.CreateUIToFP(value, ::llvm::Type::getDoubleTy(context_.llvm_context), "booltofptmp");
		}

		return ::llvm::ConstantFP::get(::llvm::Type::getDoubleTy(context_.llvm_context), 0.0);
	}

	::llvm::Value *ValueLowerer::toBoolean(::llvm::Value *value) {
		if (value->getType()->isIntegerTy(1)) {
			return value;
		}

		if (value->getType()->isDoubleTy()) {
			return context_.builder.CreateFCmpONE(
				value,
				::llvm::ConstantFP::get(::llvm::Type::getDoubleTy(context_.llvm_context), 0.0),
				"numtobooltmp"
			);
		}

		if (value->getType()->isPointerTy()) {
			auto *null = ::llvm::ConstantPointerNull::get(::llvm::cast<::llvm::PointerType>(value->getType()));
			return context_.builder.CreateICmpNE(value, null, "ptrtobooltmp");
		}

		return ::llvm::ConstantInt::getFalse(context_.llvm_context);
	}

	::llvm::Value *ValueLowerer::isNullish(::llvm::Value *value) {
		if (!value) {
			return ::llvm::ConstantInt::getTrue(context_.llvm_context);
		}

		if (value->getType()->isPointerTy()) {
			auto *null = ::llvm::ConstantPointerNull::get(::llvm::cast<::llvm::PointerType>(value->getType()));
			return context_.builder.CreateICmpEQ(value, null, "isnullishtmp");
		}

		return ::llvm::ConstantInt::getFalse(context_.llvm_context);
	}

	::llvm::Value *ValueLowerer::cast(
		::llvm::Value *value,
		::llvm::Type *targetType,
		const Yogi::Sir::TypeRef *targetSemanticType,
		const Yogi::Sir::TypeRef *sourceSemanticType
	) {
		if (!value || !targetType) {
			return types_.zero(targetType);
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
				return context_.builder.CreatePointerCast(value, targetType, "ptrcasttmp");
			}

			return ::llvm::ConstantPointerNull::get(::llvm::cast<::llvm::PointerType>(targetType));
		}

		return types_.zero(targetType);
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
				return callRuntime("yogi_any_to_number", ::llvm::Type::getDoubleTy(context_.llvm_context), {value});

			case Yogi::Sir::TypeKind_boolean_type:
				return callRuntime("yogi_any_to_boolean", ::llvm::Type::getInt1Ty(context_.llvm_context), {value});

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

		auto *function = context_.runtimeFunction(name, returnType, parameterTypes);
		return context_.builder.CreateCall(function, arguments, sanitize_symbol(name) + ".call");
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

		return nullptr;
	}

	bool ValueLowerer::isAnyType(const Yogi::Sir::TypeRef *type) const {
		return type && type->kind() == Yogi::Sir::TypeKind_any_type;
	}

	::llvm::PointerType *ValueLowerer::opaquePointer() const {
		return ::llvm::PointerType::get(context_.llvm_context, 0);
	}

} // namespace yogi::core::llvm::internal
#endif
