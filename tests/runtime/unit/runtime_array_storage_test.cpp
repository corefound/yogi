#include "yogi/runtime.h"

#include <cassert>
#include <cstring>

int main() {
	yogi_debug_ownership_reset();

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
	assert(yogi_debug_ownership_live_aggregates() == 0);

	return 0;
}
