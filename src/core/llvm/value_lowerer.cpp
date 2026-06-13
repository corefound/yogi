#include "value_lowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/Constants.h>
#include <llvm/IR/DerivedTypes.h>

namespace yogi::core::llvm::internal {

	ValueLowerer::ValueLowerer(ModuleLoweringContext &context, TypeLowerer &types)
		: context_(context),
		  types_(types) {}

	::llvm::Value *ValueLowerer::lower(const Yogi::Sir::ValueRef *value, ::llvm::Type *expected_type) {
		if (!value) {
			return types_.zero(expected_type);
		}

		if (const auto *constant = value->constant()) {
			return lower_constant(constant, expected_type);
		}

		if (const auto *identifier = value->identifier()) {
			return lower_identifier(identifier, expected_type);
		}

		if (const auto *binary = value->binary()) {
			return lower_binary(binary, expected_type);
		}

		if (const auto *assignment = value->assignment()) {
			return lower_assignment(assignment);
		}

		return types_.zero(expected_type);
	}

	::llvm::Value *ValueLowerer::lower_constant(const Yogi::Sir::Constant *constant, ::llvm::Type *expected_type) {
		if (const auto *number = constant->value_as_NumberConstant()) {
			if (expected_type && expected_type->isPointerTy()) {
				return ::llvm::ConstantPointerNull::get(::llvm::cast<::llvm::PointerType>(expected_type));
			}

			return ::llvm::ConstantFP::get(::llvm::Type::getDoubleTy(context_.llvm_context), number->value());
		}

		if (const auto *string = constant->value_as_StringConstant()) {
			return context_.builder.CreateGlobalStringPtr(fb_string(string->value()));
		}

		if (const auto *boolean = constant->value_as_BooleanConstant()) {
			return ::llvm::ConstantInt::get(::llvm::Type::getInt1Ty(context_.llvm_context), boolean->value());
		}

		if (constant->value_as_NullConstant() || constant->value_as_UndefinedConstant()) {
			if (expected_type && expected_type->isPointerTy()) {
				return ::llvm::ConstantPointerNull::get(::llvm::cast<::llvm::PointerType>(expected_type));
			}

			return types_.zero(expected_type);
		}

		return types_.zero(expected_type);
	}

	::llvm::Value *ValueLowerer::lower_identifier(
		const Yogi::Sir::IdentifierExpression *identifier,
		::llvm::Type *expected_type
	) {
		const auto name = fb_string(identifier->name());

		if (context_.locals.contains(name)) {
			auto *slot = context_.locals[name];
			return context_.builder.CreateLoad(slot->getAllocatedType(), slot, sanitize_symbol(name) + ".load");
		}

		if (context_.globals.contains(name)) {
			auto *global = context_.globals[name];
			return context_.builder.CreateLoad(global->getValueType(), global, sanitize_symbol(name) + ".load");
		}

		const auto qualified_name = fb_string(identifier->qualified_name());

		if (!qualified_name.empty()) {
			const auto symbol_name = "_yogi_" + sanitize_symbol(qualified_name);
			auto *global = context_.module->getGlobalVariable(symbol_name);

			if (!global) {
				auto *type = types_.lower(identifier->type());
				global = new ::llvm::GlobalVariable(
					*context_.module,
					type,
					false,
					::llvm::GlobalValue::ExternalLinkage,
					nullptr,
					symbol_name
				);
			}

			context_.globals[name] = global;
			return context_.builder.CreateLoad(global->getValueType(), global, sanitize_symbol(name) + ".load");
		}

		return types_.zero(expected_type);
	}

	::llvm::Value *ValueLowerer::lower_assignment(const Yogi::Sir::AssignmentExpression *assignment) {
		const auto name = fb_string(assignment->left()->name());
		::llvm::Type *target_type = types_.lower(assignment->type());
		::llvm::Value *target = nullptr;

		if (context_.locals.contains(name)) {
			target = context_.locals[name];
			target_type = context_.locals[name]->getAllocatedType();
		} else if (context_.globals.contains(name)) {
			target = context_.globals[name];
			target_type = context_.globals[name]->getValueType();
		}

		if (!target) {
			return types_.zero(target_type);
		}

		auto *value = cast(lower(assignment->right(), target_type), target_type);
		context_.builder.CreateStore(value, target);

		return value;
	}

