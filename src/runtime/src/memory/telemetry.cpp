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
			char *sourcePath = nullptr;
			std::size_t line = 0;
			std::size_t column = 0;
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

		struct SourceFrame {
			char *sourcePath = nullptr;
			std::size_t line = 0;
			std::size_t column = 0;
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
		SourceFrame *sourceStack = nullptr;
		std::size_t sourceCount = 0;
		std::size_t sourceCapacity = 0;
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

		const char *safeSourcePath(const char *sourcePath) {
			return sourcePath && sourcePath[0] != '\0' ? sourcePath : "<unknown>";
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
			const char *typeName,
			const char *sourcePath,
			std::size_t line,
			std::size_t column
		) {
			for (std::size_t index = 0; index < attributionCount; ++index) {
				if (
					std::strcmp(attributions[index].moduleName, moduleName) == 0 &&
					std::strcmp(attributions[index].functionName, functionName) == 0 &&
					std::strcmp(attributions[index].typeName, typeName) == 0 &&
					std::strcmp(attributions[index].sourcePath, sourcePath) == 0 &&
					attributions[index].line == line &&
					attributions[index].column == column
				) {
					return &attributions[index];
				}
			}

			return nullptr;
		}

		AttributionStats *ensureAttribution(
			const char *moduleName,
			const char *functionName,
			const char *typeName,
			const char *sourcePath,
			std::size_t line,
			std::size_t column
		) {
			const auto *safeModule = safeModuleName(moduleName);
			const auto *safeFunction = safeFunctionName(functionName);
			const auto *safeType = safeTypeName(typeName);
			const auto *safeSource = safeSourcePath(sourcePath);

			if (auto *stats = findAttribution(safeModule, safeFunction, safeType, safeSource, line, column)) {
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
			stats->sourcePath = copyString(safeSource);
			stats->line = line;
			stats->column = column;
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

		const SourceFrame &currentSourceFrame() {
			static char unknownSource[] = "<unknown>";
			static SourceFrame runtimeSourceFrame = {unknownSource, 0, 0};
			return sourceCount > 0 ? sourceStack[sourceCount - 1] : runtimeSourceFrame;
		}

		bool attributionMatches(
			const AttributionStats &stats,
			const char *moduleName,
			const char *functionName
		) {
			return std::strcmp(stats.moduleName, safeModuleName(moduleName)) == 0 &&
				std::strcmp(stats.functionName, safeFunctionName(functionName)) == 0;
		}

		bool locationMatches(
			const AttributionStats &stats,
			const char *sourcePath,
			std::size_t line,
			std::size_t column
		) {
			return std::strcmp(stats.sourcePath, safeSourcePath(sourcePath)) == 0 &&
				stats.line == line &&
				stats.column == column;
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
		const auto &source = currentSourceFrame();
		record->attribution = ensureAttribution(
			frame.moduleName,
			frame.functionName,
			typeName,
			source.sourcePath,
			source.line,
			source.column
		);
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
		const auto &source = currentSourceFrame();
		newRecord->attribution = ensureAttribution(
			frame.moduleName,
			frame.functionName,
			typeName,
			source.sourcePath,
			source.line,
			source.column
		);
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

	void MemoryTelemetry::pushSourceLocation(const char *sourcePath, std::size_t line, std::size_t column) {
		if (sourceCount == sourceCapacity) {
			const auto nextCapacity = sourceCapacity == 0 ? 32 : sourceCapacity * 2;
			auto *nextStack = static_cast<SourceFrame *>(
				std::realloc(sourceStack, sizeof(SourceFrame) * nextCapacity)
			);

			if (!nextStack) {
				RuntimeError::abortAllocation("memory telemetry source stack");
			}

			sourceStack = nextStack;
			sourceCapacity = nextCapacity;
		}

		sourceStack[sourceCount++] = {
			copyString(safeSourcePath(sourcePath)),
			line,
			column,
		};
	}

	void MemoryTelemetry::popSourceLocation() {
		if (sourceCount == 0) {
			return;
		}

		auto &source = sourceStack[--sourceCount];
		std::free(source.sourcePath);
		source = {};
	}

	const char *MemoryTelemetry::currentSourcePath() {
		return currentSourceFrame().sourcePath;
	}

	std::size_t MemoryTelemetry::currentSourceLine() {
		return currentSourceFrame().line;
	}

	std::size_t MemoryTelemetry::currentSourceColumn() {
		return currentSourceFrame().column;
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

	std::size_t MemoryTelemetry::attributedLocationLiveBytes(const char *sourcePath, std::size_t line, std::size_t column) {
		std::size_t total = 0;

		for (std::size_t index = 0; index < attributionCount; ++index) {
			if (locationMatches(attributions[index], sourcePath, line, column)) {
				total += attributions[index].liveBytes;
			}
		}

		return total;
	}

	std::size_t MemoryTelemetry::attributedLocationLiveAllocations(const char *sourcePath, std::size_t line, std::size_t column) {
		std::size_t total = 0;

		for (std::size_t index = 0; index < attributionCount; ++index) {
			if (locationMatches(attributions[index], sourcePath, line, column)) {
				total += attributions[index].liveAllocations;
			}
		}

		return total;
	}

	std::size_t MemoryTelemetry::attributedLocationTotalAllocatedBytes(const char *sourcePath, std::size_t line, std::size_t column) {
		std::size_t total = 0;

		for (std::size_t index = 0; index < attributionCount; ++index) {
			if (locationMatches(attributions[index], sourcePath, line, column)) {
				total += attributions[index].totalAllocatedBytes;
			}
		}

		return total;
	}

	std::size_t MemoryTelemetry::attributedLocationTotalFreedBytes(const char *sourcePath, std::size_t line, std::size_t column) {
		std::size_t total = 0;

		for (std::size_t index = 0; index < attributionCount; ++index) {
			if (locationMatches(attributions[index], sourcePath, line, column)) {
				total += attributions[index].totalFreedBytes;
			}
		}

		return total;
	}

	std::size_t MemoryTelemetry::attributedLocationPeakBytes(const char *sourcePath, std::size_t line, std::size_t column) {
		std::size_t total = 0;

		for (std::size_t index = 0; index < attributionCount; ++index) {
			if (locationMatches(attributions[index], sourcePath, line, column)) {
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
				"yogi memory attribution: module=%s function=%s source=%s line=%zu column=%zu type=%s live_bytes=%zu live_allocations=%zu total_allocated_bytes=%zu total_freed_bytes=%zu peak_bytes=%zu\n",
				stats.moduleName,
				stats.functionName,
				stats.sourcePath,
				stats.line,
				stats.column,
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
