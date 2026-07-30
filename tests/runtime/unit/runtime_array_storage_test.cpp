#include "yogi/runtime.h"

#include <cassert>
#include <cstring>

namespace {
	struct ResourceCounters {
		int destroyed = 0;
		int moved = 0;
	};

	void destroyResourceElement(void *value, void *context) {
		auto *counters = static_cast<ResourceCounters *>(context);
		auto *object = yogi_any_to_object(value);
		assert(yogi_object_get(object, "resource") != nullptr);
		++counters->destroyed;
	}

	void *moveResourceElement(void *value, void *context) {
		auto *counters = static_cast<ResourceCounters *>(context);
		++counters->moved;
		return value;
	}

	void *resourceElement(void *resource) {
		auto *object = yogi_object_create();
		yogi_object_set_unboxed(object, "resource", resource);
		return yogi_any_from_object(object);
	}
} // namespace

int main() {
	yogi_debug_ownership_reset();
	const auto baselineAllocations = yogi_memory_live_allocations();

	void *array = yogi_array_create_with_storage(1, "contiguous_fast_path");
	assert(std::strcmp(yogi_array_storage_mode(array), "contiguous_fast_path") == 0);
	yogi_array_set(array, 0, yogi_any_from_number(20));

	void *cell = yogi_array_pointer_cell(array, 0);
	assert(cell != nullptr);
	assert(std::strcmp(yogi_array_storage_mode(array), "pointer_safe_chunked_mode") == 0);

	yogi_array_push(array, yogi_any_from_number(30));
	yogi_pointer_cell_set(cell, yogi_any_from_number(99));
	assert(yogi_any_to_number(yogi_array_get(array, 0)) == 99);
	assert(yogi_any_to_number(yogi_array_get(array, 1)) == 30);
	yogi_array_destroy(array);

	void *source = yogi_array_create_with_storage(2, "contiguous_fast_path");
	yogi_array_set(source, 0, yogi_any_from_number(1));
	yogi_array_set(source, 1, yogi_any_from_number(2));
	void *view = yogi_array_view(source, 1, 1);
	void *viewCell = yogi_array_pointer_cell(view, 0);
	assert(viewCell != nullptr);
	assert(std::strcmp(yogi_array_storage_mode(source), "pointer_safe_chunked_mode") == 0);
	yogi_pointer_cell_set(viewCell, yogi_any_from_number(50));
	assert(yogi_any_to_number(yogi_array_get(source, 1)) == 50);

	yogi_array_destroy(view);
	yogi_array_destroy(source);

	void *replacementTarget = yogi_array_create_with_storage(2, "pointer_safe_chunked_mode");
	yogi_array_set(replacementTarget, 0, yogi_any_from_number(10));
	yogi_array_set(replacementTarget, 1, yogi_any_from_number(20));
	void *preservedCell = yogi_array_pointer_cell(replacementTarget, 0);

	void *replacementSource = yogi_array_create(3);
	yogi_array_set(replacementSource, 0, yogi_any_from_number(90));
	yogi_array_set(replacementSource, 1, yogi_any_from_number(100));
	yogi_array_set(replacementSource, 2, yogi_any_from_number(110));
	yogi_array_replace_from(replacementTarget, replacementSource);

	assert(yogi_array_length(replacementSource) == 3);
	assert(yogi_any_to_number(yogi_array_get(replacementSource, 0)) == 90);
	assert(yogi_any_to_number(yogi_pointer_cell_get(preservedCell)) == 90);
	yogi_array_set(replacementTarget, 0, yogi_any_from_number(99));
	assert(yogi_any_to_number(yogi_array_get(replacementSource, 0)) == 90);

	// Copy replacement materializes before mutation, including self and aliasing views.
	yogi_array_replace_from(replacementTarget, replacementTarget);
	assert(yogi_array_length(replacementTarget) == 3);
	assert(yogi_any_to_number(yogi_array_get(replacementTarget, 0)) == 99);
	void *replacementView = yogi_array_view(replacementTarget, 1, 2);
	yogi_array_replace_from(replacementTarget, replacementView);
	assert(yogi_array_length(replacementTarget) == 2);
	assert(yogi_any_to_number(yogi_array_get(replacementTarget, 0)) == 100);
	assert(yogi_any_to_number(yogi_array_get(replacementTarget, 1)) == 110);
	yogi_array_destroy(replacementView);

	void *moveSource = yogi_array_create(1);
	yogi_array_set(moveSource, 0, yogi_any_from_number(200));
	yogi_array_move_replace_from(replacementTarget, moveSource);
	assert(yogi_array_length(moveSource) == 0);
	assert(yogi_array_length(replacementTarget) == 1);
	assert(yogi_any_to_number(yogi_pointer_cell_get(preservedCell)) == 200);

	yogi_array_destroy(moveSource);
	yogi_array_destroy(replacementSource);
	yogi_array_destroy(replacementTarget);

	ResourceCounters counters;
	int resources[3] = {1, 2, 3};
	void *owned = yogi_array_create(0);
	yogi_array_set_element_ownership_policy(owned, true, destroyResourceElement, moveResourceElement, &counters, "runtime-test-resource");
	assert(yogi_array_has_resource_owning_elements(owned));

	yogi_array_push(owned, resourceElement(&resources[0]));
	yogi_array_push(owned, resourceElement(&resources[1]));
	yogi_array_push(owned, resourceElement(&resources[2]));
	yogi_array_pop_discard(owned);
	assert(counters.destroyed == 1);
	assert(counters.moved == 1);

	void *removed = yogi_array_splice(owned, 0, 1, nullptr);
	assert(yogi_array_has_resource_owning_elements(removed));
	assert(counters.destroyed == 1);
	assert(counters.moved == 2);
	yogi_array_destroy(removed);
	assert(counters.destroyed == 2);

	yogi_array_destroy(owned);
	assert(counters.destroyed == 3);

	int pointerValues[2] = {10, 20};
	void *pointerArray = yogi_array_create(2);
	yogi_array_set_boxed_elements(pointerArray, false);
	yogi_array_set(pointerArray, 0, &pointerValues[0]);
	yogi_array_set(pointerArray, 1, &pointerValues[1]);
	assert(yogi_array_get(pointerArray, 0) == &pointerValues[0]);
	assert(yogi_array_get(pointerArray, 1) == &pointerValues[1]);
	yogi_array_destroy(pointerArray);

	assert(yogi_debug_ownership_live_aggregates() == 0);
	assert(yogi_memory_live_allocations() == baselineAllocations);

	return 0;
}
