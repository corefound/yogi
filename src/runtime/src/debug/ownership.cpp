// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/debug/ownership.h"

#include "yogi/runtime.h"
#include "yogi/runtime/errors.h"
#include "yogi/runtime/memory/telemetry.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace yogi::runtime {

#if YOGI_RUNTIME_DEBUG_OWNERSHIP
    namespace {
        struct OwnershipLocation {
            char* moduleName = nullptr;
            char* functionName = nullptr;
            char* sourcePath = nullptr;
            std::size_t line = 0;
            std::size_t column = 0;
        };

        struct OwnershipRecord {
            void* address = nullptr;
            std::size_t size = 0;
            const char* typeName = nullptr;
            OwnershipLocation created = {};
            OwnershipLocation lastEvent = {};
            bool allocationKnown = false;
            bool allocationAlive = false;
            bool aggregateKnown = false;
            bool aggregateAlive = false;
            bool stackAggregate = false;
        };

        OwnershipRecord* records = nullptr;
        std::size_t recordCount = 0;
        std::size_t recordCapacity = 0;

        const char* safeTypeName(const char* typeName) {
            return typeName ? typeName : "unknown";
        }

        const char* safeModuleName(const char* moduleName) {
            return moduleName && moduleName[0] != '\0' ? moduleName : "<runtime>";
        }

        const char* safeFunctionName(const char* functionName) {
            return functionName && functionName[0] != '\0' ? functionName : "<unknown>";
        }

        const char* safeSourcePath(const char* sourcePath) {
            return sourcePath && sourcePath[0] != '\0' ? sourcePath : "<unknown>";
        }

        char* copyString(const char* value) {
            const auto* safeValue = value ? value : "";
            const auto length = std::strlen(safeValue);
            auto* copy = static_cast<char*>(std::malloc(length + 1));

            if (!copy) {
                RuntimeError::abortAllocation("ownership debug location");
            }

            std::memcpy(copy, safeValue, length + 1);
            return copy;
        }

        void clearLocation(OwnershipLocation& location) {
            std::free(location.moduleName);
            std::free(location.functionName);
            std::free(location.sourcePath);
            location = {};
        }

        void setLocation(OwnershipLocation& location, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column) {
            clearLocation(location);
            location.moduleName = copyString(safeModuleName(moduleName));
            location.functionName = copyString(safeFunctionName(functionName));
            location.sourcePath = copyString(safeSourcePath(sourcePath));
            location.line = line;
            location.column = column;
        }

        void captureCurrentLocation(OwnershipLocation& location) {
            setLocation(location, MemoryTelemetry::currentModule(), MemoryTelemetry::currentFunction(), MemoryTelemetry::currentSourcePath(), MemoryTelemetry::currentSourceLine(), MemoryTelemetry::currentSourceColumn());
        }

        void copyLocation(OwnershipLocation& target, const OwnershipLocation& source) {
            setLocation(target, source.moduleName, source.functionName, source.sourcePath, source.line, source.column);
        }

        void clearRecord(OwnershipRecord& record) {
            clearLocation(record.created);
            clearLocation(record.lastEvent);
            record = {};
        }

        void captureCreatedAndLastEvent(OwnershipRecord& record) {
            captureCurrentLocation(record.created);
            copyLocation(record.lastEvent, record.created);
        }

        void captureLastEvent(OwnershipRecord& record) {
            captureCurrentLocation(record.lastEvent);
        }

        void abortOwnership(const char* reason, const void* address, const char* typeName, const OwnershipRecord* record) {
            OwnershipLocation detected = {};
            captureCurrentLocation(detected);

            const auto* created = record ? &record->created : &detected;
            const auto* lastEvent = record ? &record->lastEvent : &detected;

            RuntimeError::abortOwnershipDetailed(
                reason,
                address,
                typeName,
                created->moduleName,
                created->functionName,
                created->sourcePath,
                static_cast<unsigned long long>(created->line),
                static_cast<unsigned long long>(created->column),
                lastEvent->moduleName,
                lastEvent->functionName,
                lastEvent->sourcePath,
                static_cast<unsigned long long>(lastEvent->line),
                static_cast<unsigned long long>(lastEvent->column),
                detected.moduleName,
                detected.functionName,
                detected.sourcePath,
                static_cast<unsigned long long>(detected.line),
                static_cast<unsigned long long>(detected.column));
        }

        OwnershipRecord* findRecord(void* address) {
            for (std::size_t index = 0; index < recordCount; ++index) {
                if (records[index].address == address) {
                    return &records[index];
                }
            }

            return nullptr;
        }

        OwnershipRecord* ensureRecord(void* address) {
            if (auto* record = findRecord(address)) {
                return record;
            }

            if (recordCount == recordCapacity) {
                const auto nextCapacity = recordCapacity == 0 ? 64 : recordCapacity * 2;
                auto* nextRecords = static_cast<OwnershipRecord*>(std::realloc(records, sizeof(OwnershipRecord) * nextCapacity));

                if (!nextRecords) {
                    RuntimeError::abortAllocation("ownership debug records");
                }

                records = nextRecords;
                recordCapacity = nextCapacity;
            }

            auto* record = &records[recordCount++];
            *record = {};
            record->address = address;
            return record;
        }
    } // namespace
