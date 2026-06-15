// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include <cstddef>

namespace yogi::runtime {

	class OwnershipTracker final {
		public:
			static bool enabled();

			static void recordAllocation(void *address, std::size_t size, const char *typeName);
			static void recordReallocation(void *oldAddress, void *newAddress, std::size_t size, const char *typeName);
			static void recordDeallocation(void *address);

			static void markHeapAggregate(void *address, const char *typeName);
			static void registerStackAggregate(void *address, const char *typeName);
			static void dropStackAggregate(void *address, const char *typeName);
			static void destroyHeapAggregate(void *address, const char *typeName);
			static void assertLiveAggregate(void *address, const char *operation, const char *typeName);

			static std::size_t liveAllocations();
			static std::size_t liveAggregates();
			static std::size_t reportLeaks();
			static void reset();
	};

} // namespace yogi::runtime
