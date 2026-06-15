// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

namespace yogi::runtime {

    class RuntimeError final {
       public:
        [[noreturn]] static void abortAllocation(const char* typeName);
        [[noreturn]] static void abortCast(const char* fromType, const char* toType);
        [[noreturn]] static void abortOwnership(const char* reason, const void* address, const char* typeName);
        [[noreturn]] static void abortOwnershipDetailed(
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
            unsigned long long detectedColumn);
    };

} // namespace yogi::runtime
