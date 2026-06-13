#pragma once

#include "lowering_context.h"

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class TypeLowerer {
		public:
			explicit TypeLowerer(ModuleLoweringContext &context);

			::llvm::Type *lower(const Yogi::Sir::TypeRef *type);
			::llvm::Constant *zero(::llvm::Type *type);

		private:
			ModuleLoweringContext &context_;
	};

} // namespace yogi::core::llvm::internal
#endif
