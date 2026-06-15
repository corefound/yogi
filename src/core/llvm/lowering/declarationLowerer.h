// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "llvm/lowering/valueLowerer.h"

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class StatementLowerer;

	class VariableLowerer {
		public:
			VariableLowerer(ModuleLoweringContext &context, TypeLowerer &types, ValueLowerer &values);

			void predeclareGlobals();
			::llvm::GlobalVariable *declareGlobal(const Yogi::Sir::VariableDeclaration *variable);
			void lowerVariable(const Yogi::Sir::VariableDeclaration *variable);

		private:
			ModuleLoweringContext &context;
			TypeLowerer &types;
			ValueLowerer &values;
	};

	class FunctionLowerer {
		public:
			FunctionLowerer(ModuleLoweringContext &context, TypeLowerer &types, ValueLowerer &values);

			void setStatementLowerer(StatementLowerer *statements);
			void lowerFunctions();
			void lowerFunction(const Yogi::Sir::FunctionDeclaration *function);

		private:
			ModuleLoweringContext &context;
			TypeLowerer &types;
			ValueLowerer &values;
			StatementLowerer *statements = nullptr;
	};

} // namespace yogi::core::llvm::internal
#endif
