#include "yogi/runtime.h"

#include <cassert>
#include <cstring>

int main() {
	const auto before = yogi_memory_live_allocations();
	const auto *trimmed = yogi_string_trim("  yogi  ");

	assert(std::strcmp(trimmed, "yogi") == 0);
	assert(yogi_memory_live_allocations() == before + 1);

	yogi_string_destroy(trimmed);
	assert(yogi_memory_live_allocations() == before);

	yogi_string_destroy("literal");
	assert(yogi_memory_live_allocations() == before);

	return 0;
}
