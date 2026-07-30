// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include <filesystem>
#include <string>
#include <vector>

#include "libs/flatbuffers/fbs_generated.h"

namespace yogi::core::llvm {

	class Lowerer {
		public:
			static bool lowerModuleToObject(
				const Yogi::Build::ModuleMeta *moduleMeta,
				const Yogi::Sir::Module *sirModule,
				const std::vector<std::string> &moduleInitializers,
				const std::vector<std::string> &moduleCleanups
			);

			static std::string moduleInitializerName(
				const Yogi::Build::ModuleMeta *moduleMeta
			);
			static std::string moduleCleanupName(
				const Yogi::Build::ModuleMeta *moduleMeta
			);
	};

} // namespace yogi::core::llvm
