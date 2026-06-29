// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/errors.h"

#include "yogi/runtime/memory.h"

#include <cstdio>
#include <cstdlib>

namespace yogi::runtime {
    namespace {
        const char* safeText(const char* value, const char* fallback) {
            return value && value[0] != '\0' ? value : fallback;
        }

        void printLocation(const char* label, const char* moduleName, const char* functionName, const char* sourcePath, unsigned long long line, unsigned long long column) {
            std::fprintf(stderr, "  %s: module=%s function=%s source=%s:%llu:%llu\n", label, safeText(moduleName, "<runtime>"), safeText(functionName, "<unknown>"), safeText(sourcePath, "<unknown>"), line, column);
        }
    } // namespace

    void RuntimeError::abortAllocation(const char* typeName) {
        std::fprintf(stderr, "yogi runtime error: failed to allocate %s\n", typeName ? typeName : "value");
        std::abort();
    }

    void RuntimeError::abortCast(const char* fromType, const char* toType) {
        std::fprintf(stderr, "yogi runtime error: cannot cast value of type '%s' to '%s'\n", fromType ? fromType : "unknown", toType ? toType : "unknown");
        std::abort();
    }

    void RuntimeError::abortRange(const char* operation, long long index, unsigned long long length) {
        std::fprintf(
            stderr,
            "yogi runtime range error: %s index %lld is out of range for length %llu\n",
            safeText(operation, "array access"),
            index,
            length);
        printLocation(
            "detected",
            MemoryManager::currentMemoryModule(),
            MemoryManager::currentMemoryFunction(),
            MemoryManager::currentMemorySourcePath(),
            MemoryManager::currentMemorySourceLine(),
            MemoryManager::currentMemorySourceColumn());
        std::abort();
    }

    void RuntimeError::abortStructValidation(const char* structName, const char* validatorName) {
        std::fprintf(
            stderr,
            "yogi runtime struct validation error: struct '%s' failed validator '%s'\n",
            safeText(structName, "<unknown>"),
            safeText(validatorName, "<unknown>"));
        printLocation(
            "detected",
            MemoryManager::currentMemoryModule(),
            MemoryManager::currentMemoryFunction(),
            MemoryManager::currentMemorySourcePath(),
            MemoryManager::currentMemorySourceLine(),
            MemoryManager::currentMemorySourceColumn());
        std::abort();
    }

    void RuntimeError::abortOwnership(const char* reason, const void* address, const char* typeName) {
        std::fprintf(stderr, "yogi runtime ownership error: %s at %p", reason ? reason : "ownership violation", address);

        if (typeName) {
            std::fprintf(stderr, " (%s)", typeName);
        }

        std::fprintf(stderr, "\n");
        std::abort();
    }

    void RuntimeError::abortOwnershipDetailed(
        const char* reason,
        const void* address,
        const char* typeName,
        const char* createdModule,
        const char* createdFunction,
        const char* createdSource,
        unsigned long long createdLine,
        unsigned long long createdColumn,
        const char* lastModule,
        const char* lastFunction,
        const char* lastSource,
        unsigned long long lastLine,
        unsigned long long lastColumn,
        const char* detectedModule,
        const char* detectedFunction,
        const char* detectedSource,
        unsigned long long detectedLine,
        unsigned long long detectedColumn) {
        std::fprintf(stderr, "yogi runtime ownership error: %s at %p", reason ? reason : "ownership violation", address);

        if (typeName) {
            std::fprintf(stderr, " (%s)", typeName);
        }

        std::fprintf(stderr, "\n");
        printLocation("created", createdModule, createdFunction, createdSource, createdLine, createdColumn);
        printLocation("last-event", lastModule, lastFunction, lastSource, lastLine, lastColumn);
        printLocation("detected", detectedModule, detectedFunction, detectedSource, detectedLine, detectedColumn);
        std::abort();
    }

} // namespace yogi::runtime
