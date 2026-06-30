// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/errors.h"

#include "yogi/runtime/memory.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace yogi::runtime {
    namespace {
        const char* safeText(const char* value, const char* fallback) {
            return value && value[0] != '\0' ? value : fallback;
        }

        int digitCount(unsigned long long n) {
            if (n == 0) {
                return 1;
            }
            int count = 0;
            while (n > 0) {
                ++count;
                n /= 10;
            }
            return count;
        }

        void printLocation(const char* label, const char* moduleName, const char* functionName, const char* sourcePath, unsigned long long line, unsigned long long column) {
            std::fprintf(stderr, "  %s: module=%s function=%s source=%s:%llu:%llu\n", label, safeText(moduleName, "<runtime>"), safeText(functionName, "<unknown>"), safeText(sourcePath, "<unknown>"), line, column);
        }

        void printGutter(int width) {
            for (int i = 0; i < width; ++i) {
                std::fputc(' ', stderr);
            }
        }

        void printSourceLine(const char* sourcePath, unsigned long long line, unsigned long long column) {
            if (!sourcePath || sourcePath[0] == '\0') {
                return;
            }

            std::FILE *file = std::fopen(sourcePath, "r");
            if (!file) {
                return;
            }

            char buffer[4096];
            const unsigned long long targetLine = line;
            unsigned long long current = 0;
            bool found = false;

            while (current <= targetLine && std::fgets(buffer, sizeof(buffer), file)) {
                if (current == targetLine) {
                    found = true;
                    break;
                }
                ++current;
            }

            std::fclose(file);

            if (!found || buffer[0] == '\0') {
                return;
            }

            std::size_t len = std::strlen(buffer);
            if (len > 0 && buffer[len - 1] == '\n') {
                buffer[len - 1] = '\0';
                --len;
            }

            char displayBuffer[4096];
            std::size_t displayLen = 0;
            for (std::size_t i = 0; i < len && displayLen < sizeof(displayBuffer) - 1; ++i) {
                if (buffer[i] == '\t') {
                    for (int t = 0; t < 4 && displayLen < sizeof(displayBuffer) - 1; ++t) {
                        displayBuffer[displayLen++] = ' ';
                    }
                } else {
                    displayBuffer[displayLen++] = buffer[i];
                }
            }
            displayBuffer[displayLen] = '\0';

            const auto displayLineNumber = line + 1;
            const auto displayColumn = static_cast<std::size_t>(column);
            const auto gutterWidth = digitCount(displayLineNumber);

            std::fprintf(stderr, "\n");
            printGutter(gutterWidth);
            std::fprintf(stderr, " |\n");

            std::fprintf(stderr, "%llu | %s\n", displayLineNumber, displayBuffer);

            printGutter(gutterWidth);
            std::fprintf(stderr, " | ");
            for (std::size_t i = 0; i < displayColumn; ++i) {
                std::fputc(' ', stderr);
            }
            std::fprintf(stderr, "^\n");
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
        const auto *sourcePath = safeText(MemoryManager::currentMemorySourcePath(), "<unknown>");
        const auto line = static_cast<unsigned long long>(MemoryManager::currentMemorySourceLine());
        const auto column = static_cast<unsigned long long>(MemoryManager::currentMemorySourceColumn());

        std::fprintf(
            stderr,
            "%s:%llu:%llu - runtime range error: %s index %lld is out of range for length %llu\n\n",
            sourcePath,
            line + 1,
            column + 1,
            safeText(operation, "array access"),
            index,
            length);

        printSourceLine(MemoryManager::currentMemorySourcePath(), line, column);
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
