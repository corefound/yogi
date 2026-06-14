#include "yogi/runtime/memory.h"

#include "yogi/runtime/errors.h"

#include <cstdlib>

namespace yogi::runtime {

	void *MemoryManager::allocate(std::size_t size, const char *typeName) {
		void *address = std::malloc(size);

		if (!address) {
			RuntimeError::abortAllocation(typeName);
		}

		return address;
	}

} // namespace yogi::runtime
