// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime.h"

#include "yogi/runtime/any.h"
#include "yogi/runtime/errors.h"
#include "yogi/runtime/memory.h"

#include <cstdio>
#include <cstring>

extern "C" {

void *yogi_any_undefined(void) {
	return yogi::runtime::AnyValue::undefined();
}

void *yogi_any_null(void) {
	return yogi::runtime::AnyValue::null();
}

void *yogi_any_from_number(double value) {
	return yogi::runtime::AnyValue::fromNumber(value);
}

void *yogi_any_from_boolean(bool value) {
	return yogi::runtime::AnyValue::fromBoolean(value);
}

void *yogi_any_from_string(const char *value) {
	return yogi::runtime::AnyValue::fromString(value);
}

void *yogi_any_from_array(void *value) {
	return yogi::runtime::AnyValue::fromArray(value);
}

double yogi_any_to_number(void *value) {
	return yogi::runtime::AnyValue::require(value, "number")->asNumber();
}

bool yogi_any_to_boolean(void *value) {
	return yogi::runtime::AnyValue::require(value, "boolean")->asBoolean();
}

const char *yogi_any_to_string(void *value) {
	return yogi::runtime::AnyValue::require(value, "string")->asString();
}

void *yogi_any_to_array(void *value) {
	return yogi::runtime::AnyValue::require(value, "array")->asArray();
}

void *yogi_any_to_null(void *value) {
	return yogi::runtime::AnyValue::require(value, "null")->asNull();
}

void *yogi_any_to_undefined(void *value) {
	return yogi::runtime::AnyValue::require(value, "undefined")->asUndefined();
}

bool yogi_any_is_nullish(void *value) {
	if (!value) {
		return true;
	}

	const auto *anyValue = static_cast<const yogi::runtime::AnyValue *>(value);
	return anyValue->isNullish();
}

unsigned long long yogi_string_length(const char *value) {
	return static_cast<unsigned long long>(std::strlen(value ? value : ""));
}

const char *yogi_string_at(const char *value, unsigned long long index) {
	const auto *text = value ? value : "";
	const auto length = std::strlen(text);
	auto *result = static_cast<char *>(yogi::runtime::MemoryManager::allocate(2, "runtime string"));

	if (index >= length) {
		result[0] = '\0';
		return result;
	}

	result[0] = text[index];
	result[1] = '\0';
	return result;
}

const char *yogi_string_concat(const char *left, const char *right) {
	const auto *leftText = left ? left : "";
	const auto *rightText = right ? right : "";
	const auto leftLength = std::strlen(leftText);
	const auto rightLength = std::strlen(rightText);
	auto *result = static_cast<char *>(
		yogi::runtime::MemoryManager::allocate(leftLength + rightLength + 1, "runtime string")
	);

	std::memcpy(result, leftText, leftLength);
	std::memcpy(result + leftLength, rightText, rightLength);
	result[leftLength + rightLength] = '\0';
	return result;
}

const char *yogi_string_from_number(double value) {
	char buffer[64];
	const auto length = static_cast<std::size_t>(std::snprintf(buffer, sizeof(buffer), "%.15g", value));
	auto *result = static_cast<char *>(yogi::runtime::MemoryManager::allocate(length + 1, "runtime string"));

	std::memcpy(result, buffer, length + 1);
	return result;
}

const char *yogi_string_from_boolean(bool value) {
	const auto *text = value ? "true" : "false";
	const auto length = std::strlen(text);
	auto *result = static_cast<char *>(yogi::runtime::MemoryManager::allocate(length + 1, "runtime string"));

	std::memcpy(result, text, length + 1);
	return result;
}

void yogi_runtime_abort_cast(const char *fromType, const char *toType) {
	yogi::runtime::RuntimeError::abortCast(fromType, toType);
}

}
