// Created by Brayhan De Aza on 6/15/26.
//

#include "yogi/runtime.h"

#include "yogi/runtime/any.h"
#include "yogi/runtime/errors.h"
#include "yogi/runtime/memory.h"

#include <cctype>
#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <cmath>
#include <limits>

namespace {
	const char **ownedRuntimeStrings = nullptr;
	std::size_t ownedRuntimeStringCount = 0;
	std::size_t ownedRuntimeStringCapacity = 0;

	const char *safeString(const char *value) {
		return value ? value : "";
	}

	std::size_t minSize(std::size_t left, std::size_t right) {
		return left < right ? left : right;
	}

	std::size_t toUnboundedLength(double value) {
		if (std::isnan(value) || std::isinf(value)) {
			return 0;
		}

		const auto truncated = value < 0 ? std::ceil(value) : std::floor(value);
		if (truncated <= 0) {
			return 0;
		}

		return static_cast<std::size_t>(truncated);
	}

	std::size_t toIntegerIndex(double value, std::size_t length, bool infinityIsLength) {
		if (std::isnan(value)) {
			return 0;
		}

		if (std::isinf(value)) {
			return value > 0 && infinityIsLength ? length : 0;
		}

		const auto truncated = value < 0 ? std::ceil(value) : std::floor(value);
		if (truncated <= 0) {
			return 0;
		}

		const auto asSize = static_cast<std::size_t>(truncated);
		return minSize(asSize, length);
	}

	std::size_t toRelativeIndex(double value, std::size_t length, bool infinityIsLength) {
		if (std::isnan(value)) {
			return 0;
		}

		if (std::isinf(value)) {
			return value > 0 && infinityIsLength ? length : 0;
		}

		const auto truncated = value < 0 ? std::ceil(value) : std::floor(value);
		if (truncated < 0) {
			const auto fromEnd = static_cast<double>(length) + truncated;
			return fromEnd <= 0 ? 0 : minSize(static_cast<std::size_t>(fromEnd), length);
		}

		return minSize(static_cast<std::size_t>(truncated), length);
	}

	char *allocateRuntimeString(std::size_t length) {
		auto *result = static_cast<char *>(yogi::runtime::MemoryManager::allocate(length + 1, "runtime string"));
		result[length] = '\0';

		if (ownedRuntimeStringCount == ownedRuntimeStringCapacity) {
			const auto nextCapacity = ownedRuntimeStringCapacity == 0 ? 64 : ownedRuntimeStringCapacity * 2;
			auto *nextStrings = static_cast<const char **>(
				std::realloc(ownedRuntimeStrings, sizeof(const char *) * nextCapacity)
			);

			if (!nextStrings) {
				yogi::runtime::RuntimeError::abortAllocation("runtime string registry");
			}

			ownedRuntimeStrings = nextStrings;
			ownedRuntimeStringCapacity = nextCapacity;
		}

		ownedRuntimeStrings[ownedRuntimeStringCount++] = result;
		return result;
	}

	bool unregisterRuntimeString(const char *value) {
		if (!value) {
			return false;
		}

		for (std::size_t index = 0; index < ownedRuntimeStringCount; ++index) {
			if (ownedRuntimeStrings[index] == value) {
				ownedRuntimeStrings[index] = ownedRuntimeStrings[ownedRuntimeStringCount - 1];
				--ownedRuntimeStringCount;
				return true;
			}
		}

		return false;
	}

	const char *copyRuntimeString(const char *value, std::size_t length) {
		auto *result = allocateRuntimeString(length);
		if (length > 0) {
			std::memcpy(result, value, length);
		}
		return result;
	}

	long long indexOfRaw(const char *text, std::size_t textLength, const char *needle, std::size_t needleLength, std::size_t start) {
		if (needleLength == 0) {
			return static_cast<long long>(start);
		}

		if (needleLength > textLength || start > textLength - needleLength) {
			return -1;
		}

		for (std::size_t index = start; index <= textLength - needleLength; ++index) {
			if (std::memcmp(text + index, needle, needleLength) == 0) {
				return static_cast<long long>(index);
			}
		}

		return -1;
	}

