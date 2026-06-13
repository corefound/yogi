#pragma once

#include "type_lowerer.h"

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class ValueLowerer {
		public:
			ValueLowerer(ModuleLoweringContext &context, TypeLowerer &types);

			::llvm::Value *lower(const Yogi::Sir::ValueRef *value, ::llvm::Type *expected_type);
			::llvm::Value *lower_assignment(const Yogi::Sir::AssignmentExpression *assignment);
			::llvm::Value *lower_binary(const Yogi::Sir::BinaryExpression *binary, ::llvm::Type *expected_type);
			::llvm::Value *cast(::llvm::Value *value, ::llvm::Type *target_type);
			::llvm::Value *to_number(::llvm::Value *value);
			::llvm::Value *to_boolean(::llvm::Value *value);

		private:
			::llvm::Value *lower_constant(const Yogi::Sir::Constant *constant, ::llvm::Type *expected_type);
			::llvm::Value *lower_identifier(const Yogi::Sir::IdentifierExpression *identifier, ::llvm::Type *expected_type);
			::llvm::Value *compare(::llvm::Value *left, ::llvm::Value *right, bool equals);

			ModuleLoweringContext &context_;
			TypeLowerer &types_;
	};

} // namespace yogi::core::llvm::internal
#endif
