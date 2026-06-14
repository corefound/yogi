#pragma once

#include "type_lowerer.h"

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class ValueLowerer {
		public:
			ValueLowerer(ModuleLoweringContext &context, TypeLowerer &types);

			::llvm::Value *lower(
				const Yogi::Sir::ValueRef *value,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType = nullptr
			);
			::llvm::Value *lowerAssignment(const Yogi::Sir::AssignmentExpression *assignment);
			::llvm::Value *lowerBinary(
				const Yogi::Sir::BinaryExpression *binary,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType = nullptr
			);
			::llvm::Value *lowerConditional(
				const Yogi::Sir::ConditionalExpression *conditional,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType = nullptr
			);
			::llvm::Value *cast(
				::llvm::Value *value,
				::llvm::Type *targetType,
				const Yogi::Sir::TypeRef *targetSemanticType = nullptr,
				const Yogi::Sir::TypeRef *sourceSemanticType = nullptr
			);
			::llvm::Value *toNumber(::llvm::Value *value);
			::llvm::Value *toBoolean(::llvm::Value *value);

		private:
			::llvm::Value *lowerConstant(
				const Yogi::Sir::Constant *constant,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *lowerIdentifier(
				const Yogi::Sir::IdentifierExpression *identifier,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *compare(::llvm::Value *left, ::llvm::Value *right, bool equals);
			::llvm::Value *lowerNullish(
				const Yogi::Sir::BinaryExpression *binary,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *lowerNullishAssignment(
				const Yogi::Sir::BinaryExpression *binary,
				::llvm::Type *expectedType,
				const Yogi::Sir::TypeRef *expectedSemanticType
			);
			::llvm::Value *isNullish(::llvm::Value *value);
			::llvm::Value *boxAny(::llvm::Value *value, const Yogi::Sir::TypeRef *sourceSemanticType);
			::llvm::Value *unboxAny(::llvm::Value *value, const Yogi::Sir::TypeRef *targetSemanticType);
			::llvm::Value *callRuntime(
				const std::string &name,
				::llvm::Type *returnType,
				const std::vector<::llvm::Value *> &arguments
			);
			const Yogi::Sir::TypeRef *valueSemanticType(const Yogi::Sir::ValueRef *value) const;
			bool isAnyType(const Yogi::Sir::TypeRef *type) const;
			::llvm::PointerType *opaquePointer() const;

			ModuleLoweringContext &context_;
			TypeLowerer &types_;
	};

} // namespace yogi::core::llvm::internal
#endif
