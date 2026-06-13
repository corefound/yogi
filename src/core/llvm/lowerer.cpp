#include "lowerer.h"

#include <iostream>

#if YOGI_HAS_LLVM
#include "module_lowerer.h"
#endif

namespace yogi::core::llvm {

	bool Lowerer::lower_module_to_object(
		const Yogi::Build::ModuleMeta *module_meta,
		const Yogi::Sir::Module *sir_module,
		const std::vector<std::string> &module_initializers
	) {
		#if YOGI_HAS_LLVM
		internal::ModuleLowerer lowerer(module_meta, sir_module, module_initializers);
		return lowerer.lower();
		#else
		(void) module_meta;
		(void) sir_module;
		(void) module_initializers;
		std::cerr << "LLVM support is disabled; skipping object generation\n";
		return false;
		#endif
	}

	std::string Lowerer::module_initializer_name(
		const Yogi::Build::ModuleMeta *module_meta
	) {
		#if YOGI_HAS_LLVM
		return "_yogi_module_init_" + internal::sanitize_symbol(internal::fb_string(module_meta->name()));
		#else
		(void) module_meta;
		return "";
		#endif
	}

} // namespace yogi::core::llvm
