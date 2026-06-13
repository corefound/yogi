#pragma once

#include "declaration_lowerer.h"
#include "object_writer.h"
#include "statement_lowerer.h"

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class ModuleLowerer {
		public:
			ModuleLowerer(
				const Yogi::Build::ModuleMeta *module_meta,
				const Yogi::Sir::Module *sir_module,
				std::vector<std::string> module_initializers
			);

			bool lower();

		private:
			ModuleLoweringContext context_;
			std::vector<std::string> module_initializers_;
			TypeLowerer types_;
			ValueLowerer values_;
			VariableLowerer variables_;
			FunctionLowerer functions_;
			StatementLowerer statements_;
			ObjectWriter writer_;
	};

} // namespace yogi::core::llvm::internal
#endif
