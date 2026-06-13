#pragma once

#include "libs/flatbuffers/fbs_generated.h"

namespace yogi::core::llvm {

	class Linker {
		public:
			static bool link_build_output(const Yogi::Build::Meta *build_meta);
	};

} // namespace yogi::core::llvm
