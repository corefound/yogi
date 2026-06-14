#include "yogi/runtime.h"

#include <cassert>
#include <cstring>

int main() {
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

	return 0;
}
