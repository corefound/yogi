// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/any.h"

#include "yogi/runtime/aggregate.h"
#include "yogi/runtime/errors.h"
#include "yogi/runtime/memory.h"

#include <new>

namespace yogi::runtime {

	AnyValue AnyValue::undefinedValue(YOGI_ANY_UNDEFINED, true);
	AnyValue AnyValue::nullValue(YOGI_ANY_NULL, true);

	AnyValue::AnyValue(YogiAnyTag tag, bool immortal)
		: valueTag(tag),
		  references(immortal ? 0 : 1),
		  immortal(immortal),
		  storage{} {}

	AnyValue *AnyValue::allocate(YogiAnyTag tag) {
		void *address = MemoryManager::allocate(sizeof(AnyValue), "any value");
		return new (address) AnyValue(tag);
	}

	AnyValue *AnyValue::undefined() {
		return &undefinedValue;
	}

	AnyValue *AnyValue::null() {
		return &nullValue;
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
		if (!value) {
			return undefined();
		}

		AnyValue *anyValue = allocate(YOGI_ANY_STRING);
		anyValue->storage.string = value;
		return anyValue;
	}

	AnyValue *AnyValue::fromArray(void *value) {
		AnyValue *anyValue = allocate(YOGI_ANY_ARRAY);
		anyValue->storage.array = value;
		return anyValue;
	}

	AnyValue *AnyValue::fromObject(void *value) {
		AnyValue *anyValue = allocate(YOGI_ANY_OBJECT);
		anyValue->storage.object = value;
		return anyValue;
	}

	AnyValue *AnyValue::fromPointer(void *value) {
		AnyValue *anyValue = allocate(YOGI_ANY_POINTER);
		anyValue->storage.pointer = value;
		return anyValue;
	}

	AnyValue *AnyValue::cloneOwned(void *value) {
		const auto *source = require(value, "copyable value");

		switch (source->tag()) {
			case YOGI_ANY_UNDEFINED:
				return undefined();
			case YOGI_ANY_NULL:
				return null();
			case YOGI_ANY_NUMBER:
				return fromNumber(source->asNumber());
			case YOGI_ANY_BOOLEAN:
				return fromBoolean(source->asBoolean());
			case YOGI_ANY_STRING:
				return fromString(yogi_string_from_native_owned(source->asString()));
			case YOGI_ANY_ARRAY: {
				auto *array = static_cast<ArrayValue *>(source->asArray());
				return fromArray(array ? array->clone() : nullptr);
			}
			case YOGI_ANY_OBJECT: {
				auto *object = static_cast<ObjectValue *>(source->asObject());
				return fromObject(object ? object->clone() : nullptr);
			}
			case YOGI_ANY_POINTER:
				return fromPointer(source->asPointer());
		}

		RuntimeError::abortOwnership("boxed value has no recursive copy policy", value, "any value");
	}

	void AnyValue::destroyOwnedPayload(void *value) {
		const auto *owned = require(value, "owned value");

		switch (owned->tag()) {
			case YOGI_ANY_STRING:
				yogi_string_destroy(owned->asString());
				return;
			case YOGI_ANY_ARRAY: {
				auto *array = static_cast<ArrayValue *>(owned->asArray());
				if (array) {
					array->release();
				}
				return;
			}
			case YOGI_ANY_OBJECT: {
				auto *object = static_cast<ObjectValue *>(owned->asObject());
				if (object) {
					yogi_object_destroy(object);
				}
				return;
			}
			default:
				return;
		}
	}

	void AnyValue::destroy(void *value) {
		destroyOwnedPayload(value);
		release(value);
	}

	void AnyValue::retain(void *value) {
		if (!value) {
			return;
		}

		auto *anyValue = static_cast<AnyValue *>(value);
		if (!anyValue->immortal) {
			++anyValue->references;
		}
	}

	void AnyValue::release(void *value) {
		if (!value) {
			return;
		}

		auto *anyValue = static_cast<AnyValue *>(value);
		if (anyValue->immortal) {
			return;
		}

		if (anyValue->references == 0) {
			RuntimeError::abortOwnership("AnyValue released without an owning reference", value, "any value");
		}

		--anyValue->references;
		if (anyValue->references == 0) {
			anyValue->~AnyValue();
			MemoryManager::deallocate(anyValue);
		}
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
			case YOGI_ANY_ARRAY:
				return "array";
			case YOGI_ANY_OBJECT:
				return "object";
			case YOGI_ANY_POINTER:
				return "pointer";
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

	void *AnyValue::asArray() const {
		requireTag(YOGI_ANY_ARRAY, "array");
		return storage.array;
	}

	void *AnyValue::asObject() const {
		requireTag(YOGI_ANY_OBJECT, "object");
		return storage.object;
	}

	void *AnyValue::asPointer() const {
		requireTag(YOGI_ANY_POINTER, "pointer");
		return storage.pointer;
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

	const char *AnyValue::javascriptTypeName() const {
		switch (valueTag) {
			case YOGI_ANY_UNDEFINED:
				return "undefined";
			case YOGI_ANY_NUMBER:
				return "number";
			case YOGI_ANY_BOOLEAN:
				return "boolean";
			case YOGI_ANY_STRING:
				return "string";
			case YOGI_ANY_NULL:
			case YOGI_ANY_ARRAY:
			case YOGI_ANY_OBJECT:
			case YOGI_ANY_POINTER:
				return "object";
		}

		return "undefined";
	}

	void AnyValue::requireTag(YogiAnyTag expectedTag, const char *targetType) const {
		if (valueTag != expectedTag) {
			RuntimeError::abortCast(typeName(), targetType);
		}
	}

} // namespace yogi::runtime
