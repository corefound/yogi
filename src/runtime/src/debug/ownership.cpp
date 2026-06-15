// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/debug/ownership.h"

#include "yogi/runtime.h"
#include "yogi/runtime/errors.h"

#include <cstdio>
#include <cstdlib>

namespace yogi::runtime {

#if YOGI_RUNTIME_DEBUG_OWNERSHIP
	namespace {
		struct OwnershipRecord {
			void *address = nullptr;
			std::size_t size = 0;
			const char *typeName = nullptr;
			bool allocationKnown = false;
			bool allocationAlive = false;
			bool aggregateKnown = false;
			bool aggregateAlive = false;
			bool stackAggregate = false;
		};

		OwnershipRecord *records = nullptr;
		std::size_t recordCount = 0;
		std::size_t recordCapacity = 0;

		const char *safeTypeName(const char *typeName) {
			return typeName ? typeName : "unknown";
		}

		OwnershipRecord *findRecord(void *address) {
			for (std::size_t index = 0; index < recordCount; ++index) {
				if (records[index].address == address) {
					return &records[index];
				}
			}

			return nullptr;
		}

		OwnershipRecord *ensureRecord(void *address) {
			if (auto *record = findRecord(address)) {
				return record;
			}

			if (recordCount == recordCapacity) {
				const auto nextCapacity = recordCapacity == 0 ? 64 : recordCapacity * 2;
				auto *nextRecords = static_cast<OwnershipRecord *>(
					std::realloc(records, sizeof(OwnershipRecord) * nextCapacity)
				);

				if (!nextRecords) {
					RuntimeError::abortAllocation("ownership debug records");
				}

				records = nextRecords;
				recordCapacity = nextCapacity;
			}

			auto *record = &records[recordCount++];
			*record = {};
			record->address = address;
			return record;
		}
	}
#endif

	bool OwnershipTracker::enabled() {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		return true;
#else
		return false;
#endif
	}

	void OwnershipTracker::recordAllocation(void *address, std::size_t size, const char *typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		if (!address) {
			return;
		}

		auto *record = ensureRecord(address);
		record->size = size;
		record->typeName = safeTypeName(typeName);
		record->allocationKnown = true;
		record->allocationAlive = true;
#else
		(void) address;
		(void) size;
		(void) typeName;
#endif
	}

	void OwnershipTracker::recordReallocation(void *oldAddress, void *newAddress, std::size_t size, const char *typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		if (!oldAddress) {
			recordAllocation(newAddress, size, typeName);
			return;
		}

		auto *oldRecord = findRecord(oldAddress);

		if (!oldRecord || !oldRecord->allocationKnown) {
			RuntimeError::abortOwnership("invalid realloc", oldAddress, typeName);
		}

		if (!oldRecord->allocationAlive) {
			RuntimeError::abortOwnership("realloc after free", oldAddress, oldRecord->typeName);
		}

		if (oldAddress != newAddress) {
			oldRecord->allocationAlive = false;
			oldRecord->aggregateAlive = false;
		}

		auto *newRecord = ensureRecord(newAddress);
		*newRecord = *oldRecord;
		newRecord->address = newAddress;
		newRecord->size = size;
		newRecord->typeName = safeTypeName(typeName);
		newRecord->allocationAlive = true;
#else
		(void) oldAddress;
		(void) newAddress;
		(void) size;
		(void) typeName;
#endif
	}

	void OwnershipTracker::recordDeallocation(void *address) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		if (!address) {
			return;
		}

		auto *record = findRecord(address);

		if (!record || !record->allocationKnown) {
			RuntimeError::abortOwnership("invalid free", address, nullptr);
		}

		if (!record->allocationAlive) {
			RuntimeError::abortOwnership("double free", address, record->typeName);
		}

		if (record->aggregateAlive) {
			RuntimeError::abortOwnership("free of live aggregate without destroy/drop", address, record->typeName);
		}

