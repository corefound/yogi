// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime/aggregate.h"

#include "yogi/runtime/any.h"
#include "yogi/runtime/debug/ownership.h"
#include "yogi/runtime/errors.h"
#include "yogi/runtime/memory.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <limits>
#include <new>

namespace yogi::runtime {

	struct ArrayValue::ElementSlot {
		void *value = nullptr;
		std::uint64_t generation = 1;
		bool removed = false;
	};

	struct ProjectedCell {
		void *ownerPointer = nullptr;
		const char *key = nullptr;
	};

		namespace {
			constexpr auto *removedArrayElementPointerMessage =
				"pointer is used after the array element it points to was removed";
			constexpr auto rawCellPointerTag = static_cast<std::uintptr_t>(1);
			constexpr auto arrayCellPointerTag = static_cast<std::uintptr_t>(3);
			constexpr auto projectedCellPointerTag = static_cast<std::uintptr_t>(5);
			constexpr auto runtimeCellPointerMask = static_cast<std::uintptr_t>(7);

			ArrayValue::ElementSlot *arraySlotFromCell(void **cell) {
				return reinterpret_cast<ArrayValue::ElementSlot *>(cell);
			}

			void *tagRuntimePointer(void *cell, std::uintptr_t tag) {
				auto address = reinterpret_cast<std::uintptr_t>(cell);
				return reinterpret_cast<void *>(address | tag);
			}

			std::uintptr_t runtimePointerTag(void *pointer) {
				return reinterpret_cast<std::uintptr_t>(pointer) & runtimeCellPointerMask;
			}

			void *untagRuntimePointer(void *pointer) {
				auto address = reinterpret_cast<std::uintptr_t>(pointer);
				return reinterpret_cast<void *>(address & ~runtimeCellPointerMask);
			}

			void **ownerArraySlotForPointer(void *pointer) {
				switch (runtimePointerTag(pointer)) {
					case arrayCellPointerTag:
						return static_cast<void **>(untagRuntimePointer(pointer));
					default:
						return nullptr;
				}
			}

			ProjectedCell *projectedCellFromPointer(void *pointer) {
				return static_cast<ProjectedCell *>(untagRuntimePointer(pointer));
			}

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

		std::size_t normalizeDeleteCount(double value, std::size_t available) {
			const auto integer = toInteger(value);

			if (integer <= 0 || std::isnan(integer)) {
				return 0;
			}

			if (std::isinf(integer)) {
				return integer > 0 ? available : 0;
			}

			return std::min<std::size_t>(static_cast<std::size_t>(integer), available);
		}

		bool normalizeRequiredIndex(double value, std::size_t length, std::size_t &result) {
			const auto integer = toInteger(value);

			if (std::isinf(integer)) {
				return false;
			}

			const auto normalized = integer >= 0
				? integer
				: static_cast<double>(length) + integer;

			if (normalized < 0 || normalized >= static_cast<double>(length)) {
				return false;
			}

			result = static_cast<std::size_t>(normalized);
			return true;
		}

		long long rangeDiagnosticIndex(double value) {
			const auto integer = toInteger(value);

			if (std::isnan(integer)) {
				return 0;
			}

			if (std::isinf(integer)) {
				return integer > 0
					? std::numeric_limits<long long>::max()
					: std::numeric_limits<long long>::min();
			}

			return static_cast<long long>(integer);
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

				case YOGI_ANY_ARRAY:
					return leftAny->asArray() == rightAny->asArray();

				case YOGI_ANY_OBJECT:
					return leftAny->asObject() == rightAny->asObject();
			}

			return false;
		}

		std::size_t numberStringLength(double value) {
			char buffer[64];
			return static_cast<std::size_t>(std::snprintf(buffer, sizeof(buffer), "%.15g", value));
		}

		std::size_t anyStringLength(void *value, bool emptyForNullish);
		char *appendAnyString(char *target, void *value, bool emptyForNullish);

		std::size_t arrayStringLength(const ArrayValue *array) {
			if (!array) {
				return 0;
			}

			const auto length = array->length();
			std::size_t total = length > 0 ? length - 1 : 0;

			for (std::size_t index = 0; index < length; ++index) {
				total += anyStringLength(array->get(index), true);
			}

			return total;
		}

		std::size_t anyStringLength(void *value, bool emptyForNullish) {
			if (!value) {
				return emptyForNullish ? 0 : 4;
			}

			const auto *any = AnyValue::require(value, "any");

			switch (any->tag()) {
				case YOGI_ANY_UNDEFINED:
					return emptyForNullish ? 0 : 9;

				case YOGI_ANY_NULL:
					return emptyForNullish ? 0 : 4;

				case YOGI_ANY_NUMBER:
					return numberStringLength(any->asNumber());

				case YOGI_ANY_BOOLEAN:
					return any->asBoolean() ? 4 : 5;

				case YOGI_ANY_STRING:
					return std::strlen(any->asString() ? any->asString() : "");

				case YOGI_ANY_ARRAY:
					return arrayStringLength(static_cast<const ArrayValue *>(any->asArray()));

				case YOGI_ANY_OBJECT:
					return 15;
			}

			return 0;
		}

		char *appendText(char *target, const char *value) {
			const auto length = std::strlen(value ? value : "");
			std::memcpy(target, value ? value : "", length);
			return target + length;
		}