#endif

    bool OwnershipTracker::enabled() {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
        return true;
#else
        return false;
#endif
    }

    void OwnershipTracker::recordAllocation(void* address, std::size_t size, const char* typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
        if (!address) {
            return;
        }

        auto* record = ensureRecord(address);
        record->size = size;
        record->typeName = safeTypeName(typeName);
        captureCreatedAndLastEvent(*record);
        record->allocationKnown = true;
        record->allocationAlive = true;
#else
        (void)address;
        (void)size;
        (void)typeName;
#endif
    }

    void OwnershipTracker::recordReallocation(void* oldAddress, void* newAddress, std::size_t size, const char* typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
        if (!oldAddress) {
            recordAllocation(newAddress, size, typeName);
            return;
        }

        auto* oldRecord = findRecord(oldAddress);

        if (!oldRecord || !oldRecord->allocationKnown) {
            abortOwnership("invalid realloc", oldAddress, typeName, oldRecord);
        }

        if (!oldRecord->allocationAlive) {
            abortOwnership("realloc after free", oldAddress, oldRecord->typeName, oldRecord);
        }

        if (oldAddress != newAddress) {
            oldRecord->allocationAlive = false;
            oldRecord->aggregateAlive = false;
        }

        const auto oldRecordIndex = static_cast<std::size_t>(oldRecord - records);
        auto* newRecord = ensureRecord(newAddress);
        oldRecord = &records[oldRecordIndex];

        if (newRecord != oldRecord) {
            clearRecord(*newRecord);
            newRecord->address = newAddress;
            copyLocation(newRecord->created, oldRecord->created);
            copyLocation(newRecord->lastEvent, oldRecord->lastEvent);
        }

        newRecord->address = newAddress;
        newRecord->size = size;
        newRecord->typeName = safeTypeName(typeName);
        newRecord->allocationAlive = true;
        newRecord->allocationKnown = true;
        newRecord->aggregateKnown = oldRecord->aggregateKnown;
        newRecord->aggregateAlive = oldRecord->aggregateAlive && oldAddress == newAddress;
        newRecord->stackAggregate = oldRecord->stackAggregate;
        captureLastEvent(*newRecord);
#else
        (void)oldAddress;
        (void)newAddress;
        (void)size;
        (void)typeName;
#endif
    }

    void OwnershipTracker::recordDeallocation(void* address) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
        if (!address) {
            return;
        }

        auto* record = findRecord(address);

        if (!record || !record->allocationKnown) {
            abortOwnership("invalid free", address, nullptr, record);
        }

        if (!record->allocationAlive) {
            abortOwnership("double free", address, record->typeName, record);
        }

        if (record->aggregateAlive) {
            abortOwnership("free of live aggregate without destroy/drop", address, record->typeName, record);
        }

        captureLastEvent(*record);
        record->allocationAlive = false;
#else
        (void)address;
