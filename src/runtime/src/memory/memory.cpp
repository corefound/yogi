// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/memory.h"

#include "yogi/runtime.h"
#include "yogi/runtime/debug/ownership.h"
#include "yogi/runtime/errors.h"

#include <cstdlib>

#if defined(YOGI_USE_MIMALLOC)
#include <mimalloc.h>
#elif defined(YOGI_USE_JEMALLOC)
#define JEMALLOC_NO_DEMANGLE
#include <jemalloc/jemalloc.h>
#endif

namespace {

	void *allocatorAlloc(std::size_t size) {
		const auto actualSize = size == 0 ? 1 : size;

#if defined(YOGI_USE_MIMALLOC)
		return mi_malloc(actualSize);
#elif defined(YOGI_USE_JEMALLOC)
		return je_mallocx(actualSize, 0);
#else
		return std::malloc(actualSize);
#endif
	}

	void *allocatorRealloc(void *address, std::size_t newSize) {
		const auto actualSize = newSize == 0 ? 1 : newSize;

#if defined(YOGI_USE_MIMALLOC)
		return mi_realloc(address, actualSize);
#elif defined(YOGI_USE_JEMALLOC)
		if (!address) {
			return je_mallocx(actualSize, 0);
		}

		return je_rallocx(address, actualSize, 0);
#else
		return std::realloc(address, actualSize);
#endif
	}

	void allocatorFree(void *address) {
		if (!address) {
			return;
		}

#if defined(YOGI_USE_MIMALLOC)
		mi_free(address);
#elif defined(YOGI_USE_JEMALLOC)
		je_dallocx(address, 0);
#else
		std::free(address);
#endif
	}

}

namespace yogi::runtime {

	const char *MemoryManager::allocatorName() {
		#if defined(YOGI_USE_MIMALLOC)
		return "mimalloc";
		#elif defined(YOGI_USE_JEMALLOC)
		return "jemalloc";
		#else
		return "system";
		#endif
	}

	void *MemoryManager::allocate(std::size_t size, const char *typeName) {
		void *address = allocatorAlloc(size);

		if (!address) {
			RuntimeError::abortAllocation(typeName);
		}

		OwnershipTracker::recordAllocation(address, size, typeName);
		return address;
	}

	void *MemoryManager::reallocate(void *address, std::size_t newSize, const char *typeName) {
		void *nextAddress = allocatorRealloc(address, newSize);

		if (!nextAddress) {
			RuntimeError::abortAllocation(typeName);
		}

		OwnershipTracker::recordReallocation(address, nextAddress, newSize, typeName);
		return nextAddress;
	}

	void MemoryManager::deallocate(void *address) {
		OwnershipTracker::recordDeallocation(address);
		allocatorFree(address);
	}

} // namespace yogi::runtime

extern "C" {

void *yogi_alloc(unsigned long long size) {
	return yogi::runtime::MemoryManager::allocate(static_cast<std::size_t>(size), "raw allocation");
}

void *yogi_realloc(void *address, unsigned long long newSize) {
	return yogi::runtime::MemoryManager::reallocate(
		address,
		static_cast<std::size_t>(newSize),
		"raw reallocation"
	);
}

void yogi_free(void *address) {
	yogi::runtime::MemoryManager::deallocate(address);
}

const char *yogi_allocator_name() {
	return yogi::runtime::MemoryManager::allocatorName();
}

}
