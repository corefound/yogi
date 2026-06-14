#pragma once

#include <cstddef>

namespace yogi::runtime {

	class MemoryManager final {
		public:
			static void *allocate(std::size_t size, const char *typeName);
	};

} // namespace yogi::runtime
