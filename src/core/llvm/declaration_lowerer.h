#pragma once

#include "value_lowerer.h"

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class StatementLowerer;

	class VariableLowerer {
		public:
			VariableLowerer(ModuleLoweringContext &context, TypeLowerer &types, ValueLowerer &values);

			void predeclare_globals();
			::llvm::GlobalVariable *declare_global(const Yogi::Sir::VariableDeclaration *variable);
			void lower_variable(const Yogi::Sir::VariableDeclaration *variable);

		private:
			ModuleLoweringContext &context_;
			TypeLowerer &types_;
			ValueLowerer &values_;
	};

	class FunctionLowerer {
		public:
			FunctionLowerer(ModuleLoweringContext &context, TypeLowerer &types, ValueLowerer &values);

			void set_statement_lowerer(StatementLowerer *statements);
			void lower_functions();
			void lower_function(const Yogi::Sir::FunctionDeclaration *function);

		private:
			ModuleLoweringContext &context_;
			TypeLowerer &types_;
			ValueLowerer &values_;
			StatementLowerer *statements_ = nullptr;
	};

} // namespace yogi::core::llvm::internal
#endif
