// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/driver/lowerer.h"

#include <iostream>

#if YOGI_HAS_LLVM
#include "llvm/modules/moduleLowerer.h"
#endif

namespace yogi::core::llvm {

	bool Lowerer::lowerModuleToObject(
		const Yogi::Build::ModuleMeta *moduleMeta,
		const Yogi::Sir::Module *sirModule,
		const std::vector<std::string> &moduleInitializers,
		const std::vector<std::string> &moduleCleanups
	) {
		#if YOGI_HAS_LLVM
		internal::ModuleLowerer lowerer(moduleMeta, sirModule, moduleInitializers, moduleCleanups);
		return lowerer.lower();
		#else
		(void) moduleMeta;
		(void) sirModule;
		(void) moduleInitializers;
		(void) moduleCleanups;
		std::cerr << "LLVM support is disabled; skipping object generation\n";
		return false;
		#endif
	}

	std::string Lowerer::moduleInitializerName(
		const Yogi::Build::ModuleMeta *moduleMeta
	) {
		#if YOGI_HAS_LLVM
		return "_yogi_module_init_" + internal::sanitizeSymbol(internal::fbString(moduleMeta->name()));
		#else
		(void) moduleMeta;
		return "";
		#endif
	}

	std::string Lowerer::moduleCleanupName(
		const Yogi::Build::ModuleMeta *moduleMeta
	) {
		#if YOGI_HAS_LLVM
		return "_yogi_module_cleanup_" + internal::sanitizeSymbol(internal::fbString(moduleMeta->name()));
		#else
		(void) moduleMeta;
		return "";
		#endif
	}

} // namespace yogi::core::llvm
