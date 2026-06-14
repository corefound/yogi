#include "yogi/runtime/errors.h"

#include <cstdio>
#include <cstdlib>

namespace yogi::runtime {

	void RuntimeError::abortAllocation(const char *typeName) {
		std::fprintf(
			stderr,
			"yogi runtime error: failed to allocate %s\n",
			typeName ? typeName : "value"
		);
		std::abort();
	}

	void RuntimeError::abortCast(const char *fromType, const char *toType) {
		std::fprintf(
			stderr,
			"yogi runtime error: cannot cast value of type '%s' to '%s'\n",
			fromType ? fromType : "unknown",
			toType ? toType : "unknown"
		);
		std::abort();
	}

} // namespace yogi::runtime
