// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include <cstddef>

namespace yogi::runtime {

	class MemoryTelemetry final {
		public:
			static void recordAllocation(void *address, std::size_t size, const char *typeName);
			static void recordReallocation(
				void *oldAddress,
				void *newAddress,
				std::size_t newSize,
				const char *typeName
			);
			static void recordDeallocation(void *address);

			static std::size_t liveBytes();
			static std::size_t liveAllocations();
			static std::size_t totalAllocatedBytes();
			static std::size_t totalFreedBytes();
			static std::size_t peakBytes();
			static void pushContext(const char *moduleName, const char *functionName);
			static void popContext();
			static const char *currentModule();
			static const char *currentFunction();
			static std::size_t attributedLiveBytes(const char *moduleName, const char *functionName);
			static std::size_t attributedLiveAllocations(const char *moduleName, const char *functionName);
			static std::size_t attributedTotalAllocatedBytes(const char *moduleName, const char *functionName);
			static std::size_t attributedTotalFreedBytes(const char *moduleName, const char *functionName);
			static std::size_t attributedPeakBytes(const char *moduleName, const char *functionName);
			static void report();
	};

} // namespace yogi::runtime
