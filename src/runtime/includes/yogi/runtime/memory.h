// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include <cstddef>

namespace yogi::runtime {

	class MemoryManager final {
		public:
			static const char *allocatorName();
			static void *allocate(std::size_t size, const char *typeName);
			static void *reallocate(void *address, std::size_t newSize, const char *typeName);
			static void deallocate(void *address);
			static std::size_t liveBytes();
			static std::size_t liveAllocations();
			static std::size_t totalAllocatedBytes();
			static std::size_t totalFreedBytes();
			static std::size_t peakBytes();
			static void pushMemoryContext(const char *moduleName, const char *functionName);
			static void popMemoryContext();
			static const char *currentMemoryModule();
			static const char *currentMemoryFunction();
			static void pushMemorySourceLocation(const char *sourcePath, std::size_t line, std::size_t column);
			static void popMemorySourceLocation();
			static const char *currentMemorySourcePath();
			static std::size_t currentMemorySourceLine();
			static std::size_t currentMemorySourceColumn();
			static std::size_t attributedLiveBytes(const char *moduleName, const char *functionName);
			static std::size_t attributedLiveAllocations(const char *moduleName, const char *functionName);
			static std::size_t attributedTotalAllocatedBytes(const char *moduleName, const char *functionName);
			static std::size_t attributedTotalFreedBytes(const char *moduleName, const char *functionName);
			static std::size_t attributedPeakBytes(const char *moduleName, const char *functionName);
			static std::size_t attributedLocationLiveBytes(const char *sourcePath, std::size_t line, std::size_t column);
			static std::size_t attributedLocationLiveAllocations(const char *sourcePath, std::size_t line, std::size_t column);
			static std::size_t attributedLocationTotalAllocatedBytes(const char *sourcePath, std::size_t line, std::size_t column);
			static std::size_t attributedLocationTotalFreedBytes(const char *sourcePath, std::size_t line, std::size_t column);
			static std::size_t attributedLocationPeakBytes(const char *sourcePath, std::size_t line, std::size_t column);
			static void reportMemoryTelemetry();
	};

} // namespace yogi::runtime
