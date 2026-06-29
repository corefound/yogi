// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "yogi/runtime.h"

#include <cstddef>

namespace yogi::runtime {

	class ObjectValue final {
		public:
			static ObjectValue *create();
			static void init(void *address);
			static std::size_t size();

			void set(const char *name, void *value);
			void *get(const char *name) const;
			std::size_t length() const;
			const char *keyAt(std::size_t index) const;
			void *valueAt(std::size_t index) const;
			void destroy();

		private:
			struct Property {
				char *key;
				void *value;
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
			static ArrayValue *create(std::size_t length);
			static void init(void *address, std::size_t length);
			static std::size_t size();

			void set(std::size_t index, void *value);
			void *get(std::size_t index) const;
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
			void sort();
			ArrayValue *toSorted() const;
			void destroy();

		private:
			void **elements = nullptr;
			std::size_t elementCount = 0;
			std::size_t elementCapacity = 0;

			void ensureCapacity(std::size_t requiredCapacity);
	};

} // namespace yogi::runtime
