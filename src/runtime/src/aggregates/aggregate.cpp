// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/aggregate.h"

#include "yogi/runtime/any.h"
#include "yogi/runtime/debug/ownership.h"
#include "yogi/runtime/memory.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>
#include <new>

namespace yogi::runtime {

	namespace {
		double toInteger(double value) {
			if (std::isnan(value)) {
				return 0;
			}

			if (std::isinf(value)) {
				return value;
			}

			return std::trunc(value);
		}

		std::size_t normalizeForwardStart(double fromIndex, std::size_t length) {
			const auto integer = toInteger(fromIndex);

			if (std::isinf(integer)) {
				return integer > 0 ? length : 0;
			}

			if (integer >= 0) {
				return std::min<std::size_t>(static_cast<std::size_t>(integer), length);
			}

			const auto shifted = static_cast<double>(length) + integer;
			return shifted <= 0 ? 0 : static_cast<std::size_t>(shifted);
		}

		long long normalizeLastStart(double fromIndex, std::size_t length) {
			if (length == 0) {
				return -1;
			}

			const auto integer = toInteger(fromIndex);

			if (std::isinf(integer)) {
				return integer > 0 ? static_cast<long long>(length - 1) : -1;
			}

			if (integer >= 0) {
				return std::min<long long>(static_cast<long long>(integer), static_cast<long long>(length - 1));
			}

			const auto shifted = static_cast<double>(length) + integer;
			return shifted < 0 ? -1 : static_cast<long long>(shifted);
		}

		std::size_t normalizeSliceBound(double value, std::size_t length, bool defaultToLength) {
			const auto integer = toInteger(value);

			if (std::isinf(integer)) {
				if (integer > 0) {
					return defaultToLength ? length : length;
				}

				return 0;
			}

			if (integer >= 0) {
				return std::min<std::size_t>(static_cast<std::size_t>(integer), length);
			}

			const auto shifted = static_cast<double>(length) + integer;
			return shifted <= 0 ? 0 : static_cast<std::size_t>(shifted);
		}

		const AnyValue *asAny(void *value) {
			return value ? AnyValue::require(value, "any") : nullptr;
		}

		bool strictEquals(void *left, void *right, bool sameValueZero) {
			const auto *leftAny = asAny(left);
			const auto *rightAny = asAny(right);

			if (!leftAny || !rightAny || leftAny->tag() != rightAny->tag()) {
				return false;
			}

			switch (leftAny->tag()) {
				case YOGI_ANY_UNDEFINED:
				case YOGI_ANY_NULL:
					return true;

				case YOGI_ANY_NUMBER: {
					const auto leftNumber = leftAny->asNumber();
					const auto rightNumber = rightAny->asNumber();

					if (sameValueZero && std::isnan(leftNumber) && std::isnan(rightNumber)) {
						return true;
					}

					return leftNumber == rightNumber;
				}

				case YOGI_ANY_BOOLEAN:
					return leftAny->asBoolean() == rightAny->asBoolean();

				case YOGI_ANY_STRING: {
					const auto *leftString = leftAny->asString();
					const auto *rightString = rightAny->asString();
					return std::strcmp(leftString ? leftString : "", rightString ? rightString : "") == 0;
				}
			}

			return false;
		}
	}

	ObjectValue *ObjectValue::create() {
		void *address = MemoryManager::allocate(sizeof(ObjectValue), "object value");
		auto *object = new (address) ObjectValue();
		OwnershipTracker::markHeapAggregate(object, "object value");
		return object;
	}

	void ObjectValue::init(void *address) {
		new (address) ObjectValue();
		OwnershipTracker::registerStackAggregate(address, "object value");
	}

	std::size_t ObjectValue::size() {
		return sizeof(ObjectValue);
	}

	void ObjectValue::set(const char *name, void *value) {
		OwnershipTracker::assertLiveAggregate(this, "object set after destroy/drop", "object value");

		if (!name) {
			return;
		}

		const auto index = find(name);

		if (index < propertyCount) {
			properties[index].value = value ? value : AnyValue::undefined();
			return;
		}

		ensureCapacity();
		properties[propertyCount].key = copyKey(name);
		properties[propertyCount].value = value ? value : AnyValue::undefined();
		++propertyCount;
	}

