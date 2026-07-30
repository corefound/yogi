// Created by Brayhan De Aza on 7/26/26.
//

#include "yogi/runtime/observability/programObservability.h"

#include "yogi/runtime/debug/ownership.h"
#include "yogi/runtime/memory/telemetry.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>

#if defined(_WIN32)
#include <process.h>
#else
#include <unistd.h>
#endif

namespace yogi::runtime {

    namespace {

#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        struct ResourceRecord {
            void* address = nullptr;
            std::uint64_t resourceId = 0;
            char* typeName = nullptr;
            bool alive = false;
        };

        struct TraceState {
            std::FILE* file = nullptr;
            const char* sessionId = nullptr;
            const char* categories = nullptr;
            const char* processRole = nullptr;
            std::uint64_t processId = 0;
            std::uint64_t sequence = 0;
            std::uint64_t allocationSequence = 0;
            std::uint64_t aggregateSequence = 0;
            std::uint64_t frameSequence = 0;
            std::uint64_t resourceSequence = 0;
            ResourceRecord* resources = nullptr;
            std::size_t resourceCount = 0;
            std::size_t resourceCapacity = 0;
            bool initialized = false;
            bool active = false;
            bool strict = false;
            bool writing = false;
            bool finalizing = false;
            bool droppedEvents = false;
        };

        TraceState traceState;

        std::uint64_t currentProcessId() {
#if defined(_WIN32)
            return static_cast<std::uint64_t>(_getpid());
#else
            return static_cast<std::uint64_t>(getpid());
#endif
        }

        const char* safeText(const char* value, const char* fallback) {
            return value && value[0] != '\0' ? value : fallback;
        }

        char* copyText(const char* value) {
            const auto* source = safeText(value, "external resource");
            const auto length = std::strlen(source);
            auto* copy = static_cast<char*>(std::malloc(length + 1));
            if (!copy) {
                return nullptr;
            }

            std::memcpy(copy, source, length + 1);
            return copy;
        }

        bool isTruthy(const char* value) {
            return value && (std::strcmp(value, "1") == 0 || std::strcmp(value, "true") == 0 || std::strcmp(value, "ON") == 0);
        }

        void writeJsonString(std::FILE* file, const char* value) {
            std::fputc('"', file);

            for (const auto* cursor = safeText(value, ""); *cursor != '\0'; ++cursor) {
                const auto character = static_cast<unsigned char>(*cursor);

                switch (character) {
                    case '"':
                        std::fputs("\\\"", file);
                        break;
                    case '\\':
                        std::fputs("\\\\", file);
                        break;
                    case '\b':
                        std::fputs("\\b", file);
                        break;
                    case '\f':
                        std::fputs("\\f", file);
                        break;
                    case '\n':
                        std::fputs("\\n", file);
                        break;
                    case '\r':
                        std::fputs("\\r", file);
                        break;
                    case '\t':
                        std::fputs("\\t", file);
                        break;
                    default:
                        if (character < 0x20) {
                            std::fprintf(file, "\\u%04x", character);
                        } else {
                            std::fputc(character, file);
                        }
                        break;
                }
            }

            std::fputc('"', file);
        }

        bool categoryEnabled(const char* category) {
            if (std::strcmp(category, "session") == 0 || std::strcmp(category, "anomaly") == 0) {
                return true;
            }

            if (!traceState.categories || traceState.categories[0] == '\0') {
                return true;
            }

            const auto categoryLength = std::strlen(category);
            const auto* cursor = traceState.categories;

            while (*cursor != '\0') {
                while (*cursor == ',' || *cursor == ' ') {
                    ++cursor;
                }

                const auto* start = cursor;
                while (*cursor != '\0' && *cursor != ',') {
                    ++cursor;
                }

                auto length = static_cast<std::size_t>(cursor - start);
                while (length > 0 && start[length - 1] == ' ') {
                    --length;
                }

                if (length == categoryLength && std::strncmp(start, category, length) == 0) {
                    return true;
                }
            }

            return false;
        }

        void finalizeTrace();

