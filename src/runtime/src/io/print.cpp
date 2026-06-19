// Created by Brayhan De Aza on 6/18/26.
//

#include "yogi/runtime.h"

#include "yogi/runtime/aggregate.h"
#include "yogi/runtime/any.h"

#include <cstdio>

namespace {
void printLine(const char *value) {
    std::fputs(value ? value : "", stdout);
    std::fputc('\n', stdout);
}

void printArrayInline(void *value);

void printAnyInline(void *value) {
    if(!value) {
        std::fputs("null", stdout);
        return;
    }

    const auto *anyValue = yogi::runtime::AnyValue::require(value, "any");

    switch(anyValue->tag()) {
    case YOGI_ANY_UNDEFINED:
        std::fputs("undefined", stdout);
        break;

    case YOGI_ANY_NULL:
        std::fputs("null", stdout);
        break;

    case YOGI_ANY_NUMBER:
        std::printf("%.15g", anyValue->asNumber());
        break;

    case YOGI_ANY_BOOLEAN:
        std::fputs(anyValue->asBoolean() ? "true" : "false", stdout);
        break;

    case YOGI_ANY_STRING:
        std::fputs(anyValue->asString() ? anyValue->asString() : "", stdout);
        break;

    case YOGI_ANY_ARRAY:
        printArrayInline(anyValue->asArray());
        break;
    }
}

void printArrayInline(void *value) {
    if(!value) {
        std::fputs("null", stdout);
        return;
    }

    const auto *array = static_cast<const yogi::runtime::ArrayValue *>(value);
    std::fputc('[', stdout);

    const auto length = array->length();
    for(std::size_t index = 0; index < length; ++index) {
        if(index > 0) {
            std::fputs(", ", stdout);
        }

        printAnyInline(array->get(index));
    }

    std::fputc(']', stdout);
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
        printAnyInline(value);
        std::fputc('\n', stdout);
    }

    void yogi_print_array(void *value) {
        if(!value) {
            printLine("null");
            return;
        }

        printArrayInline(value);
        std::fputc('\n', stdout);
    }

}
