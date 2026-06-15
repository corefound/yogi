// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/any.h"

#include "yogi/runtime/errors.h"
#include "yogi/runtime/memory.h"

#include <new>

namespace yogi::runtime {

	AnyValue::AnyValue(YogiAnyTag tag)
		: valueTag(tag),
		  storage{} {}

	AnyValue *AnyValue::allocate(YogiAnyTag tag) {
		void *address = MemoryManager::allocate(sizeof(AnyValue), "any value");
		return new (address) AnyValue(tag);
	}

	AnyValue *AnyValue::undefined() {
		return allocate(YOGI_ANY_UNDEFINED);
	}

	AnyValue *AnyValue::null() {
		return allocate(YOGI_ANY_NULL);
	}

	AnyValue *AnyValue::fromNumber(double value) {
		AnyValue *anyValue = allocate(YOGI_ANY_NUMBER);
		anyValue->storage.number = value;
		return anyValue;
	}

	AnyValue *AnyValue::fromBoolean(bool value) {
		AnyValue *anyValue = allocate(YOGI_ANY_BOOLEAN);
		anyValue->storage.boolean = value;
		return anyValue;
	}

	AnyValue *AnyValue::fromString(const char *value) {
		AnyValue *anyValue = allocate(YOGI_ANY_STRING);
		anyValue->storage.string = value;
		return anyValue;
	}

	const AnyValue *AnyValue::require(void *value, const char *targetType) {
		if (!value) {
			RuntimeError::abortCast("null pointer", targetType);
		}

		return static_cast<const AnyValue *>(value);
	}

	YogiAnyTag AnyValue::tag() const {
		return valueTag;
	}

	const char *AnyValue::typeName() const {
		switch (valueTag) {
			case YOGI_ANY_UNDEFINED:
				return "undefined";
			case YOGI_ANY_NULL:
				return "null";
			case YOGI_ANY_NUMBER:
				return "number";
			case YOGI_ANY_BOOLEAN:
				return "boolean";
			case YOGI_ANY_STRING:
				return "string";
		}

		return "unknown";
	}

	double AnyValue::asNumber() const {
		requireTag(YOGI_ANY_NUMBER, "number");
		return storage.number;
	}

	bool AnyValue::asBoolean() const {
		requireTag(YOGI_ANY_BOOLEAN, "boolean");
		return storage.boolean;
	}

	const char *AnyValue::asString() const {
		requireTag(YOGI_ANY_STRING, "string");
		return storage.string;
	}

	void *AnyValue::asNull() const {
		requireTag(YOGI_ANY_NULL, "null");
		return nullptr;
	}

	void *AnyValue::asUndefined() const {
		requireTag(YOGI_ANY_UNDEFINED, "undefined");
		return nullptr;
	}

	bool AnyValue::isNullish() const {
		return valueTag == YOGI_ANY_NULL || valueTag == YOGI_ANY_UNDEFINED;
	}

	void AnyValue::requireTag(YogiAnyTag expectedTag, const char *targetType) const {
		if (valueTag != expectedTag) {
			RuntimeError::abortCast(typeName(), targetType);
		}
	}

} // namespace yogi::runtime
