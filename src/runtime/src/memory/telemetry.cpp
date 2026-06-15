// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/memory/telemetry.h"

#include "yogi/runtime/errors.h"

#include <cstdio>
#include <cstdlib>

namespace yogi::runtime {

	namespace {
		struct AllocationRecord {
			void *address = nullptr;
			std::size_t size = 0;
			const char *typeName = nullptr;
			bool alive = false;
		};

		AllocationRecord *records = nullptr;
		std::size_t recordCount = 0;
		std::size_t recordCapacity = 0;
		std::size_t currentLiveBytes = 0;
		std::size_t currentLiveAllocations = 0;
		std::size_t allocatedBytes = 0;
		std::size_t freedBytes = 0;
		std::size_t highestLiveBytes = 0;

		const char *safeTypeName(const char *typeName) {
			return typeName ? typeName : "unknown";
		}

		void refreshPeak() {
			if (currentLiveBytes > highestLiveBytes) {
				highestLiveBytes = currentLiveBytes;
			}
		}

		AllocationRecord *findRecord(void *address) {
			for (std::size_t index = 0; index < recordCount; ++index) {
				if (records[index].address == address) {
					return &records[index];
				}
			}

			return nullptr;
		}

		AllocationRecord *ensureRecord(void *address) {
			if (auto *record = findRecord(address)) {
				return record;
			}

			if (recordCount == recordCapacity) {
				const auto nextCapacity = recordCapacity == 0 ? 64 : recordCapacity * 2;
				auto *nextRecords = static_cast<AllocationRecord *>(
					std::realloc(records, sizeof(AllocationRecord) * nextCapacity)
				);

				if (!nextRecords) {
					RuntimeError::abortAllocation("memory telemetry records");
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

	void MemoryTelemetry::recordAllocation(void *address, std::size_t size, const char *typeName) {
		if (!address) {
			return;
		}

		auto *record = ensureRecord(address);
		record->address = address;
		record->size = size;
		record->typeName = safeTypeName(typeName);
		record->alive = true;

		currentLiveBytes += size;
		currentLiveAllocations++;
		allocatedBytes += size;
		refreshPeak();
	}

	void MemoryTelemetry::recordReallocation(
		void *oldAddress,
		void *newAddress,
		std::size_t newSize,
		const char *typeName
	) {
		if (!oldAddress) {
			recordAllocation(newAddress, newSize, typeName);
			return;
		}

		auto *oldRecord = findRecord(oldAddress);
		const auto oldSize = oldRecord && oldRecord->alive ? oldRecord->size : 0;

		if (oldRecord && oldRecord->alive) {
			oldRecord->alive = false;

			if (currentLiveBytes >= oldSize) {
				currentLiveBytes -= oldSize;
			} else {
				currentLiveBytes = 0;
			}

			if (currentLiveAllocations > 0) {
				currentLiveAllocations--;
			}

			freedBytes += oldSize;
		}

		auto *newRecord = ensureRecord(newAddress);
		newRecord->address = newAddress;
		newRecord->size = newSize;
		newRecord->typeName = safeTypeName(typeName);
		newRecord->alive = true;

		currentLiveBytes += newSize;
		currentLiveAllocations++;
		allocatedBytes += newSize;
		refreshPeak();
	}

	void MemoryTelemetry::recordDeallocation(void *address) {
		if (!address) {
			return;
		}

		auto *record = findRecord(address);

		if (!record || !record->alive) {
			return;
		}

		if (currentLiveBytes >= record->size) {
			currentLiveBytes -= record->size;
		} else {
			currentLiveBytes = 0;
		}

		if (currentLiveAllocations > 0) {
			currentLiveAllocations--;
		}

		freedBytes += record->size;
		record->alive = false;
	}

	std::size_t MemoryTelemetry::liveBytes() {
		return currentLiveBytes;
	}

	std::size_t MemoryTelemetry::liveAllocations() {
		return currentLiveAllocations;
	}

	std::size_t MemoryTelemetry::totalAllocatedBytes() {
		return allocatedBytes;
	}

	std::size_t MemoryTelemetry::totalFreedBytes() {
		return freedBytes;
	}

	std::size_t MemoryTelemetry::peakBytes() {
		return highestLiveBytes;
	}

	void MemoryTelemetry::report() {
		std::fprintf(
			stderr,
			"yogi memory telemetry: live_bytes=%zu live_allocations=%zu total_allocated_bytes=%zu total_freed_bytes=%zu peak_bytes=%zu\n",
			currentLiveBytes,
			currentLiveAllocations,
			allocatedBytes,
			freedBytes,
			highestLiveBytes
		);
	}

} // namespace yogi::runtime
