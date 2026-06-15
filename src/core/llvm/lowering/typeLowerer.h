// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "llvm/context/loweringContext.h"

#if YOGI_HAS_LLVM
namespace yogi::core::llvm::internal {

	class TypeLowerer {
		public:
			explicit TypeLowerer(ModuleLoweringContext &context);

			::llvm::Type *lower(const Yogi::Sir::TypeRef *type);
			::llvm::Constant *zero(::llvm::Type *type);

		private:
			ModuleLoweringContext &context;
	};

} // namespace yogi::core::llvm::internal
#endif
