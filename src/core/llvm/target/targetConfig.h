// Created by Brayhan De Aza on 7/18/26.
//

#pragma once

#if YOGI_HAS_LLVM
#include <llvm/TargetParser/Triple.h>

namespace yogi::core::llvm::internal {

	::llvm::Triple configuredTargetTriple();

} // namespace yogi::core::llvm::internal
#endif
