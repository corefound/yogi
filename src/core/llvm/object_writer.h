#pragma once

#include "lowering_context.h"

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class ObjectWriter {
		public:
			explicit ObjectWriter(ModuleLoweringContext &context);

			void write_ir_file();
			bool write_object_file();

		private:
			ModuleLoweringContext &context_;
	};

} // namespace yogi::core::llvm::internal
#endif
