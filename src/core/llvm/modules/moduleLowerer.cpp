// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/modules/moduleLowerer.h"

#if YOGI_HAS_LLVM
#include <iostream>
#include <utility>

#include <llvm/IR/Verifier.h>
#include <llvm/TargetParser/Host.h>
#include <llvm/TargetParser/Triple.h>

namespace yogi::core::llvm::internal {

	ModuleLowerer::ModuleLowerer(
		const Yogi::Build::ModuleMeta *moduleMeta,
		const Yogi::Sir::Module *sirModule,
		std::vector<std::string> moduleInitializers,
		std::vector<std::string> moduleCleanups
	)
		: context(moduleMeta, sirModule),
		moduleInitializers(std::move(moduleInitializers)),
		moduleCleanups(std::move(moduleCleanups)),
		types(context),
		values(context, types),
		variables(context, types, values),
		functions(context, types, values),
		statements(context, types, values, variables),
		writer(context) {
		functions.setStatementLowerer(&statements);
	}

	bool ModuleLowerer::lower() {
		if (!context.sirModule || !context.sirModule->nodes()) {
			return false;
		}

		context.module->setTargetTriple(::llvm::Triple(::llvm::sys::getDefaultTargetTriple()));
		variables.predeclareGlobals();
		functions.lowerFunctions();
		statements.lowerModuleInitializer();
		statements.lowerModuleCleanup();
		statements.lowerEntryPoint(moduleInitializers, moduleCleanups);

		if (::llvm::verifyModule(*context.module, &::llvm::errs())) {
			std::cerr << "LLVM verification failed for module "
			<< fbString(context.moduleMeta->name()) << "\n";
			return false;
		}

		writer.writeIrFile();
		return writer.writeObjectFile();
	}

} // namespace yogi::core::llvm::internal
#endif
