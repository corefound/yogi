#pragma once

#include <filesystem>
#include <string>
#include <vector>

#include "libs/flatbuffers/fbs_generated.h"

namespace yogi::core::llvm {

	class Lowerer {
		public:
			static bool lower_module_to_object(
				const Yogi::Build::ModuleMeta *module_meta,
				const Yogi::Sir::Module *sir_module,
				const std::vector<std::string> &module_initializers
			);

			static std::string module_initializer_name(
				const Yogi::Build::ModuleMeta *module_meta
			);
	};

} // namespace yogi::core::llvm
