#pragma once

#include "declaration_lowerer.h"

#include <string>
#include <vector>

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class StatementLowerer {
		public:
			StatementLowerer(
				ModuleLoweringContext &context,
				TypeLowerer &types,
				ValueLowerer &values,
				VariableLowerer &variables
			);

			void lower_module_initializer();
			void lower_entry_point(const std::vector<std::string> &module_initializers);
			void lower_block(const Yogi::Sir::BlockStatement *block);
			void lower_statement(const Yogi::Sir::SirNode *node);
			void lower_return(const Yogi::Sir::ReturnStatement *statement);
			void lower_if(const Yogi::Sir::IfStatement *statement);

		private:
			ModuleLoweringContext &context_;
			TypeLowerer &types_;
			ValueLowerer &values_;
			VariableLowerer &variables_;
	};

} // namespace yogi::core::llvm::internal
#endif
