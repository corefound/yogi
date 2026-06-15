// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include <cstddef>

namespace yogi::runtime {

	class MemoryManager final {
		public:
			static const char *allocatorName();
			static void *allocate(std::size_t size, const char *typeName);
			static void *reallocate(void *address, std::size_t newSize, const char *typeName);
			static void deallocate(void *address);
			static std::size_t liveBytes();
			static std::size_t liveAllocations();
			static std::size_t totalAllocatedBytes();
			static std::size_t totalFreedBytes();
			static std::size_t peakBytes();
			static void pushMemoryContext(const char *moduleName, const char *functionName);
			static void popMemoryContext();
			static const char *currentMemoryModule();
			static const char *currentMemoryFunction();
			static std::size_t attributedLiveBytes(const char *moduleName, const char *functionName);
			static std::size_t attributedLiveAllocations(const char *moduleName, const char *functionName);
			static std::size_t attributedTotalAllocatedBytes(const char *moduleName, const char *functionName);
			static std::size_t attributedTotalFreedBytes(const char *moduleName, const char *functionName);
			static std::size_t attributedPeakBytes(const char *moduleName, const char *functionName);
			static void reportMemoryTelemetry();
	};

} // namespace yogi::runtime
