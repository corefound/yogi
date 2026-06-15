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
			static void report();
	};

} // namespace yogi::runtime
