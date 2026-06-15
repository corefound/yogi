// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "llvm/context/loweringContext.h"

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class ObjectWriter {
		public:
			explicit ObjectWriter(ModuleLoweringContext &context);

			void writeIrFile();
			bool writeObjectFile();

		private:
			ModuleLoweringContext &context;
	};

} // namespace yogi::core::llvm::internal
#endif