        bool initializeTrace() {
            if (traceState.initialized) {
                return traceState.active;
            }

            traceState.initialized = true;
            traceState.sessionId = std::getenv("YOGI_TRACE_SESSION");
            const auto* directory = std::getenv("YOGI_TRACE_DIRECTORY");

            if (!traceState.sessionId || !directory || directory[0] == '\0') {
                return false;
            }

            traceState.categories = std::getenv("YOGI_TRACE_CATEGORIES");
            traceState.processRole = safeText(std::getenv("YOGI_TRACE_PROCESS_ROLE"), "program-test-child");
            traceState.strict = isTruthy(std::getenv("YOGI_TRACE_STRICT"));
            traceState.processId = currentProcessId();

            char path[4096] = {};
            const auto length = std::snprintf(path, sizeof(path), "%s/runtime-%llu.events.jsonl", directory, static_cast<unsigned long long>(traceState.processId));

            if (length <= 0 || static_cast<std::size_t>(length) >= sizeof(path)) {
                std::fputs("yogi observability error: trace path is too long\n", stderr);
                if (traceState.strict) {
                    std::abort();
                }
                return false;
            }

            traceState.file = std::fopen(path, "w");
            if (!traceState.file) {
                std::fprintf(stderr, "yogi observability error: cannot open trace file %s\n", path);
                if (traceState.strict) {
                    std::abort();
                }
                return false;
            }

            traceState.active = true;
            std::atexit(finalizeTrace);
            return true;
        }

        bool beginEvent(const char* category, const char* eventKind, const char* entityId, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column, const char* phase = "runtime") {
            if (!initializeTrace() || !categoryEnabled(category)) {
                return false;
            }

            if (traceState.writing) {
                traceState.droppedEvents = true;
                return false;
            }

            traceState.writing = true;
            const auto sequence = ++traceState.sequence;
            std::fputs("{\"schemaVersion\":1,\"sessionId\":", traceState.file);
            writeJsonString(traceState.file, traceState.sessionId);
            std::fprintf(
                traceState.file,
                ",\"eventId\":\"event:runtime:%llu:%llu\",\"sequence\":%llu,"
                "\"phase\":",
                static_cast<unsigned long long>(traceState.processId),
                static_cast<unsigned long long>(sequence),
                static_cast<unsigned long long>(sequence));
            writeJsonString(traceState.file, safeText(phase, "runtime"));
            std::fputs(",\"category\":", traceState.file);
            writeJsonString(traceState.file, category);
            std::fputs(",\"eventKind\":", traceState.file);
            writeJsonString(traceState.file, eventKind);
            std::fprintf(traceState.file, ",\"producer\":\"runtime:%llu\",\"processId\":%llu,\"processRole\":", static_cast<unsigned long long>(traceState.processId), static_cast<unsigned long long>(traceState.processId));
            writeJsonString(traceState.file, traceState.processRole);

            if (entityId && entityId[0] != '\0') {
                std::fputs(",\"entityId\":", traceState.file);
                writeJsonString(traceState.file, entityId);
            }

            std::fputs(",\"moduleId\":", traceState.file);
            writeJsonString(traceState.file, safeText(moduleName, "<runtime>"));
            std::fputs(",\"functionId\":", traceState.file);
            writeJsonString(traceState.file, safeText(functionName, "<unknown>"));
            std::fputs(",\"source\":{\"path\":", traceState.file);
            writeJsonString(traceState.file, safeText(sourcePath, "<unknown>"));
            std::fprintf(traceState.file, ",\"line\":%zu,\"column\":%zu}", line, column);
            return true;
        }

        void endEvent() {
            std::fputs("}\n", traceState.file);
            if (std::fflush(traceState.file) != 0) {
                traceState.droppedEvents = true;
            }
            traceState.writing = false;
        }

        void writeAddress(const char* name, const void* address) {
            std::fprintf(traceState.file, ",\"%s\":\"%p\"", name, address);
        }

        ResourceRecord* findResource(void* address) {
            for (std::size_t index = traceState.resourceCount; index > 0; --index) {
                auto* record = &traceState.resources[index - 1];
                if (record->address == address && record->alive) {
                    return record;
                }
            }

            return nullptr;
        }

