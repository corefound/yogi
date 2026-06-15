// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "yogi/runtime.h"

namespace yogi::runtime {

	class AnyValue final {
		public:
			static AnyValue *undefined();
			static AnyValue *null();
			static AnyValue *fromNumber(double value);
			static AnyValue *fromBoolean(bool value);
			static AnyValue *fromString(const char *value);
			static const AnyValue *require(void *value, const char *targetType);

			YogiAnyTag tag() const;
			const char *typeName() const;

			double asNumber() const;
			bool asBoolean() const;
			const char *asString() const;
			void *asNull() const;
			void *asUndefined() const;
			bool isNullish() const;

		private:
			explicit AnyValue(YogiAnyTag tag);

			static AnyValue *allocate(YogiAnyTag tag);
			void requireTag(YogiAnyTag expectedTag, const char *targetType) const;

			YogiAnyTag valueTag;
			union {
				double number;
				bool boolean;
				const char *string;
			} storage;
	};

} // namespace yogi::runtime
