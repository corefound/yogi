// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

namespace yogi::runtime {

	class RuntimeError final {
		public:
			[[noreturn]] static void abortAllocation(const char *typeName);
			[[noreturn]] static void abortCast(const char *fromType, const char *toType);
			[[noreturn]] static void abortOwnership(const char *reason, const void *address, const char *typeName);
	};

} // namespace yogi::runtime