        ResourceRecord* appendResource() {
            if (traceState.resourceCount == traceState.resourceCapacity) {
                const auto nextCapacity = traceState.resourceCapacity == 0 ? static_cast<std::size_t>(32) : traceState.resourceCapacity * 2;
                auto* nextRecords = static_cast<ResourceRecord*>(std::realloc(traceState.resources, sizeof(ResourceRecord) * nextCapacity));

                if (!nextRecords) {
                    std::fputs("yogi observability error: resource trace allocation failed\n", stderr);
                    if (traceState.strict) {
                        std::abort();
                    }
                    traceState.droppedEvents = true;
                    return nullptr;
                }

                traceState.resources = nextRecords;
                traceState.resourceCapacity = nextCapacity;
            }

            auto* record = &traceState.resources[traceState.resourceCount++];
            *record = {};
            return record;
        }

        std::size_t liveResourceCount() {
            std::size_t count = 0;
            for (std::size_t index = 0; index < traceState.resourceCount; ++index) {
                if (traceState.resources[index].alive) {
                    ++count;
                }
            }
            return count;
        }

        void emitResourceAnomaly(const char* reason, void* address, const char* typeName) {
            if (!beginEvent(
                    "anomaly",
                    "anomaly.resource_lifetime",
                    nullptr,
                    MemoryTelemetry::currentModule(),
                    MemoryTelemetry::currentFunction(),
                    MemoryTelemetry::currentSourcePath(),
                    MemoryTelemetry::currentSourceLine(),
                    MemoryTelemetry::currentSourceColumn())) {
                return;
            }

            std::fputs(",\"details\":{\"reason\":", traceState.file);
            writeJsonString(traceState.file, reason);
            writeAddress("address", address);
            std::fputs(",\"typeName\":", traceState.file);
            writeJsonString(traceState.file, safeText(typeName, "external resource"));
            std::fputc('}', traceState.file);
            endEvent();
        }

