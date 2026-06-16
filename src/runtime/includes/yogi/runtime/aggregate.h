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
			void destroy();

		private:
			void **elements = nullptr;
			std::size_t elementCount = 0;
			std::size_t elementCapacity = 0;

			void ensureCapacity(std::size_t requiredCapacity);
	};

} // namespace yogi::runtime
