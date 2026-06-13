#include "type_lowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/Constants.h>
#include <llvm/IR/DerivedTypes.h>
#include <llvm/IR/Type.h>

namespace yogi::core::llvm::internal {

	namespace {
		::llvm::PointerType *opaque_pointer(::llvm::LLVMContext &context) {
			return ::llvm::PointerType::get(context, 0);
		}
	}

	TypeLowerer::TypeLowerer(ModuleLoweringContext &context)
		: context_(context) {}

	::llvm::Type *TypeLowerer::lower(const Yogi::Sir::TypeRef *type) {
		if (!type) {
			return opaque_pointer(context_.llvm_context);
		}

		switch (type->kind()) {
			case Yogi::Sir::TypeKind_number_type:
				return ::llvm::Type::getDoubleTy(context_.llvm_context);

			case Yogi::Sir::TypeKind_boolean_type:
				return ::llvm::Type::getInt1Ty(context_.llvm_context);

			case Yogi::Sir::TypeKind_void_type:
				return ::llvm::Type::getVoidTy(context_.llvm_context);

			case Yogi::Sir::TypeKind_string_type:
			case Yogi::Sir::TypeKind_null_type:
			case Yogi::Sir::TypeKind_undefined_type:
			case Yogi::Sir::TypeKind_any_type:
			case Yogi::Sir::TypeKind_union_type:
			case Yogi::Sir::TypeKind_unknown_type:
			case Yogi::Sir::TypeKind_type_reference:
				return opaque_pointer(context_.llvm_context);

			default:
				return opaque_pointer(context_.llvm_context);
		}
	}

	::llvm::Constant *TypeLowerer::zero(::llvm::Type *type) {
		if (type->isVoidTy()) {
			return nullptr;
		}

		return ::llvm::Constant::getNullValue(type);
	}

} // namespace yogi::core::llvm::internal
#endif