        void finalizeTrace() {
            if (!traceState.active || traceState.finalizing) {
                return;
            }

            traceState.finalizing = true;
            if (beginEvent("session", "process.summary", nullptr, "<runtime>", "<process>", "<unknown>", 0, 0)) {
                std::fprintf(
                    traceState.file,
                    ",\"details\":{\"liveAllocations\":%zu,\"liveAggregates\":%zu,"
                    "\"liveResources\":%zu,\"droppedEvents\":%s}",
                    MemoryTelemetry::liveAllocations(),
                    OwnershipTracker::liveAggregates(),
                    liveResourceCount(),
                    traceState.droppedEvents ? "true" : "false");
                endEvent();
            }

            std::fclose(traceState.file);
            traceState.file = nullptr;
            traceState.active = false;
            for (std::size_t index = 0; index < traceState.resourceCount; ++index) {
                std::free(traceState.resources[index].typeName);
            }
            std::free(traceState.resources);
            traceState.resources = nullptr;
            traceState.resourceCount = 0;
            traceState.resourceCapacity = 0;
        }
#endif
    } // namespace

    bool ProgramObservability::enabled() {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        return initializeTrace();
#else
        return false;
#endif
    }

    std::uint64_t ProgramObservability::nextAllocationId() {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        initializeTrace();
        return ++traceState.allocationSequence;
#else
        return 0;
#endif
    }

    std::uint64_t ProgramObservability::nextAggregateId() {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        initializeTrace();
        return ++traceState.aggregateSequence;
#else
        return 0;
#endif
    }

    std::uint64_t ProgramObservability::beginFrame(std::uint64_t parentFrameId, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        initializeTrace();
        const auto frameId = ++traceState.frameSequence;
        char entityId[96] = {};
        std::snprintf(entityId, sizeof(entityId), "frame:%llu:%llu", static_cast<unsigned long long>(traceState.processId), static_cast<unsigned long long>(frameId));

        if (beginEvent("function", "function.frame.enter", entityId, moduleName, functionName, sourcePath, line, column)) {
            std::fprintf(traceState.file, ",\"details\":{\"frameId\":%llu,\"parentFrameId\":%llu}", static_cast<unsigned long long>(frameId), static_cast<unsigned long long>(parentFrameId));
            endEvent();
        }
        return frameId;
#else
        (void)parentFrameId;
        (void)moduleName;
        (void)functionName;
        (void)sourcePath;
        (void)line;
        (void)column;
        return 0;
#endif
    }

    void ProgramObservability::endFrame(std::uint64_t frameId, const char* exitReason, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        char entityId[96] = {};
        std::snprintf(entityId, sizeof(entityId), "frame:%llu:%llu", static_cast<unsigned long long>(traceState.processId), static_cast<unsigned long long>(frameId));

        if (beginEvent("function", "function.frame.exit", entityId, moduleName, functionName, sourcePath, line, column)) {
            std::fprintf(traceState.file, ",\"details\":{\"frameId\":%llu,\"exitReason\":", static_cast<unsigned long long>(frameId));
            writeJsonString(traceState.file, safeText(exitReason, "normal"));
            std::fputc('}', traceState.file);
            endEvent();
        }
#else
        (void)frameId;
        (void)exitReason;
        (void)moduleName;
        (void)functionName;
        (void)sourcePath;
        (void)line;
        (void)column;
#endif
    }

    void ProgramObservability::
        recordAllocation(std::uint64_t allocationId, std::uint64_t generation, void* address, std::size_t size, const char* typeName, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        char entityId[96] = {};
        std::snprintf(entityId, sizeof(entityId), "allocation:%llu:%llu", static_cast<unsigned long long>(traceState.processId), static_cast<unsigned long long>(allocationId));

        if (beginEvent("memory", "memory.allocate", entityId, moduleName, functionName, sourcePath, line, column)) {
            std::fprintf(traceState.file, ",\"details\":{\"allocationId\":%llu,\"generation\":%llu,\"size\":%zu", static_cast<unsigned long long>(allocationId), static_cast<unsigned long long>(generation), size);
            writeAddress("address", address);
            std::fputs(",\"typeName\":", traceState.file);
            writeJsonString(traceState.file, safeText(typeName, "unknown"));
            std::fputc('}', traceState.file);
            endEvent();
        }
#else
        (void)allocationId;
        (void)generation;
        (void)address;
        (void)size;
        (void)typeName;
        (void)moduleName;
        (void)functionName;
        (void)sourcePath;
        (void)line;
        (void)column;
#endif
    }

    void ProgramObservability::recordReallocation(
        std::uint64_t allocationId,
        std::uint64_t generation,
        void* oldAddress,
        void* newAddress,
        std::size_t oldSize,
        std::size_t newSize,
        const char* typeName,
        const char* moduleName,
        const char* functionName,
        const char* sourcePath,
        std::size_t line,
        std::size_t column) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        char entityId[96] = {};
        std::snprintf(entityId, sizeof(entityId), "allocation:%llu:%llu", static_cast<unsigned long long>(traceState.processId), static_cast<unsigned long long>(allocationId));

        if (beginEvent("memory", "memory.reallocate", entityId, moduleName, functionName, sourcePath, line, column)) {
            std::fprintf(
                traceState.file,
                ",\"details\":{\"allocationId\":%llu,\"generation\":%llu,"
                "\"oldSize\":%zu,\"newSize\":%zu",
                static_cast<unsigned long long>(allocationId),
                static_cast<unsigned long long>(generation),
                oldSize,
                newSize);
            writeAddress("oldAddress", oldAddress);
            writeAddress("newAddress", newAddress);
            std::fputs(",\"typeName\":", traceState.file);
            writeJsonString(traceState.file, safeText(typeName, "unknown"));
            std::fputc('}', traceState.file);
            endEvent();
        }
#else
        (void)allocationId;
        (void)generation;
        (void)oldAddress;
        (void)newAddress;
        (void)oldSize;
        (void)newSize;
        (void)typeName;
        (void)moduleName;
        (void)functionName;
        (void)sourcePath;
        (void)line;
        (void)column;