	void *ObjectValue::get(const char *name) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ObjectValue *>(this), "object get after destroy/drop", "object value");

		if (!name) {
			return AnyValue::undefined();
		}

		const auto index = find(name);

		if (index >= propertyCount) {
			return AnyValue::undefined();
		}

		return properties[index].value ? properties[index].value : AnyValue::undefined();
	}

	void ObjectValue::ensureCapacity() {
		if (propertyCount < propertyCapacity) {
			return;
		}

		const auto nextCapacity = propertyCapacity == 0 ? 4 : propertyCapacity * 2;
		auto *nextProperties = static_cast<Property *>(
			MemoryManager::reallocate(properties, sizeof(Property) * nextCapacity, "object properties")
		);

		properties = nextProperties;
		propertyCapacity = nextCapacity;
	}

	std::size_t ObjectValue::find(const char *name) const {
		for (std::size_t index = 0; index < propertyCount; ++index) {
			if (properties[index].key && std::strcmp(properties[index].key, name) == 0) {
				return index;
			}
		}

		return propertyCount;
	}

	char *ObjectValue::copyKey(const char *name) {
		const auto length = std::strlen(name);
		auto *key = static_cast<char *>(MemoryManager::allocate(length + 1, "object property key"));
		std::memcpy(key, name, length + 1);
		return key;
	}

	void ObjectValue::destroy() {
		OwnershipTracker::assertLiveAggregate(this, "object destroy/drop after destroy/drop", "object value");

		for (std::size_t index = 0; index < propertyCount; ++index) {
			MemoryManager::deallocate(properties[index].key);
			properties[index].key = nullptr;
			properties[index].value = nullptr;
		}

		MemoryManager::deallocate(properties);
		properties = nullptr;
		propertyCount = 0;
		propertyCapacity = 0;
	}

	ArrayValue *ArrayValue::create(std::size_t length) {
		void *address = MemoryManager::allocate(sizeof(ArrayValue), "array value");
		init(address, length);
		OwnershipTracker::markHeapAggregate(address, "array value");
		return static_cast<ArrayValue *>(address);
	}

	void ArrayValue::init(void *address, std::size_t length) {
		auto *array = new (address) ArrayValue();
		OwnershipTracker::registerStackAggregate(array, "array value");
		array->elementCount = length;
		array->elementCapacity = length;

		if (length == 0) {
			return;
		}

		array->elements = static_cast<void **>(
			MemoryManager::allocate(sizeof(void *) * length, "array elements")
		);

		for (std::size_t index = 0; index < length; ++index) {
			array->elements[index] = AnyValue::undefined();
		}
	}

	std::size_t ArrayValue::size() {
		return sizeof(ArrayValue);
	}

	void ArrayValue::set(std::size_t index, void *value) {
		OwnershipTracker::assertLiveAggregate(this, "array set after destroy/drop", "array value");

		if (index >= elementCount) {
			return;
		}

		elements[index] = value ? value : AnyValue::undefined();
	}

	void *ArrayValue::get(std::size_t index) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array get after destroy/drop", "array value");

		if (index >= elementCount) {
			return AnyValue::undefined();
		}

		return elements[index] ? elements[index] : AnyValue::undefined();
	}

	std::size_t ArrayValue::push(void *value) {
		OwnershipTracker::assertLiveAggregate(this, "array push after destroy/drop", "array value");

		ensureCapacity(elementCount + 1);
		elements[elementCount] = value ? value : AnyValue::undefined();
		++elementCount;

		return elementCount;
	}

	void *ArrayValue::pop() {
		OwnershipTracker::assertLiveAggregate(this, "array pop after destroy/drop", "array value");

		if (elementCount == 0) {
			return AnyValue::undefined();
		}

		--elementCount;
		auto *result = elements[elementCount];
		elements[elementCount] = AnyValue::undefined();

		return result ? result : AnyValue::undefined();
	}

	void *ArrayValue::at(std::size_t index) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array at after destroy/drop", "array value");

		if (index >= elementCount) {
			return AnyValue::undefined();
		}

		return elements[index] ? elements[index] : AnyValue::undefined();
	}

	void *ArrayValue::at(double index) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array at after destroy/drop", "array value");

		if (elementCount == 0) {
			return AnyValue::undefined();
		}

		const auto integer = toInteger(index);

		if (std::isinf(integer)) {
			return AnyValue::undefined();
		}

		const auto normalized = integer < 0
			? static_cast<double>(elementCount) + integer
			: integer;

		if (normalized < 0 || normalized >= static_cast<double>(elementCount)) {
			return AnyValue::undefined();
		}

		return at(static_cast<std::size_t>(normalized));
	}

	std::size_t ArrayValue::length() const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array length after destroy/drop", "array value");

		return elementCount;
	}

	void *ArrayValue::shift() {
		OwnershipTracker::assertLiveAggregate(this, "array shift after destroy/drop", "array value");

		if (elementCount == 0) {
			return AnyValue::undefined();
		}

		auto *result = elements[0];

		for (std::size_t index = 1; index < elementCount; ++index) {
			elements[index - 1] = elements[index];
		}

		--elementCount;
		elements[elementCount] = AnyValue::undefined();

		return result ? result : AnyValue::undefined();
	}

	std::size_t ArrayValue::unshift(void *value) {
		OwnershipTracker::assertLiveAggregate(this, "array unshift after destroy/drop", "array value");

		ensureCapacity(elementCount + 1);

		for (std::size_t index = elementCount; index > 0; --index) {
			elements[index] = elements[index - 1];
		}

		elements[0] = value ? value : AnyValue::undefined();
		++elementCount;

		return elementCount;
	}

	bool ArrayValue::includes(void *value, double fromIndex) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array includes after destroy/drop", "array value");

		for (std::size_t index = normalizeForwardStart(fromIndex, elementCount); index < elementCount; ++index) {
			if (strictEquals(elements[index], value, true)) {
				return true;
			}
		}

		return false;
	}

	long long ArrayValue::indexOf(void *value, double fromIndex) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array indexOf after destroy/drop", "array value");

		for (std::size_t index = normalizeForwardStart(fromIndex, elementCount); index < elementCount; ++index) {
			if (strictEquals(elements[index], value, false)) {
				return static_cast<long long>(index);
			}
		}

		return -1;
	}

	long long ArrayValue::lastIndexOf(void *value, double fromIndex) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array lastIndexOf after destroy/drop", "array value");

		for (auto index = normalizeLastStart(fromIndex, elementCount); index >= 0; --index) {
			if (strictEquals(elements[static_cast<std::size_t>(index)], value, false)) {
				return index;
			}
		}

		return -1;
	}

	void ArrayValue::reverse() {
		OwnershipTracker::assertLiveAggregate(this, "array reverse after destroy/drop", "array value");

		for (std::size_t left = 0, right = elementCount; left < right && left < --right; ++left) {
			std::swap(elements[left], elements[right]);
		}
	}

	ArrayValue *ArrayValue::slice(double start, double end) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array slice after destroy/drop", "array value");

		const auto from = normalizeSliceBound(start, elementCount, false);
		const auto to = normalizeSliceBound(end, elementCount, true);
		const auto count = to > from ? to - from : 0;
		auto *result = ArrayValue::create(count);

		for (std::size_t index = 0; index < count; ++index) {
			result->elements[index] = elements[from + index] ? elements[from + index] : AnyValue::undefined();
		}

		return result;
	}

	void ArrayValue::ensureCapacity(std::size_t requiredCapacity) {
		if (requiredCapacity <= elementCapacity) {
			return;
		}

		auto nextCapacity = elementCapacity == 0 ? 4 : elementCapacity * 2;
		while (nextCapacity < requiredCapacity) {
			nextCapacity *= 2;
		}

		elements = static_cast<void **>(
			MemoryManager::reallocate(elements, sizeof(void *) * nextCapacity, "array elements")
		);

		for (std::size_t index = elementCapacity; index < nextCapacity; ++index) {
			elements[index] = AnyValue::undefined();
		}

		elementCapacity = nextCapacity;
	}

	void ArrayValue::destroy() {
		OwnershipTracker::assertLiveAggregate(this, "array destroy/drop after destroy/drop", "array value");

		MemoryManager::deallocate(elements);
		elements = nullptr;
		elementCount = 0;
		elementCapacity = 0;
	}

} // namespace yogi::runtime

