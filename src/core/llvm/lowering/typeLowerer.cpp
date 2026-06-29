// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/lowering/typeLowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/Constants.h>
#include <llvm/IR/DerivedTypes.h>
#include <llvm/IR/Type.h>

namespace yogi::core::llvm::internal {

	namespace {
		::llvm::PointerType *opaquePointerType(::llvm::LLVMContext &context) {
			return ::llvm::PointerType::get(context, 0);
		}

		std::string typeName(const Yogi::Sir::TypeRef *type) {
			return type ? fbString(type->name()) : "";
		}
	}

	TypeLowerer::TypeLowerer(ModuleLoweringContext &context)
		: context(context) {}

	::llvm::Type *TypeLowerer::lower(const Yogi::Sir::TypeRef *type) {
		if (!type) {
			return opaquePointerType(context.llvmContext);
		}

		switch (type->kind()) {
			case Yogi::Sir::TypeKind_number_type:
				return ::llvm::Type::getDoubleTy(context.llvmContext);

			case Yogi::Sir::TypeKind_boolean_type:
				return ::llvm::Type::getInt1Ty(context.llvmContext);

			case Yogi::Sir::TypeKind_void_type:
				return ::llvm::Type::getVoidTy(context.llvmContext);

			case Yogi::Sir::TypeKind_string_type:
			case Yogi::Sir::TypeKind_null_type:
			case Yogi::Sir::TypeKind_undefined_type:
			case Yogi::Sir::TypeKind_any_type:
			case Yogi::Sir::TypeKind_union_type:
			case Yogi::Sir::TypeKind_unknown_type:
				return opaquePointerType(context.llvmContext);

			case Yogi::Sir::TypeKind_type_reference: {
				const auto name = typeName(type);

				if (context.structTypes.contains(name)) {
					return context.structTypes[name];
				}

				if (context.structScalarTypes.contains(name)) {
					return lower(context.structScalarTypes[name]);
				}

				if (type->resolved()) {
					return lower(type->resolved());
				}

				return opaquePointerType(context.llvmContext);
			}

			default:
				return opaquePointerType(context.llvmContext);
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
