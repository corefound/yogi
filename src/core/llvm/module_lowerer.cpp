#include "module_lowerer.h"

#if YOGI_HAS_LLVM
#include <iostream>
#include <utility>

#include <llvm/IR/Verifier.h>
#include <llvm/TargetParser/Host.h>
#include <llvm/TargetParser/Triple.h>

namespace yogi::core::llvm::internal {

	ModuleLowerer::ModuleLowerer(
		const Yogi::Build::ModuleMeta *module_meta,
		const Yogi::Sir::Module *sir_module,
		std::vector<std::string> module_initializers
	)
		: context_(module_meta, sir_module),
		  module_initializers_(std::move(module_initializers)),
		  types_(context_),
		  values_(context_, types_),
		  variables_(context_, types_, values_),
		  functions_(context_, types_, values_),
		  statements_(context_, types_, values_, variables_),
		  writer_(context_) {
		functions_.set_statement_lowerer(&statements_);
	}

	bool ModuleLowerer::lower() {
		if (!context_.sir_module || !context_.sir_module->nodes()) {
			return false;
		}

		context_.module->setTargetTriple(::llvm::Triple(::llvm::sys::getDefaultTargetTriple()));
		variables_.predeclare_globals();
		functions_.lower_functions();
		statements_.lower_module_initializer();
		statements_.lower_entry_point(module_initializers_);

		if (::llvm::verifyModule(*context_.module, &::llvm::errs())) {
			std::cerr << "LLVM verification failed for module "
				<< fb_string(context_.module_meta->name()) << "\n";
			return false;
		}

		writer_.write_ir_file();
		return writer_.write_object_file();
	}

} // namespace yogi::core::llvm::internal
#endif
