// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "libs/flatbuffers/fbs_generated.h"

namespace yogi::core::llvm {

	class Linker {
		public:
			static bool linkBuildOutput(const Yogi::Build::Meta *buildMeta);
	};

} // namespace yogi::core::llvm