#endif
    }

    void OwnershipTracker::markHeapAggregate(void* address, const char* typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
        if (!address) {
            return;
        }

        auto* record = ensureRecord(address);
        record->typeName = safeTypeName(typeName);
        captureCreatedAndLastEvent(*record);
        record->aggregateKnown = true;
        record->aggregateAlive = true;
        record->stackAggregate = false;
        record->allocationKnown = true;
        record->allocationAlive = true;
#else
        (void)address;
        (void)typeName;
#endif
    }

    void OwnershipTracker::registerStackAggregate(void* address, const char* typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
        if (!address) {
            return;
        }

        auto* record = ensureRecord(address);
        record->typeName = safeTypeName(typeName);
        captureCreatedAndLastEvent(*record);
        record->aggregateKnown = true;
        record->aggregateAlive = true;
        record->stackAggregate = true;
        record->allocationKnown = false;
        record->allocationAlive = false;
#else
        (void)address;
        (void)typeName;
#endif
    }

    void OwnershipTracker::dropStackAggregate(void* address, const char* typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
        if (!address) {
            return;
        }

        auto* record = findRecord(address);

        if (!record || !record->aggregateKnown) {
            abortOwnership("drop of unknown aggregate", address, typeName, record);
        }

        if (!record->aggregateAlive) {
            abortOwnership("double drop/destroy", address, record->typeName, record);
        }

        if (!record->stackAggregate) {
            abortOwnership("drop used for heap aggregate", address, record->typeName, record);
        }

        captureLastEvent(*record);
        record->aggregateAlive = false;
#else
        (void)address;
        (void)typeName;
#endif
    }

    void OwnershipTracker::destroyHeapAggregate(void* address, const char* typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
        if (!address) {
            return;
        }

        auto* record = findRecord(address);

        if (!record || !record->aggregateKnown) {
            abortOwnership("destroy of unknown aggregate", address, typeName, record);
        }

        if (!record->aggregateAlive) {
            abortOwnership("double drop/destroy", address, record->typeName, record);
        }

        if (record->stackAggregate) {
            abortOwnership("destroy used for stack aggregate", address, record->typeName, record);
        }

        captureLastEvent(*record);
        record->aggregateAlive = false;
#else
        (void)address;
        (void)typeName;
#endif
    }

    void OwnershipTracker::assertLiveAggregate(void* address, const char* operation, const char* typeName) {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
        if (!address) {
            return;
        }

        auto* record = findRecord(address);

        if (!record || !record->aggregateKnown) {
            abortOwnership(operation ? operation : "aggregate access on unknown value", address, typeName, record);
        }

        if (!record->aggregateAlive) {
            abortOwnership(operation ? operation : "aggregate access after destroy/drop", address, record->typeName, record);
        }
#else
        (void)address;
        (void)operation;
        (void)typeName;
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
            const auto& record = records[index];

            if (!record.allocationAlive && !record.aggregateAlive) {
                continue;
            }

            ++count;
            std::fprintf(
                stderr,
                "yogi runtime ownership leak: %p (%s)%s%s\n"
                "  created: module=%s function=%s source=%s:%zu:%zu\n"
                "  last-event: module=%s function=%s source=%s:%zu:%zu\n",
                record.address,
                record.typeName ? record.typeName : "unknown",
                record.allocationAlive ? " allocation-live" : "",
                record.aggregateAlive ? " aggregate-live" : "",
                safeModuleName(record.created.moduleName),
                safeFunctionName(record.created.functionName),
                safeSourcePath(record.created.sourcePath),
                record.created.line,
                record.created.column,
                safeModuleName(record.lastEvent.moduleName),
                safeFunctionName(record.lastEvent.functionName),
                safeSourcePath(record.lastEvent.sourcePath),
                record.lastEvent.line,
                record.lastEvent.column);
        }

        return count;
#else
        return 0;
#endif
    }

    void OwnershipTracker::reset() {
#if YOGI_RUNTIME_DEBUG_OWNERSHIP
        for (std::size_t index = 0; index < recordCount; ++index) {
            clearRecord(records[index]);
        }

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