#endif
    }

    void ProgramObservability::
        recordDeallocation(std::uint64_t allocationId, std::uint64_t generation, void* address, std::size_t size, const char* typeName, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        char entityId[96] = {};
        std::snprintf(entityId, sizeof(entityId), "allocation:%llu:%llu", static_cast<unsigned long long>(traceState.processId), static_cast<unsigned long long>(allocationId));

        if (beginEvent("memory", "memory.free", entityId, moduleName, functionName, sourcePath, line, column)) {
            std::fprintf(traceState.file, ",\"details\":{\"allocationId\":%llu,\"generation\":%llu,\"size\":%zu", static_cast<unsigned long long>(allocationId), static_cast<unsigned long long>(generation), size);
            writeAddress("address", address);
            std::fputs(",\"typeName\":", traceState.file);
            writeJsonString(traceState.file, safeText(typeName, "unknown"));
            std::fputc('}', traceState.file);
            endEvent();
        }
#else
        (void)allocationId;
        (void)generation;
        (void)address;
        (void)size;
        (void)typeName;
        (void)moduleName;
        (void)functionName;
        (void)sourcePath;
        (void)line;
        (void)column;
#endif
    }

    void
    ProgramObservability::recordAggregateCreate(std::uint64_t aggregateId, void* address, const char* typeName, const char* storage, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        char entityId[96] = {};
        std::snprintf(entityId, sizeof(entityId), "aggregate:%llu:%llu", static_cast<unsigned long long>(traceState.processId), static_cast<unsigned long long>(aggregateId));

        if (beginEvent("aggregate", "aggregate.create", entityId, moduleName, functionName, sourcePath, line, column)) {
            std::fprintf(traceState.file, ",\"details\":{\"aggregateId\":%llu", static_cast<unsigned long long>(aggregateId));
            writeAddress("address", address);
            std::fputs(",\"typeName\":", traceState.file);
            writeJsonString(traceState.file, safeText(typeName, "aggregate"));
            std::fputs(",\"storage\":", traceState.file);
            writeJsonString(traceState.file, safeText(storage, "unknown"));
            std::fputc('}', traceState.file);
            endEvent();
        }
#else
        (void)aggregateId;
        (void)address;
        (void)typeName;
        (void)storage;
        (void)moduleName;
        (void)functionName;
        (void)sourcePath;
        (void)line;
        (void)column;
#endif
    }

    void
    ProgramObservability::recordAggregateDestroy(std::uint64_t aggregateId, void* address, const char* typeName, const char* storage, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        char entityId[96] = {};
        std::snprintf(entityId, sizeof(entityId), "aggregate:%llu:%llu", static_cast<unsigned long long>(traceState.processId), static_cast<unsigned long long>(aggregateId));

        if (beginEvent("aggregate", "aggregate.destroy", entityId, moduleName, functionName, sourcePath, line, column)) {
            std::fprintf(traceState.file, ",\"details\":{\"aggregateId\":%llu", static_cast<unsigned long long>(aggregateId));
            writeAddress("address", address);
            std::fputs(",\"typeName\":", traceState.file);
            writeJsonString(traceState.file, safeText(typeName, "aggregate"));
            std::fputs(",\"storage\":", traceState.file);
            writeJsonString(traceState.file, safeText(storage, "unknown"));
            std::fputc('}', traceState.file);
            endEvent();
        }
#else
        (void)aggregateId;
        (void)address;
        (void)typeName;
        (void)storage;
        (void)moduleName;
        (void)functionName;
        (void)sourcePath;
        (void)line;
        (void)column;
#endif
    }

    void ProgramObservability::recordResourceCreate(void* address, const char* typeName) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        if (!address || !initializeTrace()) {
            return;
        }

        if (findResource(address)) {
            emitResourceAnomaly("resource address created while already live", address, typeName);
            return;
        }

        auto* record = appendResource();
        if (!record) {
            return;
        }

        record->address = address;
        record->resourceId = ++traceState.resourceSequence;
        record->typeName = copyText(typeName);
        if (!record->typeName) {
            --traceState.resourceCount;
            traceState.droppedEvents = true;
            emitResourceAnomaly("resource type metadata allocation failed", address, typeName);
            return;
        }
        record->alive = true;

        char entityId[96] = {};
        std::snprintf(entityId, sizeof(entityId), "resource:%llu:%llu", static_cast<unsigned long long>(traceState.processId), static_cast<unsigned long long>(record->resourceId));

        if (beginEvent(
                "resource",
                "resource.create",
                entityId,
                MemoryTelemetry::currentModule(),
                MemoryTelemetry::currentFunction(),
                MemoryTelemetry::currentSourcePath(),
                MemoryTelemetry::currentSourceLine(),
                MemoryTelemetry::currentSourceColumn())) {
            std::fprintf(traceState.file, ",\"details\":{\"resourceId\":%llu", static_cast<unsigned long long>(record->resourceId));
            writeAddress("address", address);
            std::fputs(",\"typeName\":", traceState.file);
            writeJsonString(traceState.file, record->typeName);
            std::fputc('}', traceState.file);
            endEvent();
        }
