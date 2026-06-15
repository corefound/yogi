// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime.h"

#include <cassert>
#include <cstring>

int main() {
	yogi_debug_ownership_reset();
	assert(yogi_debug_ownership_enabled());

	void *raw = yogi_alloc(32);
	assert(raw != nullptr);
	raw = yogi_realloc(raw, 64);
	assert(raw != nullptr);
	assert(yogi_debug_ownership_live_allocations() == 1);
	yogi_free(raw);
	assert(yogi_debug_ownership_live_allocations() == 0);

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
