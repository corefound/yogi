// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "yogi/runtime.h"

#include <cstddef>

namespace yogi::runtime {

	class AnyValue final {
		public:
			static AnyValue *undefined();
			static AnyValue *null();
			static AnyValue *fromNumber(double value);
			static AnyValue *fromBoolean(bool value);
			static AnyValue *fromString(const char *value);
			static AnyValue *fromArray(void *value);
			static AnyValue *fromObject(void *value);
			static AnyValue *fromPointer(void *value);
			static AnyValue *cloneOwned(void *value);
			static void destroyOwnedPayload(void *value);
			static void destroy(void *value);
			static void retain(void *value);
			static void release(void *value);
			static const AnyValue *require(void *value, const char *targetType);

			YogiAnyTag tag() const;
			const char *typeName() const;

			double asNumber() const;
			bool asBoolean() const;
			const char *asString() const;
			void *asArray() const;
			void *asObject() const;
			void *asPointer() const;
			void *asNull() const;
			void *asUndefined() const;
			bool isNullish() const;
			const char *javascriptTypeName() const;

		private:
			explicit AnyValue(YogiAnyTag tag, bool immortal = false);

			static AnyValue *allocate(YogiAnyTag tag);
			static AnyValue undefinedValue;
			static AnyValue nullValue;
			void requireTag(YogiAnyTag expectedTag, const char *targetType) const;

			YogiAnyTag valueTag;
			std::size_t references;
			bool immortal;
			union {
				double number;
				bool boolean;
				const char *string;
				void *array;
				void *object;
				void *pointer;
			} storage;
	};

} // namespace yogi::runtime