#else
        (void)address;
        (void)typeName;
#endif
    }

    void ProgramObservability::recordResourceDestroy(void* address, const char* typeName) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        if (!address || !initializeTrace()) {
            return;
        }

        auto* record = findResource(address);
        if (!record) {
            emitResourceAnomaly("destroy of unknown or already destroyed resource", address, typeName);
            return;
        }

        char entityId[96] = {};
        std::snprintf(entityId, sizeof(entityId), "resource:%llu:%llu", static_cast<unsigned long long>(traceState.processId), static_cast<unsigned long long>(record->resourceId));

        if (beginEvent(
                "resource",
                "resource.destroy",
                entityId,
                MemoryTelemetry::currentModule(),
                MemoryTelemetry::currentFunction(),
                MemoryTelemetry::currentSourcePath(),
                MemoryTelemetry::currentSourceLine(),
                MemoryTelemetry::currentSourceColumn())) {
            std::fprintf(traceState.file, ",\"details\":{\"resourceId\":%llu", static_cast<unsigned long long>(record->resourceId));
            writeAddress("address", address);
            std::fputs(",\"typeName\":", traceState.file);
            writeJsonString(traceState.file, safeText(typeName, record->typeName));
            std::fputc('}', traceState.file);
            endEvent();
        }

        record->alive = false;
#else
        (void)address;
        (void)typeName;
#endif
    }

    void ProgramObservability::recordSemanticDecision(
        const char* phase,
        const char* eventKind,
        const char* decisionId,
        const char* nodeId,
        const char* valueId,
        const char* typeId,
        const char* decisionKind,
        const char* decisionReason,
        bool runtimeRequired,
        const char* moduleName,
        const char* functionName,
        const char* sourcePath,
        std::size_t line,
        std::size_t column) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        if (!beginEvent("semantic", safeText(eventKind, "semantic.decision"), decisionId, moduleName, functionName, sourcePath, line, column, phase)) {
            return;
        }

        std::fputs(",\"details\":{\"decisionId\":", traceState.file);
        writeJsonString(traceState.file, safeText(decisionId, ""));
        std::fputs(",\"nodeId\":", traceState.file);
        writeJsonString(traceState.file, safeText(nodeId, ""));
        std::fputs(",\"valueId\":", traceState.file);
        writeJsonString(traceState.file, safeText(valueId, ""));
        std::fputs(",\"typeId\":", traceState.file);
        writeJsonString(traceState.file, safeText(typeId, ""));
        std::fputs(",\"decisionKind\":", traceState.file);
        writeJsonString(traceState.file, safeText(decisionKind, "Unknown"));
        std::fputs(",\"decisionReason\":", traceState.file);
        writeJsonString(traceState.file, safeText(decisionReason, "Unknown"));
        std::fprintf(traceState.file, ",\"runtimeRequired\":%s", runtimeRequired ? "true" : "false");
        const auto frameId = MemoryTelemetry::currentFrameId();
        if (frameId != 0) {
            std::fprintf(traceState.file, ",\"frameId\":%llu", static_cast<unsigned long long>(frameId));
        }
        std::fputc('}', traceState.file);
        endEvent();
#else
        (void)phase;
        (void)eventKind;
        (void)decisionId;
        (void)nodeId;
        (void)valueId;
        (void)typeId;
        (void)decisionKind;
        (void)decisionReason;
        (void)runtimeRequired;
        (void)moduleName;
        (void)functionName;
        (void)sourcePath;
        (void)line;
        (void)column;
