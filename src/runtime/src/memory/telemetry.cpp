// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/memory/telemetry.h"

#include "yogi/runtime/errors.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace yogi::runtime {

	namespace {
		struct AttributionStats {
			char *moduleName = nullptr;
			char *functionName = nullptr;
			char *typeName = nullptr;
			std::size_t liveBytes = 0;
			std::size_t liveAllocations = 0;
			std::size_t totalAllocatedBytes = 0;
			std::size_t totalFreedBytes = 0;
			std::size_t peakBytes = 0;
		};

		struct AllocationRecord {
			void *address = nullptr;
			std::size_t size = 0;
			const char *typeName = nullptr;
			AttributionStats *attribution = nullptr;
			bool alive = false;
		};

		struct ContextFrame {
			char *moduleName = nullptr;
			char *functionName = nullptr;
		};

		AllocationRecord *records = nullptr;
		std::size_t recordCount = 0;
		std::size_t recordCapacity = 0;
		AttributionStats *attributions = nullptr;
		std::size_t attributionCount = 0;
		std::size_t attributionCapacity = 0;
		ContextFrame *contextStack = nullptr;
		std::size_t contextCount = 0;
		std::size_t contextCapacity = 0;
		std::size_t currentLiveBytes = 0;
		std::size_t currentLiveAllocations = 0;
		std::size_t allocatedBytes = 0;
		std::size_t freedBytes = 0;
		std::size_t highestLiveBytes = 0;

		const char *safeTypeName(const char *typeName) {
			return typeName ? typeName : "unknown";
		}

		const char *safeModuleName(const char *moduleName) {
			return moduleName && moduleName[0] != '\0' ? moduleName : "<runtime>";
		}

		const char *safeFunctionName(const char *functionName) {
			return functionName && functionName[0] != '\0' ? functionName : "<unknown>";
		}

		char *copyString(const char *value) {
			const auto *safeValue = value ? value : "";
			const auto length = std::strlen(safeValue);
			auto *copy = static_cast<char *>(std::malloc(length + 1));

			if (!copy) {
				RuntimeError::abortAllocation("memory telemetry string");
			}

			std::memcpy(copy, safeValue, length + 1);
			return copy;
		}

		void refreshPeak() {
			if (currentLiveBytes > highestLiveBytes) {
				highestLiveBytes = currentLiveBytes;
			}
		}

		void refreshAttributionPeak(AttributionStats *stats) {
			if (stats && stats->liveBytes > stats->peakBytes) {
				stats->peakBytes = stats->liveBytes;
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

		AttributionStats *findAttribution(
			const char *moduleName,
			const char *functionName,
			const char *typeName
		) {
			for (std::size_t index = 0; index < attributionCount; ++index) {
				if (
					std::strcmp(attributions[index].moduleName, moduleName) == 0 &&
					std::strcmp(attributions[index].functionName, functionName) == 0 &&
					std::strcmp(attributions[index].typeName, typeName) == 0
				) {
					return &attributions[index];
				}
			}

			return nullptr;
		}

		AttributionStats *ensureAttribution(
			const char *moduleName,
			const char *functionName,
			const char *typeName
		) {
			const auto *safeModule = safeModuleName(moduleName);
			const auto *safeFunction = safeFunctionName(functionName);
			const auto *safeType = safeTypeName(typeName);

			if (auto *stats = findAttribution(safeModule, safeFunction, safeType)) {
				return stats;
			}

			if (attributionCount == attributionCapacity) {
				const auto nextCapacity = attributionCapacity == 0 ? 32 : attributionCapacity * 2;
				auto *nextAttributions = static_cast<AttributionStats *>(
					std::realloc(attributions, sizeof(AttributionStats) * nextCapacity)
				);

				if (!nextAttributions) {
					RuntimeError::abortAllocation("memory telemetry attribution records");
				}

				attributions = nextAttributions;
				attributionCapacity = nextCapacity;
			}

			auto *stats = &attributions[attributionCount++];
			*stats = {};
			stats->moduleName = copyString(safeModule);
			stats->functionName = copyString(safeFunction);
			stats->typeName = copyString(safeType);
			return stats;
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

		void recordAttributedAllocation(AttributionStats *stats, std::size_t size) {
			if (!stats) {
				return;
			}

			stats->liveBytes += size;
			stats->liveAllocations++;
			stats->totalAllocatedBytes += size;
			refreshAttributionPeak(stats);
		}

		void recordAttributedDeallocation(AttributionStats *stats, std::size_t size) {
			if (!stats) {
				return;
			}

			if (stats->liveBytes >= size) {
				stats->liveBytes -= size;
			} else {
				stats->liveBytes = 0;
			}

			if (stats->liveAllocations > 0) {
				stats->liveAllocations--;
			}

			stats->totalFreedBytes += size;
		}

		const ContextFrame &currentFrame() {
			static char runtimeModule[] = "<runtime>";
			static char unknownFunction[] = "<unknown>";
			static ContextFrame runtimeFrame = {runtimeModule, unknownFunction};
			return contextCount > 0 ? contextStack[contextCount - 1] : runtimeFrame;
		}

		bool attributionMatches(
			const AttributionStats &stats,
			const char *moduleName,
			const char *functionName
		) {
			return std::strcmp(stats.moduleName, safeModuleName(moduleName)) == 0 &&
				std::strcmp(stats.functionName, safeFunctionName(functionName)) == 0;
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
		const auto &frame = currentFrame();
		record->attribution = ensureAttribution(frame.moduleName, frame.functionName, typeName);
		record->alive = true;

		currentLiveBytes += size;
		currentLiveAllocations++;
		allocatedBytes += size;
		recordAttributedAllocation(record->attribution, size);
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
			recordAttributedDeallocation(oldRecord->attribution, oldSize);
		}

		auto *newRecord = ensureRecord(newAddress);
		newRecord->address = newAddress;
		newRecord->size = newSize;
		newRecord->typeName = safeTypeName(typeName);
		const auto &frame = currentFrame();
		newRecord->attribution = ensureAttribution(frame.moduleName, frame.functionName, typeName);
		newRecord->alive = true;

		currentLiveBytes += newSize;
		currentLiveAllocations++;
		allocatedBytes += newSize;
		recordAttributedAllocation(newRecord->attribution, newSize);
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
		recordAttributedDeallocation(record->attribution, record->size);
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

	void MemoryTelemetry::pushContext(const char *moduleName, const char *functionName) {
		if (contextCount == contextCapacity) {
			const auto nextCapacity = contextCapacity == 0 ? 32 : contextCapacity * 2;
			auto *nextStack = static_cast<ContextFrame *>(
				std::realloc(contextStack, sizeof(ContextFrame) * nextCapacity)
			);

			if (!nextStack) {
				RuntimeError::abortAllocation("memory telemetry context stack");
			}

			contextStack = nextStack;
			contextCapacity = nextCapacity;
		}

		contextStack[contextCount++] = {
			copyString(safeModuleName(moduleName)),
			copyString(safeFunctionName(functionName)),
		};
	}

	void MemoryTelemetry::popContext() {
		if (contextCount == 0) {
			return;
		}

		auto &frame = contextStack[--contextCount];
		std::free(frame.moduleName);
		std::free(frame.functionName);
		frame = {};
	}

	const char *MemoryTelemetry::currentModule() {
		return currentFrame().moduleName;
	}

	const char *MemoryTelemetry::currentFunction() {
		return currentFrame().functionName;
	}

	std::size_t MemoryTelemetry::attributedLiveBytes(const char *moduleName, const char *functionName) {
		std::size_t total = 0;

		for (std::size_t index = 0; index < attributionCount; ++index) {
			if (attributionMatches(attributions[index], moduleName, functionName)) {
				total += attributions[index].liveBytes;
			}
		}

		return total;
	}

	std::size_t MemoryTelemetry::attributedLiveAllocations(const char *moduleName, const char *functionName) {
		std::size_t total = 0;

		for (std::size_t index = 0; index < attributionCount; ++index) {
			if (attributionMatches(attributions[index], moduleName, functionName)) {
				total += attributions[index].liveAllocations;
			}
		}

		return total;
	}

	std::size_t MemoryTelemetry::attributedTotalAllocatedBytes(const char *moduleName, const char *functionName) {
		std::size_t total = 0;

		for (std::size_t index = 0; index < attributionCount; ++index) {
			if (attributionMatches(attributions[index], moduleName, functionName)) {
				total += attributions[index].totalAllocatedBytes;
			}
		}

		return total;
	}

	std::size_t MemoryTelemetry::attributedTotalFreedBytes(const char *moduleName, const char *functionName) {
		std::size_t total = 0;

		for (std::size_t index = 0; index < attributionCount; ++index) {
			if (attributionMatches(attributions[index], moduleName, functionName)) {
				total += attributions[index].totalFreedBytes;
			}
		}

		return total;
	}

	std::size_t MemoryTelemetry::attributedPeakBytes(const char *moduleName, const char *functionName) {
		std::size_t total = 0;

		for (std::size_t index = 0; index < attributionCount; ++index) {
			if (attributionMatches(attributions[index], moduleName, functionName)) {
				total += attributions[index].peakBytes;
			}
		}

		return total;
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

		for (std::size_t index = 0; index < attributionCount; ++index) {
			const auto &stats = attributions[index];

			if (stats.totalAllocatedBytes == 0 && stats.totalFreedBytes == 0 && stats.liveBytes == 0) {
				continue;
			}

			std::fprintf(
				stderr,
				"yogi memory attribution: module=%s function=%s type=%s live_bytes=%zu live_allocations=%zu total_allocated_bytes=%zu total_freed_bytes=%zu peak_bytes=%zu\n",
				stats.moduleName,
				stats.functionName,
				stats.typeName,
				stats.liveBytes,
				stats.liveAllocations,
				stats.totalAllocatedBytes,
				stats.totalFreedBytes,
				stats.peakBytes
			);
		}
	}

} // namespace yogi::runtime
