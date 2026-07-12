// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "yogi/runtime.h"

#include <cstddef>

namespace yogi::runtime {

	class ArrayIterationPlan;

	class ObjectValue final {
		public:
			static ObjectValue *create();
			static void init(void *address);
			static std::size_t size();

			void set(const char *name, void *value);
			void *get(const char *name) const;
			void **cell(const char *name);
			void **cell(const char *name, void **ownerArraySlot);
			static void *cellGet(void *cell);
			static void cellSet(void *cell, void *value);
			static void **ownerArraySlotForCell(void *cell);
			std::size_t length() const;
			const char *keyAt(std::size_t index) const;
			void *valueAt(std::size_t index) const;
			void destroy();

		private:
			struct Property {
				void *value;
				char *key;
				void **ownerArraySlot;
			};

			Property *properties = nullptr;
			std::size_t propertyCount = 0;
			std::size_t propertyCapacity = 0;

			void ensureCapacity();
			std::size_t find(const char *name) const;
			static char *copyKey(const char *name);
	};

	class ArrayValue final {
		public:
			enum class StorageMode {
				ContiguousFastPath,
				PointerSafeChunkedMode,
			};
			struct ElementSlot;

			static ArrayValue *create(std::size_t length, StorageMode storageMode = StorageMode::ContiguousFastPath);
			static ArrayValue *createView(ArrayValue *source, std::size_t offset, std::size_t length);
			static void init(void *address, std::size_t length, StorageMode storageMode = StorageMode::ContiguousFastPath);
			static StorageMode storageModeFromName(const char *name);
			static void *cellGet(void *cell);
			static void cellSet(void *cell, void *value);
			static std::size_t size();

			void set(std::size_t index, void *value);
			void *get(std::size_t index) const;
			void **cell(std::size_t index);
			void *pointerCell(std::size_t index);
			std::size_t push(void *value);
			void *pop();
			void *at(std::size_t index) const;
			void *at(double index) const;
			std::size_t length() const;
			void *shift();
			std::size_t unshift(void *value);
			bool includes(void *value, double fromIndex) const;
			long long indexOf(void *value, double fromIndex) const;
			long long lastIndexOf(void *value, double fromIndex) const;
			void reverse();
			ArrayValue *clone() const;
			void appendArray(const ArrayValue *source);
			void insert(std::size_t index, void *value);
			void fill(void *value, double start, double end);
			void copyWithin(double target, double start, double end);
			ArrayValue *splice(double start, double deleteCount, const ArrayValue *inserted);
			void swapSlots(std::size_t left, std::size_t right);
			ArrayValue *toReversed() const;
			ArrayValue *toSpliced(double start, double deleteCount, const ArrayValue *inserted) const;
			ArrayValue *with(double index, void *value) const;
			ArrayValue *slice(double start, double end) const;
			ArrayValue *flat(std::size_t depth) const;
			ArrayValue *keys() const;
			ArrayValue *values() const;
			ArrayValue *entries() const;
			const char *join(const char *separator) const;
			const char *toString() const;
			const char *storageModeName() const;
			void sort();
			ArrayValue *toSorted() const;
			void replaceFrom(const ArrayValue *source);
			void retainViewSource();
			void destroy();

		private:
			friend class ArrayIterationPlan;

			StorageMode storageMode = StorageMode::ContiguousFastPath;
			void **contiguousValues = nullptr;
			void ***elements = nullptr;
			void ***retiredElements = nullptr;
			std::size_t elementCount = 0;
			std::size_t elementCapacity = 0;
			std::size_t retiredElementCount = 0;
			std::size_t retiredElementCapacity = 0;
			ArrayValue *viewSource = nullptr;
			std::size_t viewOffset = 0;
			std::size_t owningViewCount = 0;
			bool ownsViewSource = false;

			bool usesPointerSafeStorage() const;
			void resetContiguousSlots(std::size_t start = 0);
			static void **createSlot(void *value);
			void *slotValue(std::size_t index) const;
			void setSlotValue(std::size_t index, void *value);
			void invalidateSlot(std::size_t index);
			void promoteToPointerSafeStorage();
			void retireSlot(void **slot);
			void releaseSlot(std::size_t index);
			void releaseCell(void **slot);
			void releaseRetiredSlots();
			void ensureCapacity(std::size_t requiredCapacity);
			bool isView() const;
	};

	class ArrayIterationPlan final {
		public:
			static ArrayIterationPlan *create(ArrayValue *source);

			std::size_t length() const;
			bool valid(std::size_t index) const;
			void *value(std::size_t index) const;
			void *pointer(std::size_t index) const;
			void destroy();

		private:
			ArrayValue *source = nullptr;
			void ***slots = nullptr;
			std::size_t slotCount = 0;
	};

} // namespace yogi::runtime