	::llvm::Value *ValueLowerer::lower_binary(const Yogi::Sir::BinaryExpression *binary, ::llvm::Type *expected_type) {
		const auto op = fb_string(binary->operator_());

		auto *left = lower(binary->left(), types_.lower(binary->type()));
		auto *right = lower(binary->right(), left ? left->getType() : types_.lower(binary->type()));

		if (op == "+") return context_.builder.CreateFAdd(to_number(left), to_number(right), "addtmp");
		if (op == "-") return context_.builder.CreateFSub(to_number(left), to_number(right), "subtmp");
		if (op == "*") return context_.builder.CreateFMul(to_number(left), to_number(right), "multmp");
		if (op == "/") return context_.builder.CreateFDiv(to_number(left), to_number(right), "divtmp");
		if (op == "%") return context_.builder.CreateFRem(to_number(left), to_number(right), "modtmp");

		if (op == "<") return context_.builder.CreateFCmpOLT(to_number(left), to_number(right), "cmptmp");
		if (op == "<=") return context_.builder.CreateFCmpOLE(to_number(left), to_number(right), "cmptmp");
		if (op == ">") return context_.builder.CreateFCmpOGT(to_number(left), to_number(right), "cmptmp");
		if (op == ">=") return context_.builder.CreateFCmpOGE(to_number(left), to_number(right), "cmptmp");

		if (op == "&&") return context_.builder.CreateAnd(to_boolean(left), to_boolean(right), "andtmp");
		if (op == "||") return context_.builder.CreateOr(to_boolean(left), to_boolean(right), "ortmp");

		if (op == "==" || op == "===") {
			return compare(left, right, true);
		}

		if (op == "!=" || op == "!==") {
			return compare(left, right, false);
		}

		return types_.zero(expected_type);
	}

	::llvm::Value *ValueLowerer::compare(::llvm::Value *left, ::llvm::Value *right, bool equals) {
		if (left->getType()->isDoubleTy() || right->getType()->isDoubleTy()) {
			auto *result = context_.builder.CreateFCmpOEQ(to_number(left), to_number(right), "eqtmp");
			return equals ? result : context_.builder.CreateNot(result, "netmp");
		}

		if (left->getType()->isPointerTy() || right->getType()->isPointerTy()) {
			auto *target_type = left->getType()->isPointerTy() ? left->getType() : right->getType();
			auto *lhs = cast(left, target_type);
			auto *rhs = cast(right, target_type);
			auto *result = context_.builder.CreateICmpEQ(lhs, rhs, "eqtmp");
			return equals ? result : context_.builder.CreateNot(result, "netmp");
		}

		auto *result = context_.builder.CreateICmpEQ(to_boolean(left), to_boolean(right), "eqtmp");
		return equals ? result : context_.builder.CreateNot(result, "netmp");
	}

	::llvm::Value *ValueLowerer::to_number(::llvm::Value *value) {
		if (value->getType()->isDoubleTy()) {
			return value;
		}

		if (value->getType()->isIntegerTy(1)) {
			return context_.builder.CreateUIToFP(value, ::llvm::Type::getDoubleTy(context_.llvm_context), "booltofptmp");
		}

		return ::llvm::ConstantFP::get(::llvm::Type::getDoubleTy(context_.llvm_context), 0.0);
	}

	::llvm::Value *ValueLowerer::to_boolean(::llvm::Value *value) {
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

	::llvm::Value *ValueLowerer::cast(::llvm::Value *value, ::llvm::Type *target_type) {
		if (!value || !target_type) {
			return types_.zero(target_type);
		}

		if (value->getType() == target_type) {
			return value;
		}

		if (target_type->isDoubleTy()) {
			return to_number(value);
		}

		if (target_type->isIntegerTy(1)) {
			return to_boolean(value);
		}

		if (target_type->isPointerTy()) {
			if (value->getType()->isPointerTy()) {
				return context_.builder.CreatePointerCast(value, target_type, "ptrcasttmp");
			}

			return ::llvm::ConstantPointerNull::get(::llvm::cast<::llvm::PointerType>(target_type));
		}

		return types_.zero(target_type);
	}

} // namespace yogi::core::llvm::internal
#endif
