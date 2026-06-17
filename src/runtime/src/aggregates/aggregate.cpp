// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/aggregate.h"

#include "yogi/runtime/any.h"
#include "yogi/runtime/debug/ownership.h"
#include "yogi/runtime/memory.h"

#include <cstring>
#include <new>

namespace yogi::runtime {

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
