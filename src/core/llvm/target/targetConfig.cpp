// Created by Brayhan De Aza on 7/18/26.
//

#include "llvm/target/targetConfig.h"

#if YOGI_HAS_LLVM
#include <string>

#include <llvm/TargetParser/Host.h>

#ifndef YOGI_MACOS_DEPLOYMENT_TARGET
#define YOGI_MACOS_DEPLOYMENT_TARGET ""
#endif

namespace yogi::core::llvm::internal {

	::llvm::Triple configuredTargetTriple() {
		::llvm::Triple targetTriple(::llvm::sys::getDefaultTargetTriple());

		#if defined(__APPLE__)
		const std::string deploymentTarget = YOGI_MACOS_DEPLOYMENT_TARGET;
		if (!deploymentTarget.empty()) {
			const auto architectureName = targetTriple.getArchName().str();
			targetTriple = ::llvm::Triple(architectureName + "-apple-macosx" + deploymentTarget);
		}
		#endif

		return targetTriple;
	}

} // namespace yogi::core::llvm::internal
#endif