#endif
    }

    void ProgramObservability::recordCleanupEvent(
        const char* phase,
        const char* eventKind,
        const char* cleanupId,
        const char* owner,
        const char* cleanupKind,
        const char* destroyFunction,
        const char* storage,
        const char* exitReason,
        std::int64_t symbolId,
        const char* moduleName,
        const char* functionName,
        const char* sourcePath,
        std::size_t line,
        std::size_t column) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        if (!beginEvent("cleanup", safeText(eventKind, "cleanup.event"), cleanupId, moduleName, functionName, sourcePath, line, column, phase)) {
            return;
        }

        std::fputs(",\"details\":{\"cleanupId\":", traceState.file);
        writeJsonString(traceState.file, safeText(cleanupId, ""));
        std::fputs(",\"owner\":", traceState.file);
        writeJsonString(traceState.file, safeText(owner, ""));
        std::fputs(",\"cleanupKind\":", traceState.file);
        writeJsonString(traceState.file, safeText(cleanupKind, "aggregate"));
        std::fputs(",\"destroyFunction\":", traceState.file);
        writeJsonString(traceState.file, safeText(destroyFunction, ""));
        std::fputs(",\"storage\":", traceState.file);
        writeJsonString(traceState.file, safeText(storage, "local"));
        std::fputs(",\"exitReason\":", traceState.file);
        writeJsonString(traceState.file, safeText(exitReason, "none"));
        std::fprintf(traceState.file, ",\"symbolId\":%lld", static_cast<long long>(symbolId));
        const auto frameId = MemoryTelemetry::currentFrameId();
        if (frameId != 0) {
            std::fprintf(traceState.file, ",\"frameId\":%llu", static_cast<unsigned long long>(frameId));
        }
        std::fputc('}', traceState.file);
        endEvent();
#else
        (void)phase;
        (void)eventKind;
        (void)cleanupId;
        (void)owner;
        (void)cleanupKind;
        (void)destroyFunction;
        (void)storage;
        (void)exitReason;
        (void)symbolId;
        (void)moduleName;
        (void)functionName;
        (void)sourcePath;
        (void)line;
        (void)column;
#endif
    }

} // namespace yogi::runtime

extern "C" {

    bool yogi_program_observability_enabled() {
        return yogi::runtime::ProgramObservability::enabled();
    }

    void yogi_observe_resource_create(void* address, const char* typeName) {
        yogi::runtime::ProgramObservability::recordResourceCreate(address, typeName);
    }

    void yogi_observe_resource_destroy(void* address, const char* typeName) {
        yogi::runtime::ProgramObservability::recordResourceDestroy(address, typeName);
    }

    void yogi_observe_semantic_decision(const char* decisionId, const char* nodeId, const char* valueId, const char* typeId, const char* decisionKind, const char* decisionReason) {
        yogi::runtime::ProgramObservability::recordSemanticDecision(
            "runtime",
            "semantic.decision.execute",
            decisionId,
            nodeId,
            valueId,
            typeId,
            decisionKind,
            decisionReason,
            true,
            yogi::runtime::MemoryTelemetry::currentModule(),
            yogi::runtime::MemoryTelemetry::currentFunction(),
            yogi::runtime::MemoryTelemetry::currentSourcePath(),
            yogi::runtime::MemoryTelemetry::currentSourceLine(),
            yogi::runtime::MemoryTelemetry::currentSourceColumn());
    }

    void yogi_observe_cleanup(
        const char* cleanupId,
        const char* owner,
        const char* cleanupKind,
        const char* destroyFunction,
        const char* storage,
        const char* eventKind,
        const char* exitReason,
        const char* sourcePath,
        unsigned long long line,
        unsigned long long column) {
        yogi::runtime::ProgramObservability::recordCleanupEvent(
            "runtime",
            eventKind,
            cleanupId,
            owner,
            cleanupKind,
            destroyFunction,
            storage,
            exitReason,
            -1,
            yogi::runtime::MemoryTelemetry::currentModule(),
            yogi::runtime::MemoryTelemetry::currentFunction(),
            sourcePath,
            static_cast<std::size_t>(line),
            static_cast<std::size_t>(column));
    }
}
