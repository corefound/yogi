// Created by Brayhan De Aza on 6/15/26.
//

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

	void RuntimeError::abortOwnership(const char *reason, const void *address, const char *typeName) {
		std::fprintf(
			stderr,
			"yogi runtime ownership error: %s at %p",
			reason ? reason : "ownership violation",
			address
		);

		if (typeName) {
			std::fprintf(stderr, " (%s)", typeName);
		}

		std::fprintf(stderr, "\n");
		std::abort();
	}

} // namespace yogi::runtime