	long long lastIndexOfRaw(const char *text, std::size_t textLength, const char *needle, std::size_t needleLength, std::size_t start) {
		if (needleLength == 0) {
			return static_cast<long long>(start);
		}

		if (needleLength > textLength) {
			return -1;
		}

		auto index = minSize(start, textLength - needleLength);
		while (true) {
			if (std::memcmp(text + index, needle, needleLength) == 0) {
				return static_cast<long long>(index);
			}

			if (index == 0) {
				break;
			}

			--index;
		}

		return -1;
	}
}

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
	const auto *leftText = safeString(left);
	const auto *rightText = safeString(right);
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

const char *yogi_string_slice(const char *value, double start, double end) {
	const auto *text = safeString(value);
	const auto length = std::strlen(text);
	const auto startIndex = toRelativeIndex(start, length, true);
	const auto endIndex = toRelativeIndex(end, length, true);

	if (endIndex <= startIndex) {
		return copyRuntimeString("", 0);
	}

	return copyRuntimeString(text + startIndex, endIndex - startIndex);
}

const char *yogi_string_substring(const char *value, double start, double end) {
	const auto *text = safeString(value);
	const auto length = std::strlen(text);
	auto startIndex = toIntegerIndex(start, length, true);
	auto endIndex = toIntegerIndex(end, length, true);

	if (startIndex > endIndex) {
		const auto tmp = startIndex;
		startIndex = endIndex;
		endIndex = tmp;
	}

	return copyRuntimeString(text + startIndex, endIndex - startIndex);
}

bool yogi_string_includes(const char *value, const char *search, double position) {
	const auto *text = safeString(value);
	const auto *needle = safeString(search);
	const auto textLength = std::strlen(text);
	const auto needleLength = std::strlen(needle);
	const auto start = toIntegerIndex(position, textLength, true);

	return indexOfRaw(text, textLength, needle, needleLength, start) != -1;
}

bool yogi_string_starts_with(const char *value, const char *search, double position) {
	const auto *text = safeString(value);
	const auto *needle = safeString(search);
	const auto textLength = std::strlen(text);
	const auto needleLength = std::strlen(needle);
	const auto start = toIntegerIndex(position, textLength, true);

	if (needleLength > textLength - start) {
		return false;
	}

	return std::memcmp(text + start, needle, needleLength) == 0;
}

bool yogi_string_ends_with(const char *value, const char *search, double endPosition) {
	const auto *text = safeString(value);
	const auto *needle = safeString(search);
	const auto textLength = std::strlen(text);
	const auto needleLength = std::strlen(needle);
	const auto end = toIntegerIndex(endPosition, textLength, true);

	if (needleLength > end) {
		return false;
	}

	return std::memcmp(text + end - needleLength, needle, needleLength) == 0;
}

long long yogi_string_index_of(const char *value, const char *search, double position) {
	const auto *text = safeString(value);
	const auto *needle = safeString(search);
	const auto textLength = std::strlen(text);
	const auto needleLength = std::strlen(needle);
	const auto start = toIntegerIndex(position, textLength, true);

	return indexOfRaw(text, textLength, needle, needleLength, start);
}

long long yogi_string_last_index_of(const char *value, const char *search, double position) {
	const auto *text = safeString(value);
	const auto *needle = safeString(search);
	const auto textLength = std::strlen(text);
	const auto needleLength = std::strlen(needle);
	const auto start = toIntegerIndex(position, textLength, true);

	return lastIndexOfRaw(text, textLength, needle, needleLength, start);
}

bool yogi_string_equals(const char *left, const char *right) {
	return std::strcmp(safeString(left), safeString(right)) == 0;
}

const char *yogi_string_char_at(const char *value, double index) {
	const auto *text = safeString(value);
	const auto length = std::strlen(text);
	const auto charIndex = toIntegerIndex(index, length, true);

	if (charIndex >= length) {
		return copyRuntimeString("", 0);
	}

	return copyRuntimeString(text + charIndex, 1);
}

double yogi_string_char_code_at(const char *value, double index) {
	const auto *text = safeString(value);
	const auto length = std::strlen(text);
	const auto charIndex = toIntegerIndex(index, length, true);

	if (charIndex >= length) {
		return std::numeric_limits<double>::quiet_NaN();
	}

	return static_cast<double>(static_cast<unsigned char>(text[charIndex]));
}