extern "C" {

void *yogi_object_create(void) {
	return yogi::runtime::ObjectValue::create();
}

unsigned long long yogi_object_sizeof(void) {
	return static_cast<unsigned long long>(yogi::runtime::ObjectValue::size());
}

void yogi_object_init(void *object) {
	if (!object) {
		return;
	}

	yogi::runtime::ObjectValue::init(object);
}

void yogi_object_set(void *object, const char *name, void *value) {
	if (!object) {
		return;
	}

	static_cast<yogi::runtime::ObjectValue *>(object)->set(name, value);
}

void *yogi_object_get(void *object, const char *name) {
	if (!object) {
		return yogi_any_undefined();
	}

	return static_cast<const yogi::runtime::ObjectValue *>(object)->get(name);
}

void yogi_object_drop(void *object) {
	if (!object) {
		return;
	}

	static_cast<yogi::runtime::ObjectValue *>(object)->destroy();
	yogi::runtime::OwnershipTracker::dropStackAggregate(object, "object value");
}

void yogi_object_destroy(void *object) {
	if (!object) {
		return;
	}

	auto *value = static_cast<yogi::runtime::ObjectValue *>(object);
	value->destroy();
	yogi::runtime::OwnershipTracker::destroyHeapAggregate(object, "object value");
	yogi_free(object);
}

void *yogi_array_create(unsigned long long length) {
	return yogi::runtime::ArrayValue::create(static_cast<std::size_t>(length));
}

unsigned long long yogi_array_sizeof(void) {
	return static_cast<unsigned long long>(yogi::runtime::ArrayValue::size());
}

void yogi_array_init(void *array, unsigned long long length) {
	if (!array) {
		return;
	}

	yogi::runtime::ArrayValue::init(array, static_cast<std::size_t>(length));
}

void yogi_array_set(void *array, unsigned long long index, void *value) {
	if (!array) {
		return;
	}

	static_cast<yogi::runtime::ArrayValue *>(array)->set(static_cast<std::size_t>(index), value);
}

void *yogi_array_get(void *array, unsigned long long index) {
	if (!array) {
		return yogi_any_undefined();
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->get(static_cast<std::size_t>(index));
}

unsigned long long yogi_array_push(void *array, void *value) {
	if (!array) {
		return 0;
	}

	return static_cast<unsigned long long>(
		static_cast<yogi::runtime::ArrayValue *>(array)->push(value)
	);
}

void *yogi_array_pop(void *array) {
	if (!array) {
		return yogi_any_undefined();
	}

	return static_cast<yogi::runtime::ArrayValue *>(array)->pop();
}

void *yogi_array_at(void *array, unsigned long long index) {
	if (!array) {
		return yogi_any_undefined();
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->at(static_cast<std::size_t>(index));
}

void *yogi_array_at_index(void *array, double index) {
	if (!array) {
		return yogi_any_undefined();
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->at(index);
}

unsigned long long yogi_array_length(void *array) {
	if (!array) {
		return 0;
	}

	return static_cast<unsigned long long>(
		static_cast<const yogi::runtime::ArrayValue *>(array)->length()
	);
}

void *yogi_array_shift(void *array) {
	if (!array) {
		return yogi_any_undefined();
	}

	return static_cast<yogi::runtime::ArrayValue *>(array)->shift();
}

unsigned long long yogi_array_unshift(void *array, void *value) {
	if (!array) {
		return 0;
	}

	return static_cast<unsigned long long>(
		static_cast<yogi::runtime::ArrayValue *>(array)->unshift(value)
	);
}

bool yogi_array_includes(void *array, void *value, double fromIndex) {
	if (!array) {
		return false;
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->includes(value, fromIndex);
}

long long yogi_array_index_of(void *array, void *value, double fromIndex) {
	if (!array) {
		return -1;
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->indexOf(value, fromIndex);
}

long long yogi_array_last_index_of(void *array, void *value, double fromIndex) {
	if (!array) {
		return -1;
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->lastIndexOf(value, fromIndex);
}

void yogi_array_reverse(void *array) {
	if (!array) {
		return;
	}

	static_cast<yogi::runtime::ArrayValue *>(array)->reverse();
}

void *yogi_array_slice(void *array, double start, double end) {
	if (!array) {
		return yogi_array_create(0);
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->slice(start, end);
}

void yogi_array_drop(void *array) {
	if (!array) {
		return;
	}

	static_cast<yogi::runtime::ArrayValue *>(array)->destroy();
	yogi::runtime::OwnershipTracker::dropStackAggregate(array, "array value");
}

void yogi_array_destroy(void *array) {
	if (!array) {
		return;
	}

	auto *value = static_cast<yogi::runtime::ArrayValue *>(array);
	value->destroy();
	yogi::runtime::OwnershipTracker::destroyHeapAggregate(array, "array value");
	yogi_free(array);
}

}
