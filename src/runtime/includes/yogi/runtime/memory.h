// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include <cstddef>

namespace yogi::runtime {

	class MemoryManager final {
		public:
			static void *allocate(std::size_t size, const char *typeName);
			static void *reallocate(void *address, std::size_t newSize, const char *typeName);
			static void deallocate(void *address);
	};

} // namespace yogi::runtime