		char *appendAnyString(char *target, void *value, bool emptyForNullish) {
			if (!value) {
				return emptyForNullish ? target : appendText(target, "null");
			}

			const auto *any = AnyValue::require(value, "any");

			switch (any->tag()) {
				case YOGI_ANY_UNDEFINED:
					return emptyForNullish ? target : appendText(target, "undefined");

				case YOGI_ANY_NULL:
					return emptyForNullish ? target : appendText(target, "null");

				case YOGI_ANY_NUMBER: {
					char buffer[64];
					std::snprintf(buffer, sizeof(buffer), "%.15g", any->asNumber());
					return appendText(target, buffer);
				}

				case YOGI_ANY_BOOLEAN:
					return appendText(target, any->asBoolean() ? "true" : "false");

				case YOGI_ANY_STRING:
					return appendText(target, any->asString() ? any->asString() : "");

				case YOGI_ANY_ARRAY: {
					const auto *array = static_cast<const ArrayValue *>(any->asArray());
					if (!array) {
						return target;
					}

					const auto length = array->length();
					for (std::size_t index = 0; index < length; ++index) {
						if (index > 0) {
							target = appendText(target, ",");
						}

						target = appendAnyString(target, array->get(index), true);
					}

					return target;
				}

				case YOGI_ANY_OBJECT:
					return appendText(target, "[object Object]");
			}

			return target;
		}

		int compareAnyAsString(void *left, void *right) {
			const auto leftLength = anyStringLength(left, false);
			const auto rightLength = anyStringLength(right, false);
			auto *leftText = static_cast<char *>(MemoryManager::allocate(leftLength + 1, "sort compare string"));
			auto *rightText = static_cast<char *>(MemoryManager::allocate(rightLength + 1, "sort compare string"));
			*appendAnyString(leftText, left, false) = '\0';
			*appendAnyString(rightText, right, false) = '\0';
			const auto result = std::strcmp(leftText, rightText);
			MemoryManager::deallocate(leftText);
			MemoryManager::deallocate(rightText);
			return result;
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
		properties[propertyCount].value = value ? value : AnyValue::undefined();
		properties[propertyCount].key = copyKey(name);
		properties[propertyCount].ownerArraySlot = nullptr;
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

	void **ObjectValue::cell(const char *name) {
		return cell(name, nullptr);
	}

	void **ObjectValue::cell(const char *name, void **ownerArraySlot) {
		OwnershipTracker::assertLiveAggregate(this, "object cell after destroy/drop", "object value");

		if (!name) {
			return nullptr;
		}

		const auto index = find(name);
		if (index < propertyCount) {
			if (!properties[index].value) {
				properties[index].value = AnyValue::undefined();
			}
			if (ownerArraySlot) {
				properties[index].ownerArraySlot = ownerArraySlot;
			}

			return &properties[index].value;
		}

		ensureCapacity();
		properties[propertyCount].value = AnyValue::undefined();
		properties[propertyCount].key = copyKey(name);
		properties[propertyCount].ownerArraySlot = ownerArraySlot;
		++propertyCount;

		return &properties[propertyCount - 1].value;
	}

	std::size_t ObjectValue::length() const {
		OwnershipTracker::assertLiveAggregate(const_cast<ObjectValue *>(this), "object length after destroy/drop", "object value");
		return propertyCount;
	}

	const char *ObjectValue::keyAt(std::size_t index) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ObjectValue *>(this), "object key read after destroy/drop", "object value");

		if (index >= propertyCount) {
			return "";
		}

