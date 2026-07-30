// Created by Brayhan De Aza on 7/22/26.
//

#include "yogi/runtime.h"

#include <cassert>
#include <cstdio>

int main() {
	constexpr unsigned long long allocationCount = 40;
	void *allocations[allocationCount] = {};
	const char *moduleName = "runtime-telemetry-test";
	const char *functionName = "attribution-growth";
	const auto baseLiveBytes = yogi_memory_live_bytes();
	const auto baseLiveAllocations = yogi_memory_live_allocations();
	const auto baseAttributedLiveBytes = yogi_memory_attributed_live_bytes(moduleName, functionName);
	const auto baseAttributedLiveAllocations = yogi_memory_attributed_live_allocations(moduleName, functionName);
	unsigned long long expectedBytes = 0;

	yogi_debug_ownership_reset();
	yogi_memory_push_context(moduleName, functionName);

	for (unsigned long long index = 0; index < allocationCount; ++index) {
		char sourcePath[64] = {};
		std::snprintf(sourcePath, sizeof(sourcePath), "telemetry-source-%llu.ts", index);
		const auto size = index + 1;

		yogi_memory_push_source_location(sourcePath, index + 1, 1);
		allocations[index] = yogi_alloc(size);
		yogi_memory_pop_source_location();

		assert(allocations[index] != nullptr);
		expectedBytes += size;
	}

	// More than 32 distinct attribution records forces the telemetry table to grow.
	// Every live allocation must still resolve its original attribution afterward.
	assert(yogi_memory_live_bytes() == baseLiveBytes + expectedBytes);
	assert(yogi_memory_live_allocations() == baseLiveAllocations + allocationCount);
	assert(yogi_memory_attributed_live_bytes(moduleName, functionName) == baseAttributedLiveBytes + expectedBytes);
	assert(
		yogi_memory_attributed_live_allocations(moduleName, functionName) ==
		baseAttributedLiveAllocations + allocationCount
	);

	for (auto *allocation : allocations) {
		yogi_free(allocation);
	}

	assert(yogi_memory_live_bytes() == baseLiveBytes);
	assert(yogi_memory_live_allocations() == baseLiveAllocations);
	assert(yogi_memory_attributed_live_bytes(moduleName, functionName) == baseAttributedLiveBytes);
	assert(yogi_memory_attributed_live_allocations(moduleName, functionName) == baseAttributedLiveAllocations);
	assert(yogi_debug_ownership_live_allocations() == 0);

	yogi_memory_pop_context();
	return 0;
}
