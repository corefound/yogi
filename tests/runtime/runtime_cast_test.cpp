// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime.h"

#include <cassert>
#include <cstring>

#ifndef YOGI_EXPECTED_ALLOCATOR
#define YOGI_EXPECTED_ALLOCATOR "mimalloc"
#endif

int main() {
	yogi_debug_ownership_reset();
	assert(yogi_debug_ownership_enabled());
	assert(std::strcmp(yogi_allocator_name(), YOGI_EXPECTED_ALLOCATOR) == 0);

	const char *moduleName = "runtime-test";
	const char *functionName = "cast-test";
	const char *sourcePath = "tests/runtime/runtime_cast_test.io";
	const unsigned long long sourceLine = 12;
	const unsigned long long sourceColumn = 5;
	const auto baseLiveBytes = yogi_memory_live_bytes();
	const auto baseLiveAllocations = yogi_memory_live_allocations();
	const auto baseAllocatedBytes = yogi_memory_total_allocated_bytes();
	const auto baseFreedBytes = yogi_memory_total_freed_bytes();
	const auto baseAttributedAllocatedBytes = yogi_memory_attributed_total_allocated_bytes(moduleName, functionName);
	const auto baseAttributedFreedBytes = yogi_memory_attributed_total_freed_bytes(moduleName, functionName);
	const auto baseLocationAllocatedBytes = yogi_memory_attributed_location_total_allocated_bytes(
		sourcePath,
		sourceLine,
		sourceColumn
	);
	const auto baseLocationFreedBytes = yogi_memory_attributed_location_total_freed_bytes(
		sourcePath,
		sourceLine,
		sourceColumn
	);

	yogi_memory_push_context(moduleName, functionName);
	assert(std::strcmp(yogi_memory_current_module(), moduleName) == 0);
	assert(std::strcmp(yogi_memory_current_function(), functionName) == 0);
	yogi_memory_push_source_location(sourcePath, sourceLine, sourceColumn);
	assert(std::strcmp(yogi_memory_current_source_path(), sourcePath) == 0);
	assert(yogi_memory_current_source_line() == sourceLine);
	assert(yogi_memory_current_source_column() == sourceColumn);

	void *raw = yogi_alloc(32);
	assert(raw != nullptr);
	assert(yogi_memory_live_bytes() == baseLiveBytes + 32);
	assert(yogi_memory_live_allocations() == baseLiveAllocations + 1);
	assert(yogi_memory_total_allocated_bytes() == baseAllocatedBytes + 32);
	assert(yogi_memory_attributed_live_bytes(moduleName, functionName) == 32);
	assert(yogi_memory_attributed_live_allocations(moduleName, functionName) == 1);
	assert(yogi_memory_attributed_location_live_bytes(sourcePath, sourceLine, sourceColumn) == 32);
	assert(yogi_memory_attributed_location_live_allocations(sourcePath, sourceLine, sourceColumn) == 1);

	raw = yogi_realloc(raw, 64);
	assert(raw != nullptr);
	assert(yogi_debug_ownership_live_allocations() == 1);
	assert(yogi_memory_live_bytes() == baseLiveBytes + 64);
	assert(yogi_memory_live_allocations() == baseLiveAllocations + 1);
	assert(yogi_memory_total_allocated_bytes() == baseAllocatedBytes + 96);
	assert(yogi_memory_total_freed_bytes() == baseFreedBytes + 32);
	assert(yogi_memory_peak_bytes() >= baseLiveBytes + 64);
	assert(yogi_memory_attributed_live_bytes(moduleName, functionName) == 64);
	assert(yogi_memory_attributed_live_allocations(moduleName, functionName) == 1);
	assert(yogi_memory_attributed_total_allocated_bytes(moduleName, functionName) == baseAttributedAllocatedBytes + 96);
	assert(yogi_memory_attributed_total_freed_bytes(moduleName, functionName) == baseAttributedFreedBytes + 32);
	assert(yogi_memory_attributed_peak_bytes(moduleName, functionName) >= 64);
	assert(yogi_memory_attributed_location_live_bytes(sourcePath, sourceLine, sourceColumn) == 64);
	assert(yogi_memory_attributed_location_live_allocations(sourcePath, sourceLine, sourceColumn) == 1);
	assert(
		yogi_memory_attributed_location_total_allocated_bytes(sourcePath, sourceLine, sourceColumn) ==
		baseLocationAllocatedBytes + 96
	);
	assert(
		yogi_memory_attributed_location_total_freed_bytes(sourcePath, sourceLine, sourceColumn) ==
		baseLocationFreedBytes + 32
	);
	assert(yogi_memory_attributed_location_peak_bytes(sourcePath, sourceLine, sourceColumn) >= 64);

	yogi_free(raw);
	assert(yogi_debug_ownership_live_allocations() == 0);
	assert(yogi_memory_live_bytes() == baseLiveBytes);
	assert(yogi_memory_live_allocations() == baseLiveAllocations);
	assert(yogi_memory_total_freed_bytes() == baseFreedBytes + 96);
	assert(yogi_memory_attributed_live_bytes(moduleName, functionName) == 0);
	assert(yogi_memory_attributed_live_allocations(moduleName, functionName) == 0);
	assert(yogi_memory_attributed_total_freed_bytes(moduleName, functionName) == baseAttributedFreedBytes + 96);
	assert(yogi_memory_attributed_location_live_bytes(sourcePath, sourceLine, sourceColumn) == 0);
	assert(yogi_memory_attributed_location_live_allocations(sourcePath, sourceLine, sourceColumn) == 0);
	assert(
		yogi_memory_attributed_location_total_freed_bytes(sourcePath, sourceLine, sourceColumn) ==
		baseLocationFreedBytes + 96
	);
	yogi_memory_pop_source_location();
	assert(std::strcmp(yogi_memory_current_source_path(), "<unknown>") == 0);
	assert(yogi_memory_current_source_line() == 0);
	assert(yogi_memory_current_source_column() == 0);

	const auto nullFreeLiveBytes = yogi_memory_live_bytes();
	const auto nullFreeLiveAllocations = yogi_memory_live_allocations();
	const auto nullFreeFreedBytes = yogi_memory_total_freed_bytes();
	yogi_free(nullptr);
	assert(yogi_memory_live_bytes() == nullFreeLiveBytes);
	assert(yogi_memory_live_allocations() == nullFreeLiveAllocations);
	assert(yogi_memory_total_freed_bytes() == nullFreeFreedBytes);

	const auto reallocNullLiveBytes = yogi_memory_live_bytes();
	const auto reallocNullLiveAllocations = yogi_memory_live_allocations();
	const auto reallocNullAllocatedBytes = yogi_memory_total_allocated_bytes();
	void *fromNull = yogi_realloc(nullptr, 16);
	assert(fromNull != nullptr);
	assert(yogi_debug_ownership_live_allocations() == 1);
	assert(yogi_memory_live_bytes() == reallocNullLiveBytes + 16);
	assert(yogi_memory_live_allocations() == reallocNullLiveAllocations + 1);
	assert(yogi_memory_total_allocated_bytes() == reallocNullAllocatedBytes + 16);
	yogi_free(fromNull);
	assert(yogi_debug_ownership_live_allocations() == 0);
	yogi_memory_pop_context();
	assert(std::strcmp(yogi_memory_current_module(), "<runtime>") == 0);
	yogi_memory_debug_report();

	void *number = yogi_any_from_number(42.5);
	assert(yogi_any_to_number(number) == 42.5);

	void *boolean = yogi_any_from_boolean(true);
	assert(yogi_any_to_boolean(boolean));

	void *string = yogi_any_from_string("audio.mp3");
	assert(std::strcmp(yogi_any_to_string(string), "audio.mp3") == 0);

	void *nullValue = yogi_any_null();
	assert(yogi_any_to_null(nullValue) == nullptr);

	void *undefinedValue = yogi_any_undefined();
	assert(yogi_any_to_undefined(undefinedValue) == nullptr);
	assert(yogi_any_is_nullish(undefinedValue));

	void *object = yogi_object_create();
	assert(yogi_debug_ownership_live_aggregates() == 1);
	yogi_object_set(object, "name", yogi_any_from_string("Ana"));
	assert(std::strcmp(yogi_any_to_string(yogi_object_get(object, "name")), "Ana") == 0);
	assert(yogi_any_is_nullish(yogi_object_get(object, "missing")));
	yogi_object_destroy(object);
	assert(yogi_debug_ownership_live_aggregates() == 0);

	void *array = yogi_array_create(2);
	assert(yogi_debug_ownership_live_aggregates() == 1);
	yogi_array_set(array, 1, yogi_any_from_number(10));
	assert(yogi_any_to_number(yogi_array_get(array, 1)) == 10);
	assert(yogi_any_is_nullish(yogi_array_get(array, 3)));
	yogi_array_destroy(array);
	assert(yogi_debug_ownership_live_aggregates() == 0);

	return 0;
}
