// Created by Brayhan De Aza on 7/26/26.
//

#pragma once

#include <cstddef>
#include <cstdint>

namespace yogi::runtime {

    class ProgramObservability final {
       public:
        static bool enabled();

        static std::uint64_t nextAllocationId();
        static std::uint64_t nextAggregateId();

        static std::uint64_t beginFrame(std::uint64_t parentFrameId, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column);
        static void endFrame(std::uint64_t frameId, const char* exitReason, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column);

        static void
        recordAllocation(std::uint64_t allocationId, std::uint64_t generation, void* address, std::size_t size, const char* typeName, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column);
        static void recordReallocation(
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
            std::size_t column);
        static void
        recordDeallocation(std::uint64_t allocationId, std::uint64_t generation, void* address, std::size_t size, const char* typeName, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column);

        static void recordAggregateCreate(std::uint64_t aggregateId, void* address, const char* typeName, const char* storage, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column);
        static void recordAggregateDestroy(std::uint64_t aggregateId, void* address, const char* typeName, const char* storage, const char* moduleName, const char* functionName, const char* sourcePath, std::size_t line, std::size_t column);

        static void recordResourceCreate(void* address, const char* typeName);
        static void recordResourceDestroy(void* address, const char* typeName);

        static void recordSemanticDecision(
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
            std::size_t column);

        static void recordCleanupEvent(
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
            std::size_t column);
    };

} // namespace yogi::runtime
