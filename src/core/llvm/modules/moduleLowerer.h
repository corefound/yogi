// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "llvm/lowering/declarationLowerer.h"
#include "llvm/lowering/statementLowerer.h"
#include "llvm/output/objectWriter.h"

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class ModuleLowerer {
		public:
			ModuleLowerer(
				const Yogi::Build::ModuleMeta *moduleMeta,
				const Yogi::Sir::Module *sirModule,
				std::vector<std::string> moduleInitializers,
				std::vector<std::string> moduleCleanups
			);

			bool lower();

		private:
			ModuleLoweringContext context;
			std::vector<std::string> moduleInitializers;
			std::vector<std::string> moduleCleanups;
			TypeLowerer types;
			ValueLowerer values;
			VariableLowerer variables;
			FunctionLowerer functions;
			StatementLowerer statements;
			ObjectWriter writer;
	};

} // namespace yogi::core::llvm::internal
#endif