		record->allocationAlive = false;
#else
		(void) address;
#endif
	}

	void OwnershipTracker::markHeapAggregate(void *address, const char *typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		if (!address) {
			return;
		}

		auto *record = ensureRecord(address);
		record->typeName = safeTypeName(typeName);
		record->aggregateKnown = true;
		record->aggregateAlive = true;
		record->stackAggregate = false;
		record->allocationKnown = true;
		record->allocationAlive = true;
#else
		(void) address;
		(void) typeName;
#endif
	}

	void OwnershipTracker::registerStackAggregate(void *address, const char *typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		if (!address) {
			return;
		}

		auto *record = ensureRecord(address);
		record->typeName = safeTypeName(typeName);
		record->aggregateKnown = true;
		record->aggregateAlive = true;
		record->stackAggregate = true;
		record->allocationKnown = false;
		record->allocationAlive = false;
#else
		(void) address;
		(void) typeName;
#endif
	}

	void OwnershipTracker::dropStackAggregate(void *address, const char *typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		if (!address) {
			return;
		}

		auto *record = findRecord(address);

		if (!record || !record->aggregateKnown) {
			RuntimeError::abortOwnership("drop of unknown aggregate", address, typeName);
		}

		if (!record->aggregateAlive) {
			RuntimeError::abortOwnership("double drop/destroy", address, record->typeName);
		}

		if (!record->stackAggregate) {
			RuntimeError::abortOwnership("drop used for heap aggregate", address, record->typeName);
		}

		record->aggregateAlive = false;
#else
		(void) address;
		(void) typeName;
#endif
	}

	void OwnershipTracker::destroyHeapAggregate(void *address, const char *typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		if (!address) {
			return;
		}

		auto *record = findRecord(address);

		if (!record || !record->aggregateKnown) {
			RuntimeError::abortOwnership("destroy of unknown aggregate", address, typeName);
		}

		if (!record->aggregateAlive) {
			RuntimeError::abortOwnership("double drop/destroy", address, record->typeName);
		}

		if (record->stackAggregate) {
			RuntimeError::abortOwnership("destroy used for stack aggregate", address, record->typeName);
		}

		record->aggregateAlive = false;
#else
		(void) address;
		(void) typeName;
#endif
	}

	void OwnershipTracker::assertLiveAggregate(void *address, const char *operation, const char *typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		if (!address) {
			return;
		}

		auto *record = findRecord(address);

		if (!record || !record->aggregateKnown) {
			RuntimeError::abortOwnership(operation ? operation : "aggregate access on unknown value", address, typeName);
		}

		if (!record->aggregateAlive) {
			RuntimeError::abortOwnership(operation ? operation : "aggregate access after destroy/drop", address, record->typeName);
		}
#else
		(void) address;
		(void) operation;
		(void) typeName;
#endif
	}

	std::size_t OwnershipTracker::liveAllocations() {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		std::size_t count = 0;

		for (std::size_t index = 0; index < recordCount; ++index) {
			if (records[index].allocationAlive) {
				++count;
			}
		}

		return count;
#else
		return 0;
#endif
	}

	std::size_t OwnershipTracker::liveAggregates() {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		std::size_t count = 0;

		for (std::size_t index = 0; index < recordCount; ++index) {
			if (records[index].aggregateAlive) {
				++count;
			}
		}

		return count;
#else
		return 0;
#endif
	}

	std::size_t OwnershipTracker::reportLeaks() {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		std::size_t count = 0;

		for (std::size_t index = 0; index < recordCount; ++index) {
			const auto &record = records[index];

			if (!record.allocationAlive && !record.aggregateAlive) {
				continue;
			}

			++count;
			std::fprintf(
				stderr,
				"yogi runtime ownership leak: %p (%s)%s%s\n",
				record.address,
				record.typeName ? record.typeName : "unknown",
				record.allocationAlive ? " allocation-live" : "",
				record.aggregateAlive ? " aggregate-live" : ""
			);
		}

		return count;
#else
		return 0;
#endif
	}

	void OwnershipTracker::reset() {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
		std::free(records);
		records = nullptr;
		recordCount = 0;
		recordCapacity = 0;
#endif
	}

} // namespace yogi::runtime

extern "C" {

bool yogi_debug_ownership_enabled(void) {
	return yogi::runtime::OwnershipTracker::enabled();
}

unsigned long long yogi_debug_ownership_live_allocations(void) {
	return static_cast<unsigned long long>(yogi::runtime::OwnershipTracker::liveAllocations());
}

unsigned long long yogi_debug_ownership_live_aggregates(void) {
	return static_cast<unsigned long long>(yogi::runtime::OwnershipTracker::liveAggregates());
}

unsigned long long yogi_debug_ownership_report_leaks(void) {
	return static_cast<unsigned long long>(yogi::runtime::OwnershipTracker::reportLeaks());
}

void yogi_debug_ownership_reset(void) {
	yogi::runtime::OwnershipTracker::reset();
}

}