const char *yogi_string_repeat(const char *value, double count) {
	const auto *text = safeString(value);
	const auto length = std::strlen(text);
	const auto repeatCount = toUnboundedLength(count);
	const auto resultLength = length * repeatCount;
	auto *result = allocateRuntimeString(resultLength);

	for (std::size_t index = 0; index < repeatCount; ++index) {
		std::memcpy(result + index * length, text, length);
	}

	return result;
}

const char *yogi_string_pad_start(const char *value, double targetLength, const char *padString) {
	const auto *text = safeString(value);
	const auto *pad = safeString(padString);
	const auto textLength = std::strlen(text);
	const auto padLength = std::strlen(pad);
	const auto target = toUnboundedLength(targetLength);

	if (target <= textLength || padLength == 0) {
		return copyRuntimeString(text, textLength);
	}

	const auto fillLength = target - textLength;
	auto *result = allocateRuntimeString(target);

	for (std::size_t index = 0; index < fillLength; ++index) {
		result[index] = pad[index % padLength];
	}
	std::memcpy(result + fillLength, text, textLength);
	return result;
}

const char *yogi_string_pad_end(const char *value, double targetLength, const char *padString) {
	const auto *text = safeString(value);
	const auto *pad = safeString(padString);
	const auto textLength = std::strlen(text);
	const auto padLength = std::strlen(pad);
	const auto target = toUnboundedLength(targetLength);

	if (target <= textLength || padLength == 0) {
		return copyRuntimeString(text, textLength);
	}

	const auto fillLength = target - textLength;
	auto *result = allocateRuntimeString(target);

	std::memcpy(result, text, textLength);
	for (std::size_t index = 0; index < fillLength; ++index) {
		result[textLength + index] = pad[index % padLength];
	}
	return result;
}

const char *yogi_string_to_upper_case(const char *value) {
	const auto *text = safeString(value);
	const auto length = std::strlen(text);
	auto *result = allocateRuntimeString(length);

	for (std::size_t index = 0; index < length; ++index) {
		result[index] = static_cast<char>(std::toupper(static_cast<unsigned char>(text[index])));
	}

	return result;
}

const char *yogi_string_to_lower_case(const char *value) {
	const auto *text = safeString(value);
	const auto length = std::strlen(text);
	auto *result = allocateRuntimeString(length);

	for (std::size_t index = 0; index < length; ++index) {
		result[index] = static_cast<char>(std::tolower(static_cast<unsigned char>(text[index])));
	}

	return result;
}

const char *yogi_string_trim(const char *value) {
	const auto *text = safeString(value);
	const auto length = std::strlen(text);
	std::size_t begin = 0;
	std::size_t end = length;

	while (begin < end && std::isspace(static_cast<unsigned char>(text[begin]))) {
		++begin;
	}

	while (begin < end && std::isspace(static_cast<unsigned char>(text[end - 1]))) {
		--end;
	}

	return copyRuntimeString(text + begin, end - begin);
}

const char *yogi_string_trim_start(const char *value) {
	const auto *text = safeString(value);
	const auto length = std::strlen(text);
	std::size_t begin = 0;

	while (begin < length && std::isspace(static_cast<unsigned char>(text[begin]))) {
		++begin;
	}

	return copyRuntimeString(text + begin, length - begin);
}

const char *yogi_string_trim_end(const char *value) {
	const auto *text = safeString(value);
	const auto length = std::strlen(text);
	std::size_t end = length;

	while (end > 0 && std::isspace(static_cast<unsigned char>(text[end - 1]))) {
		--end;
	}

	return copyRuntimeString(text, end);
}

void yogi_string_destroy(const char *value) {
	if (!unregisterRuntimeString(value)) {
		return;
	}

	yogi::runtime::MemoryManager::deallocate(const_cast<char *>(value));
}

void yogi_runtime_abort_cast(const char *fromType, const char *toType) {
	yogi::runtime::RuntimeError::abortCast(fromType, toType);
}

void yogi_struct_validate_failed(const char *structName, const char *validatorName) {
	yogi::runtime::RuntimeError::abortStructValidation(structName, validatorName);
}

}
