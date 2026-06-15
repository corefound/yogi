// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime.h"

#include "yogi/runtime/any.h"
#include "yogi/runtime/errors.h"

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

double yogi_any_to_number(void *value) {
	return yogi::runtime::AnyValue::require(value, "number")->asNumber();
}

bool yogi_any_to_boolean(void *value) {
	return yogi::runtime::AnyValue::require(value, "boolean")->asBoolean();
}

const char *yogi_any_to_string(void *value) {
	return yogi::runtime::AnyValue::require(value, "string")->asString();
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

void yogi_runtime_abort_cast(const char *fromType, const char *toType) {
	yogi::runtime::RuntimeError::abortCast(fromType, toType);
}

}
