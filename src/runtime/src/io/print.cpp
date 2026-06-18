// Created by Brayhan De Aza on 6/18/26.
//

#include "yogi/runtime.h"

#include "yogi/runtime/any.h"

#include <cstdio>

namespace {

void printLine(const char *value) {
	std::fputs(value ? value : "", stdout);
	std::fputc('\n', stdout);
}

}

extern "C" {

void yogi_print_number(double value) {
	std::printf("%.15g\n", value);
}

void yogi_print_boolean(bool value) {
	printLine(value ? "true" : "false");
}

void yogi_print_string(const char *value) {
	printLine(value);
}

void yogi_print_any(void *value) {
	if (!value) {
		printLine("null");
		return;
	}

	const auto *anyValue = yogi::runtime::AnyValue::require(value, "any");

	switch (anyValue->tag()) {
		case YOGI_ANY_UNDEFINED:
			printLine("undefined");
			break;

		case YOGI_ANY_NULL:
			printLine("null");
			break;

		case YOGI_ANY_NUMBER:
			std::printf("%.15g\n", anyValue->asNumber());
			break;

		case YOGI_ANY_BOOLEAN:
			printLine(anyValue->asBoolean() ? "true" : "false");
			break;

		case YOGI_ANY_STRING:
			printLine(anyValue->asString());
			break;
	}
}

}