		return properties[index].key ? properties[index].key : "";
	}

	void *ObjectValue::valueAt(std::size_t index) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ObjectValue *>(this), "object value read after destroy/drop", "object value");

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
			properties[index].ownerArraySlot = nullptr;
		}

		MemoryManager::deallocate(properties);
		properties = nullptr;
		propertyCount = 0;
		propertyCapacity = 0;
	}

	ArrayValue *ArrayValue::create(std::size_t length, StorageMode storageMode) {
		void *address = MemoryManager::allocate(sizeof(ArrayValue), "array value");
		init(address, length, storageMode);
		OwnershipTracker::markHeapAggregate(address, "array value");
		return static_cast<ArrayValue *>(address);
	}

	ArrayValue *ArrayValue::createView(ArrayValue *source, std::size_t offset, std::size_t length) {
		if (!source) {
			return create(0);
		}

		OwnershipTracker::assertLiveAggregate(source, "array view source after destroy/drop", "array value");

		auto *owner = source->isView() ? source->viewSource : source;
		const auto baseOffset = (source->isView() ? source->viewOffset : 0) + offset;
		const auto sourceLength = source->length();

		if (offset > sourceLength || length > sourceLength - offset) {
			RuntimeError::abortRange("array view", static_cast<long long>(offset + length), sourceLength);
		}

		void *address = MemoryManager::allocate(sizeof(ArrayValue), "array view");
		auto *view = new (address) ArrayValue();
		view->viewSource = owner;
		view->viewOffset = baseOffset;
		view->elementCount = length;
		view->elementCapacity = length;
		OwnershipTracker::markHeapAggregate(address, "array value");

		return view;
	}

	void ArrayValue::init(void *address, std::size_t length, StorageMode storageMode) {
		auto *array = new (address) ArrayValue();
		OwnershipTracker::registerStackAggregate(array, "array value");
		array->storageMode = storageMode;
		array->elementCount = length;
		array->elementCapacity = length;

		if (length == 0) {
			return;
		}

		array->elements = static_cast<void ***>(
			MemoryManager::allocate(sizeof(void **) * length, "array elements")
		);

		if (array->usesPointerSafeStorage()) {
			for (std::size_t index = 0; index < length; ++index) {
				array->elements[index] = createSlot(AnyValue::undefined());
			}
			return;
		}

		array->contiguousValues = static_cast<void **>(
			MemoryManager::allocate(sizeof(void *) * length, "array contiguous elements")
		);

		for (std::size_t index = 0; index < length; ++index) {
			array->contiguousValues[index] = AnyValue::undefined();
		}

		array->resetContiguousSlots();
	}

	ArrayValue::StorageMode ArrayValue::storageModeFromName(const char *name) {
		if (name && std::strcmp(name, "pointer_safe_chunked_mode") == 0) {
			return StorageMode::PointerSafeChunkedMode;
		}

		return StorageMode::ContiguousFastPath;
	}

	std::size_t ArrayValue::size() {
		return sizeof(ArrayValue);
	}

	bool ArrayValue::isView() const {
		return viewSource != nullptr;
	}

	bool ArrayValue::usesPointerSafeStorage() const {
		return storageMode == StorageMode::PointerSafeChunkedMode;
	}

	void ArrayValue::resetContiguousSlots(std::size_t start) {
		if (usesPointerSafeStorage() || !elements || !contiguousValues) {
			return;
		}

		for (std::size_t index = start; index < elementCapacity; ++index) {
			elements[index] = &contiguousValues[index];
		}
	}

	void **ArrayValue::createSlot(void *value) {
		auto *slot = static_cast<ElementSlot *>(MemoryManager::allocate(sizeof(ElementSlot), "array element slot"));
		new (slot) ElementSlot();
		slot->value = value ? value : AnyValue::undefined();
		return &slot->value;
	}

	void *ArrayValue::slotValue(std::size_t index) const {
		auto **slot = elements[index];
		if (usesPointerSafeStorage()) {
			return cellGet(slot);
		}

		return slot && *slot ? *slot : AnyValue::undefined();
	}

	void ArrayValue::setSlotValue(std::size_t index, void *value) {
		if (!elements[index]) {
			elements[index] = usesPointerSafeStorage()
				? createSlot(value)
				: &contiguousValues[index];
			if (!usesPointerSafeStorage()) {
				contiguousValues[index] = value ? value : AnyValue::undefined();
				return;
			}
			return;
		}

		if (!usesPointerSafeStorage() && contiguousValues) {
			contiguousValues[index] = value ? value : AnyValue::undefined();
			elements[index] = &contiguousValues[index];
			return;
		}

		cellSet(elements[index], value);
	}

	void *ArrayValue::cellGet(void *cell) {
		if (!cell) {
			return AnyValue::undefined();
		}

		auto *slot = arraySlotFromCell(static_cast<void **>(cell));
		if (slot->removed) {
			RuntimeError::abortInvalidPointer(removedArrayElementPointerMessage);
		}

		return slot->value ? slot->value : AnyValue::undefined();
	}

	void ArrayValue::cellSet(void *cell, void *value) {
		if (!cell) {
			return;
		}

		auto *slot = arraySlotFromCell(static_cast<void **>(cell));
		if (slot->removed) {
			RuntimeError::abortInvalidPointer(removedArrayElementPointerMessage);
		}

		slot->value = value ? value : AnyValue::undefined();
	}

	void ArrayValue::invalidateSlot(std::size_t index) {
		auto **slot = elements[index];
		if (!slot) {
			return;
		}

		if (!usesPointerSafeStorage()) {
			*slot = AnyValue::undefined();
			elements[index] = contiguousValues ? &contiguousValues[index] : nullptr;
			return;
		}

		auto *elementSlot = arraySlotFromCell(slot);
		elementSlot->value = AnyValue::undefined();
		elementSlot->removed = true;
		++elementSlot->generation;
		retireSlot(slot);
		elements[index] = nullptr;
	}

	void ArrayValue::retireSlot(void **slot) {
		if (!slot) {
			return;
		}

		if (retiredElementCount >= retiredElementCapacity) {
			const auto nextCapacity = retiredElementCapacity == 0 ? 4 : retiredElementCapacity * 2;
			retiredElements = static_cast<void ***>(
				MemoryManager::reallocate(retiredElements, sizeof(void **) * nextCapacity, "array retired element slots")
			);
			retiredElementCapacity = nextCapacity;
		}

		retiredElements[retiredElementCount++] = slot;
	}

	void ArrayValue::releaseCell(void **slot) {
		if (!slot) {
			return;
		}

		if (usesPointerSafeStorage()) {
			auto *elementSlot = arraySlotFromCell(slot);
			elementSlot->~ElementSlot();
			MemoryManager::deallocate(elementSlot);
			return;
		}

		*slot = AnyValue::undefined();
	}

	void ArrayValue::releaseSlot(std::size_t index) {
		auto **slot = elements[index];
		if (!slot) {
			return;
		}

		releaseCell(slot);
		elements[index] = nullptr;
	}

	void ArrayValue::releaseRetiredSlots() {
		if (!retiredElements) {
			return;
		}

		for (std::size_t index = 0; index < retiredElementCount; ++index) {
			releaseCell(retiredElements[index]);
			retiredElements[index] = nullptr;
		}

		MemoryManager::deallocate(retiredElements);
		retiredElements = nullptr;
		retiredElementCount = 0;
		retiredElementCapacity = 0;
	}

	void *ObjectValue::cellGet(void *cell) {
		if (!cell) {
			return AnyValue::undefined();
		}

		auto *property = reinterpret_cast<Property *>(cell);
		if (property->ownerArraySlot) {
			ArrayValue::cellGet(property->ownerArraySlot);
		}

		return property->value ? property->value : AnyValue::undefined();
	}

	void ObjectValue::cellSet(void *cell, void *value) {
		if (!cell) {
			return;
		}

		auto *property = reinterpret_cast<Property *>(cell);
		if (property->ownerArraySlot) {
			ArrayValue::cellGet(property->ownerArraySlot);
		}

		property->value = value ? value : AnyValue::undefined();
	}

	void **ObjectValue::ownerArraySlotForCell(void *cell) {
		if (!cell) {
			return nullptr;
		}

		auto *property = reinterpret_cast<Property *>(cell);
		return property->ownerArraySlot;
	}

	void ArrayValue::set(std::size_t index, void *value) {
		OwnershipTracker::assertLiveAggregate(this, "array set after destroy/drop", "array value");

		if (index >= elementCount) {
			RuntimeError::abortRange("array subscript assignment", static_cast<long long>(index), elementCount);
		}

		if (isView()) {
			OwnershipTracker::assertLiveAggregate(viewSource, "array view source set after destroy/drop", "array value");
			viewSource->set(viewOffset + index, value);
			return;
		}

		setSlotValue(index, value);
	}

	void *ArrayValue::get(std::size_t index) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array get after destroy/drop", "array value");

		if (index >= elementCount) {
			RuntimeError::abortRange("array subscript", static_cast<long long>(index), elementCount);
		}

		if (isView()) {
			OwnershipTracker::assertLiveAggregate(viewSource, "array view source get after destroy/drop", "array value");
			return viewSource->get(viewOffset + index);
		}

		return slotValue(index);
	}

	void **ArrayValue::cell(std::size_t index) {
		OwnershipTracker::assertLiveAggregate(this, "array cell after destroy/drop", "array value");

		if (index >= elementCount) {
			RuntimeError::abortRange("array address-of", static_cast<long long>(index), elementCount);
		}

		if (isView()) {
			OwnershipTracker::assertLiveAggregate(viewSource, "array view source cell after destroy/drop", "array value");
			return viewSource->cell(viewOffset + index);
		}

		if (!elements[index]) {
			elements[index] = usesPointerSafeStorage()
				? createSlot(AnyValue::undefined())
				: &contiguousValues[index];
		}

		return elements[index];
	}

	void *ArrayValue::pointerCell(std::size_t index) {
		auto **slot = cell(index);
		return tagRuntimePointer(
			slot,
			usesPointerSafeStorage() ? arrayCellPointerTag : rawCellPointerTag
		);
	}

	std::size_t ArrayValue::push(void *value) {
		OwnershipTracker::assertLiveAggregate(this, "array push after destroy/drop", "array value");

		ensureCapacity(elementCount + 1);
		if (usesPointerSafeStorage()) {
			elements[elementCount] = createSlot(value);
		} else {
			contiguousValues[elementCount] = value ? value : AnyValue::undefined();
			elements[elementCount] = &contiguousValues[elementCount];
		}
		++elementCount;

		return elementCount;
	}

	void *ArrayValue::pop() {
		OwnershipTracker::assertLiveAggregate(this, "array pop after destroy/drop", "array value");

		if (elementCount == 0) {
			return AnyValue::undefined();
		}

		--elementCount;
		auto *result = slotValue(elementCount);
		if (usesPointerSafeStorage()) {
			invalidateSlot(elementCount);
		} else {
			contiguousValues[elementCount] = AnyValue::undefined();
		}

		return result ? result : AnyValue::undefined();
	}

	void *ArrayValue::at(std::size_t index) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array at after destroy/drop", "array value");

		if (index >= elementCount) {
			return AnyValue::undefined();
		}

		if (isView()) {
			OwnershipTracker::assertLiveAggregate(viewSource, "array view source at after destroy/drop", "array value");
			return viewSource->at(viewOffset + index);
		}

		return slotValue(index);
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

		auto *result = slotValue(0);
		auto **removedSlot = elements[0];

		if (usesPointerSafeStorage()) {
			for (std::size_t index = 1; index < elementCount; ++index) {
				elements[index - 1] = elements[index];
			}
		} else {
			for (std::size_t index = 1; index < elementCount; ++index) {
				contiguousValues[index - 1] = contiguousValues[index];
			}
		}

		--elementCount;
		if (usesPointerSafeStorage()) {
			elements[elementCount] = nullptr;
		} else {
			contiguousValues[elementCount] = AnyValue::undefined();
			resetContiguousSlots();
		}
		if (usesPointerSafeStorage() && removedSlot) {
			auto *elementSlot = arraySlotFromCell(removedSlot);
			elementSlot->value = AnyValue::undefined();
			elementSlot->removed = true;
			++elementSlot->generation;
			retireSlot(removedSlot);
		}

		return result ? result : AnyValue::undefined();
	}

	std::size_t ArrayValue::unshift(void *value) {
		OwnershipTracker::assertLiveAggregate(this, "array unshift after destroy/drop", "array value");

		ensureCapacity(elementCount + 1);

		if (usesPointerSafeStorage()) {
			for (std::size_t index = elementCount; index > 0; --index) {
				elements[index] = elements[index - 1];
			}

			elements[0] = createSlot(value);
		} else {
			for (std::size_t index = elementCount; index > 0; --index) {
				contiguousValues[index] = contiguousValues[index - 1];
			}

			contiguousValues[0] = value ? value : AnyValue::undefined();
			resetContiguousSlots();
		}
		++elementCount;

		return elementCount;
	}

	bool ArrayValue::includes(void *value, double fromIndex) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array includes after destroy/drop", "array value");

		for (std::size_t index = normalizeForwardStart(fromIndex, elementCount); index < elementCount; ++index) {
			if (strictEquals(slotValue(index), value, true)) {
				return true;
			}
		}

		return false;
	}

	long long ArrayValue::indexOf(void *value, double fromIndex) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array indexOf after destroy/drop", "array value");

		for (std::size_t index = normalizeForwardStart(fromIndex, elementCount); index < elementCount; ++index) {
			if (strictEquals(slotValue(index), value, false)) {
				return static_cast<long long>(index);
			}
		}

		return -1;
	}

	long long ArrayValue::lastIndexOf(void *value, double fromIndex) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array lastIndexOf after destroy/drop", "array value");

		for (auto index = normalizeLastStart(fromIndex, elementCount); index >= 0; --index) {
			if (strictEquals(slotValue(static_cast<std::size_t>(index)), value, false)) {
				return index;
			}
		}

		return -1;
	}

	void ArrayValue::reverse() {
		OwnershipTracker::assertLiveAggregate(this, "array reverse after destroy/drop", "array value");

		for (std::size_t left = 0, right = elementCount; left < right && left < --right; ++left) {
			if (usesPointerSafeStorage()) {
				std::swap(elements[left], elements[right]);
			} else {
				std::swap(contiguousValues[left], contiguousValues[right]);
			}
		}
	}

	ArrayValue *ArrayValue::clone() const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array clone after destroy/drop", "array value");

		auto *result = ArrayValue::create(elementCount);

		for (std::size_t index = 0; index < elementCount; ++index) {
			auto *value = isView()
				? get(index)
				: slotValue(index);
			result->setSlotValue(index, value);
		}

		return result;
	}

	void ArrayValue::appendArray(const ArrayValue *source) {
		OwnershipTracker::assertLiveAggregate(this, "array append after destroy/drop", "array value");

		if (!source) {
			return;
		}

		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(source), "array append source after destroy/drop", "array value");

		for (std::size_t index = 0; index < source->elementCount; ++index) {
			push(source->get(index));
		}
	}

	void ArrayValue::insert(std::size_t index, void *value) {
		OwnershipTracker::assertLiveAggregate(this, "array insert after destroy/drop", "array value");

		const auto target = std::min<std::size_t>(index, elementCount);
		ensureCapacity(elementCount + 1);

		if (usesPointerSafeStorage()) {
			for (std::size_t position = elementCount; position > target; --position) {
				elements[position] = elements[position - 1];
			}

			elements[target] = createSlot(value);
		} else {
			for (std::size_t position = elementCount; position > target; --position) {
				contiguousValues[position] = contiguousValues[position - 1];
			}

			contiguousValues[target] = value ? value : AnyValue::undefined();
			resetContiguousSlots();
		}
		++elementCount;
	}

	void ArrayValue::fill(void *value, double start, double end) {
		OwnershipTracker::assertLiveAggregate(this, "array fill after destroy/drop", "array value");

		const auto from = normalizeSliceBound(start, elementCount, false);
		const auto to = normalizeSliceBound(end, elementCount, true);

		for (std::size_t index = from; index < to; ++index) {
			setSlotValue(index, value);
		}
	}

	void ArrayValue::copyWithin(double target, double start, double end) {
		OwnershipTracker::assertLiveAggregate(this, "array copyWithin after destroy/drop", "array value");

		const auto to = normalizeSliceBound(target, elementCount, false);
		const auto from = normalizeSliceBound(start, elementCount, false);
		const auto final = normalizeSliceBound(end, elementCount, true);

		if (from >= final || to >= elementCount) {
			return;
		}

		const auto count = std::min<std::size_t>(final - from, elementCount - to);
		if (count == 0) {
			return;
		}

		auto **buffer = static_cast<void **>(MemoryManager::allocate(sizeof(void *) * count, "array copyWithin buffer"));
		for (std::size_t index = 0; index < count; ++index) {
			buffer[index] = slotValue(from + index);
		}

		for (std::size_t index = 0; index < count; ++index) {
			setSlotValue(to + index, buffer[index]);
		}

		MemoryManager::deallocate(buffer);
	}

	void ArrayValue::swapSlots(std::size_t left, std::size_t right) {
		OwnershipTracker::assertLiveAggregate(this, "array swap after destroy/drop", "array value");

		if (left >= elementCount || right >= elementCount) {
			RuntimeError::abortRange("array swap", static_cast<long long>(std::max(left, right)), elementCount);
		}

		if (left == right) {
			return;
		}

		if (usesPointerSafeStorage()) {
			std::swap(elements[left], elements[right]);
			return;
		}

		std::swap(contiguousValues[left], contiguousValues[right]);
		resetContiguousSlots();
	}

	ArrayValue *ArrayValue::splice(double start, double deleteCount, const ArrayValue *inserted) {
		OwnershipTracker::assertLiveAggregate(this, "array splice after destroy/drop", "array value");

		if (inserted) {
			OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(inserted), "array splice inserted after destroy/drop", "array value");
		}

		const auto startIndex = normalizeForwardStart(start, elementCount);
		const auto removedCount = normalizeDeleteCount(deleteCount, elementCount - startIndex);
		const auto insertedCount = inserted ? inserted->elementCount : 0;
		auto *removed = ArrayValue::create(removedCount);

		for (std::size_t index = 0; index < removedCount; ++index) {
			removed->setSlotValue(index, slotValue(startIndex + index));
			if (usesPointerSafeStorage()) {
				invalidateSlot(startIndex + index);
			}
		}

		const auto tailStart = startIndex + removedCount;
		const auto tailCount = elementCount - tailStart;
		const auto newCount = elementCount - removedCount + insertedCount;
		ensureCapacity(newCount);

		if (usesPointerSafeStorage()) {
			if (insertedCount > removedCount) {
				for (std::size_t offset = tailCount; offset > 0; --offset) {
					elements[startIndex + insertedCount + offset - 1] = elements[tailStart + offset - 1];
				}
			} else if (insertedCount < removedCount) {
				for (std::size_t offset = 0; offset < tailCount; ++offset) {
					elements[startIndex + insertedCount + offset] = elements[tailStart + offset];
				}
			}

			for (std::size_t index = 0; index < insertedCount; ++index) {
				elements[startIndex + index] = createSlot(inserted->get(index));
			}

			for (std::size_t index = newCount; index < elementCount; ++index) {
				elements[index] = nullptr;
			}
		} else {
			if (insertedCount > removedCount) {
				for (std::size_t offset = tailCount; offset > 0; --offset) {
					contiguousValues[startIndex + insertedCount + offset - 1] = contiguousValues[tailStart + offset - 1];
				}
			} else if (insertedCount < removedCount) {
				for (std::size_t offset = 0; offset < tailCount; ++offset) {
					contiguousValues[startIndex + insertedCount + offset] = contiguousValues[tailStart + offset];
				}
			}

			for (std::size_t index = 0; index < insertedCount; ++index) {
				contiguousValues[startIndex + index] = inserted->get(index);
			}

			for (std::size_t index = newCount; index < elementCount; ++index) {
				contiguousValues[index] = AnyValue::undefined();
			}

			resetContiguousSlots();
		}

		elementCount = newCount;

		return removed;
	}

	ArrayValue *ArrayValue::toReversed() const {
		auto *result = clone();
		result->reverse();
		return result;
	}

	ArrayValue *ArrayValue::toSpliced(double start, double deleteCount, const ArrayValue *inserted) const {
		auto *result = clone();
		auto *removed = result->splice(start, deleteCount, inserted);
		removed->destroy();
		OwnershipTracker::destroyHeapAggregate(removed, "array value");
		yogi_free(removed);
		return result;
	}

	ArrayValue *ArrayValue::with(double index, void *value) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array with after destroy/drop", "array value");

		std::size_t target = 0;
		if (!normalizeRequiredIndex(index, elementCount, target)) {
			RuntimeError::abortRange("array.with", rangeDiagnosticIndex(index), elementCount);
		}

		auto *result = clone();
		result->setSlotValue(target, value);
		return result;
	}

	ArrayValue *ArrayValue::slice(double start, double end) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array slice after destroy/drop", "array value");

		const auto from = normalizeSliceBound(start, elementCount, false);
		const auto to = normalizeSliceBound(end, elementCount, true);
		const auto count = to > from ? to - from : 0;
		auto *result = ArrayValue::create(count);

		for (std::size_t index = 0; index < count; ++index) {
			result->setSlotValue(index, get(from + index));
		}

		return result;
	}

	ArrayValue *ArrayValue::flat(std::size_t depth) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array flat after destroy/drop", "array value");

		auto *result = ArrayValue::create(0);

		for (std::size_t index = 0; index < elementCount; ++index) {
			auto *value = get(index);
			const auto *any = value ? AnyValue::require(value, "any") : nullptr;
			if (depth > 0 && any && any->tag() == YOGI_ANY_ARRAY) {
				auto *child = static_cast<const ArrayValue *>(any->asArray());
				auto *flattened = child ? child->flat(depth - 1) : ArrayValue::create(0);
				result->appendArray(flattened);
				flattened->destroy();
				OwnershipTracker::destroyHeapAggregate(flattened, "array value");
				yogi_free(flattened);
				continue;
			}

			result->push(value);
		}

		return result;
	}

	ArrayValue *ArrayValue::keys() const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array keys after destroy/drop", "array value");

		auto *result = ArrayValue::create(elementCount);
		for (std::size_t index = 0; index < elementCount; ++index) {
			result->setSlotValue(index, AnyValue::fromNumber(static_cast<double>(index)));
		}

		return result;
	}

	ArrayValue *ArrayValue::values() const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array values after destroy/drop", "array value");
		return clone();
	}

	ArrayValue *ArrayValue::entries() const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array entries after destroy/drop", "array value");

		auto *result = ArrayValue::create(elementCount);
		for (std::size_t index = 0; index < elementCount; ++index) {
			auto *entry = ArrayValue::create(2);
			entry->setSlotValue(0, AnyValue::fromNumber(static_cast<double>(index)));
			entry->setSlotValue(1, get(index));
			result->setSlotValue(index, AnyValue::fromArray(entry));
		}

		return result;
	}

	const char *ArrayValue::join(const char *separator) const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array join after destroy/drop", "array value");

		const auto *delimiter = separator ? separator : ",";
		const auto delimiterLength = std::strlen(delimiter);
		std::size_t totalLength = elementCount > 0 ? delimiterLength * (elementCount - 1) : 0;

		for (std::size_t index = 0; index < elementCount; ++index) {
			totalLength += anyStringLength(get(index), true);
		}

		auto *result = static_cast<char *>(MemoryManager::allocate(totalLength + 1, "runtime string"));
		auto *cursor = result;

		for (std::size_t index = 0; index < elementCount; ++index) {
			if (index > 0) {
				std::memcpy(cursor, delimiter, delimiterLength);
				cursor += delimiterLength;
			}

			cursor = appendAnyString(cursor, get(index), true);
		}

		*cursor = '\0';
		return result;
	}

	const char *ArrayValue::toString() const {
		return join(",");
	}

	const char *ArrayValue::storageModeName() const {
		return usesPointerSafeStorage()
			? "pointer_safe_chunked_mode"
			: "contiguous_fast_path";
	}

	void ArrayValue::sort() {
		OwnershipTracker::assertLiveAggregate(this, "array sort after destroy/drop", "array value");

		if (usesPointerSafeStorage()) {
			std::sort(elements, elements + elementCount, [](void **left, void **right) {
				auto *leftValue = left && *left ? *left : AnyValue::undefined();
				auto *rightValue = right && *right ? *right : AnyValue::undefined();
				return compareAnyAsString(leftValue, rightValue) < 0;
			});
			return;
		}

		std::sort(contiguousValues, contiguousValues + elementCount, [](void *left, void *right) {
			return compareAnyAsString(left, right) < 0;
		});
		resetContiguousSlots();
	}

	ArrayValue *ArrayValue::toSorted() const {
		OwnershipTracker::assertLiveAggregate(const_cast<ArrayValue *>(this), "array toSorted after destroy/drop", "array value");

		auto *result = clone();
		result->sort();
		return result;
	}

	void ArrayValue::ensureCapacity(std::size_t requiredCapacity) {
		if (isView()) {
			RuntimeError::abortRange("array view resize", static_cast<long long>(requiredCapacity), elementCount);
		}

		if (requiredCapacity <= elementCapacity) {
			return;
		}

		auto nextCapacity = elementCapacity == 0 ? 4 : elementCapacity * 2;
		while (nextCapacity < requiredCapacity) {
			nextCapacity *= 2;
		}

		elements = static_cast<void ***>(
			MemoryManager::reallocate(elements, sizeof(void **) * nextCapacity, "array elements")
		);

		if (!usesPointerSafeStorage()) {
			contiguousValues = static_cast<void **>(
				MemoryManager::reallocate(contiguousValues, sizeof(void *) * nextCapacity, "array contiguous elements")
			);
		}

		for (std::size_t index = elementCapacity; index < nextCapacity; ++index) {
			if (usesPointerSafeStorage()) {
				elements[index] = nullptr;
			} else {
				contiguousValues[index] = AnyValue::undefined();
			}
		}

		elementCapacity = nextCapacity;

		if (!usesPointerSafeStorage()) {
			resetContiguousSlots();
		}
	}

	void ArrayValue::destroy() {
		OwnershipTracker::assertLiveAggregate(this, "array destroy/drop after destroy/drop", "array value");

		if (!isView()) {
			if (usesPointerSafeStorage()) {
				for (std::size_t index = 0; index < elementCapacity; ++index) {
					releaseSlot(index);
				}
				releaseRetiredSlots();
			} else {
				MemoryManager::deallocate(contiguousValues);
			}

			MemoryManager::deallocate(elements);
		}

		contiguousValues = nullptr;
		elements = nullptr;
		retiredElements = nullptr;
		elementCount = 0;
		elementCapacity = 0;
		retiredElementCount = 0;
		retiredElementCapacity = 0;
		viewSource = nullptr;
		viewOffset = 0;
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

void *yogi_object_cell(void *object, const char *name) {
	if (!object) {
		return nullptr;
	}

	return static_cast<void *>(static_cast<yogi::runtime::ObjectValue *>(object)->cell(name));
}

void *yogi_object_cell_with_pointer_owner(void *object, const char *name, void *ownerPointer) {
	if (!object) {
		return nullptr;
	}

	return static_cast<void *>(
		static_cast<yogi::runtime::ObjectValue *>(object)->cell(
			name,
			yogi::runtime::ownerArraySlotForPointer(ownerPointer)
		)
	);
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

void *yogi_array_create_with_storage(unsigned long long length, const char *storageMode) {
	return yogi::runtime::ArrayValue::create(
		static_cast<std::size_t>(length),
		yogi::runtime::ArrayValue::storageModeFromName(storageMode)
	);
}

void *yogi_array_view(void *source, unsigned long long offset, unsigned long long length) {
	return yogi::runtime::ArrayValue::createView(
		static_cast<yogi::runtime::ArrayValue *>(source),
		static_cast<std::size_t>(offset),
		static_cast<std::size_t>(length)
	);
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

void yogi_array_init_with_storage(void *array, unsigned long long length, const char *storageMode) {
	if (!array) {
		return;
	}

	yogi::runtime::ArrayValue::init(
		array,
		static_cast<std::size_t>(length),
		yogi::runtime::ArrayValue::storageModeFromName(storageMode)
	);
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

void *yogi_array_cell(void *array, unsigned long long index) {
	if (!array) {
		return nullptr;
	}

	return static_cast<void *>(static_cast<yogi::runtime::ArrayValue *>(array)->cell(static_cast<std::size_t>(index)));
}

void *yogi_array_pointer_cell(void *array, unsigned long long index) {
	if (!array) {
		return nullptr;
	}

	return static_cast<yogi::runtime::ArrayValue *>(array)->pointerCell(static_cast<std::size_t>(index));
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

void *yogi_array_clone(void *array) {
	if (!array) {
		return yogi_array_create(0);
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->clone();
}

void yogi_array_append_array(void *array, void *source) {
	if (!array || !source) {
		return;
	}

	static_cast<yogi::runtime::ArrayValue *>(array)->appendArray(
		static_cast<const yogi::runtime::ArrayValue *>(source)
	);
}

void yogi_array_insert(void *array, unsigned long long index, void *value) {
	if (!array) {
		return;
	}

	static_cast<yogi::runtime::ArrayValue *>(array)->insert(static_cast<std::size_t>(index), value);
}

void yogi_array_fill(void *array, void *value, double start, double end) {
	if (!array) {
		return;
	}

	static_cast<yogi::runtime::ArrayValue *>(array)->fill(value, start, end);
}

void yogi_array_copy_within(void *array, double target, double start, double end) {
	if (!array) {
		return;
	}

	static_cast<yogi::runtime::ArrayValue *>(array)->copyWithin(target, start, end);
}

void *yogi_array_splice(void *array, double start, double deleteCount, void *inserted) {
	if (!array) {
		return yogi_array_create(0);
	}

	return static_cast<yogi::runtime::ArrayValue *>(array)->splice(
		start,
		deleteCount,
		static_cast<const yogi::runtime::ArrayValue *>(inserted)
	);
}

void yogi_array_swap_slots(void *array, unsigned long long left, unsigned long long right) {
	if (!array) {
		return;
	}

	static_cast<yogi::runtime::ArrayValue *>(array)->swapSlots(
		static_cast<std::size_t>(left),
		static_cast<std::size_t>(right)
	);
}

void *yogi_array_to_reversed(void *array) {
	if (!array) {
		return yogi_array_create(0);
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->toReversed();
}

void *yogi_array_to_spliced(void *array, double start, double deleteCount, void *inserted) {
	if (!array) {
		return yogi_array_create(0);
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->toSpliced(
		start,
		deleteCount,
		static_cast<const yogi::runtime::ArrayValue *>(inserted)
	);
}

void *yogi_array_with(void *array, double index, void *value) {
	if (!array) {
		yogi::runtime::RuntimeError::abortRange("array.with", 0, 0);
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->with(index, value);
}

void *yogi_array_slice(void *array, double start, double end) {
	if (!array) {
		return yogi_array_create(0);
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->slice(start, end);
}

void *yogi_array_flat(void *array, unsigned long long depth) {
	if (!array) {
		return yogi_array_create(0);
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->flat(static_cast<std::size_t>(depth));
}

void *yogi_array_keys(void *array) {
	if (!array) {
		return yogi_array_create(0);
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->keys();
}

void *yogi_array_values(void *array) {
	if (!array) {
		return yogi_array_create(0);
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->values();
}

void *yogi_array_entries(void *array) {
	if (!array) {
		return yogi_array_create(0);
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->entries();
}

const char *yogi_array_join(void *array, const char *separator) {
	if (!array) {
		return "";
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->join(separator);
}

const char *yogi_array_to_string(void *array) {
	if (!array) {
		return "";
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->toString();
}

void yogi_array_sort(void *array) {
	if (!array) {
		return;
	}

	static_cast<yogi::runtime::ArrayValue *>(array)->sort();
}

void *yogi_array_to_sorted(void *array) {
	if (!array) {
		return nullptr;
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->toSorted();
}

const char *yogi_array_storage_mode(void *array) {
	if (!array) {
		return "contiguous_fast_path";
	}

	return static_cast<const yogi::runtime::ArrayValue *>(array)->storageModeName();
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

void *yogi_cell_get(void *cell) {
	if (!cell) {
		return yogi_any_undefined();
	}

	auto **slot = static_cast<void **>(cell);
	return *slot ? *slot : yogi_any_undefined();
}

void yogi_cell_set(void *cell, void *value) {
	if (!cell) {
		return;
	}

	auto **slot = static_cast<void **>(cell);
	*slot = value ? value : yogi_any_undefined();
}

void *yogi_project_cell(void *ownerPointer, const char *key) {
	if (!ownerPointer || !key) {
		return nullptr;
	}

	auto *projected = static_cast<yogi::runtime::ProjectedCell *>(
		yogi::runtime::MemoryManager::allocate(sizeof(yogi::runtime::ProjectedCell), "projected pointer cell")
	);
	projected->ownerPointer = ownerPointer;
	projected->key = key;
	return yogi::runtime::tagRuntimePointer(projected, yogi::runtime::projectedCellPointerTag);
}

void *yogi_pointer_cell_get(void *pointer) {
	if (!pointer) {
		return yogi_any_undefined();
	}

	auto *cell = yogi::runtime::untagRuntimePointer(pointer);
	switch (yogi::runtime::runtimePointerTag(pointer)) {
		case yogi::runtime::arrayCellPointerTag:
			return yogi::runtime::ArrayValue::cellGet(cell);
		case yogi::runtime::projectedCellPointerTag: {
			auto *projected = yogi::runtime::projectedCellFromPointer(pointer);
			auto *ownerValue = yogi_pointer_cell_get(projected->ownerPointer);
			auto *object = static_cast<yogi::runtime::ObjectValue *>(
				yogi::runtime::AnyValue::require(ownerValue, "object")->asObject()
			);
			return yogi_cell_get(object->cell(projected->key));
		}
		case yogi::runtime::rawCellPointerTag:
		default:
			return yogi_cell_get(cell);
	}
}

void yogi_pointer_cell_set(void *pointer, void *value) {
	if (!pointer) {
		return;
	}

	auto *cell = yogi::runtime::untagRuntimePointer(pointer);
	switch (yogi::runtime::runtimePointerTag(pointer)) {
		case yogi::runtime::arrayCellPointerTag:
			yogi::runtime::ArrayValue::cellSet(cell, value);
			return;
		case yogi::runtime::projectedCellPointerTag: {
			auto *projected = yogi::runtime::projectedCellFromPointer(pointer);
			auto *ownerValue = yogi_pointer_cell_get(projected->ownerPointer);
			auto *object = static_cast<yogi::runtime::ObjectValue *>(
				yogi::runtime::AnyValue::require(ownerValue, "object")->asObject()
			);
			yogi_cell_set(object->cell(projected->key), value);
			return;
		}
		case yogi::runtime::rawCellPointerTag:
		default:
			yogi_cell_set(cell, value);
			return;
	}
}

}
