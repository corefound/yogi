// Created by Brayhan De Aza on 6/18/26.
//

#include "yogi/runtime.h"

#include "yogi/runtime/aggregate.h"
#include "yogi/runtime/any.h"

#include <cstdio>

namespace {
constexpr const char *RESET = "\033[0m";
constexpr const char *BRACKET = "\033[96m";
constexpr const char *KEY = "\033[95m";
constexpr const char *STRING = "\033[92m";
constexpr const char *NUMBER = "\033[93m";
constexpr const char *BOOLEAN = "\033[94m";
constexpr const char *NULLISH = "\033[90m";
constexpr std::size_t MAX_DEPTH = 16;

void printLine(const char *value) {
    std::fputs(value ? value : "", stdout);
    std::fputc('\n', stdout);
}

void printValueInline(void *value, std::size_t depth);
void printArrayInline(void *value, std::size_t depth);
void printObjectInline(void *value, std::size_t depth);

void printIndent(std::size_t depth) {
    for(std::size_t index = 0; index < depth; ++index) {
        std::fputs("  ", stdout);
    }
}

void printColored(const char *color, const char *value) {
    std::fputs(color, stdout);
    std::fputs(value ? value : "", stdout);
    std::fputs(RESET, stdout);
}

void printAnyInline(void *value, std::size_t depth) {
    if(!value) {
        printColored(NULLISH, "null");
        return;
    }

    const auto *anyValue = yogi::runtime::AnyValue::require(value, "any");

    switch(anyValue->tag()) {
    case YOGI_ANY_UNDEFINED:
        printColored(NULLISH, "undefined");
        break;

    case YOGI_ANY_NULL:
        printColored(NULLISH, "null");
        break;

    case YOGI_ANY_NUMBER:
        std::fputs(NUMBER, stdout);
        std::printf("%.15g", anyValue->asNumber());
        std::fputs(RESET, stdout);
        break;

    case YOGI_ANY_BOOLEAN:
        std::fputs(BOOLEAN, stdout);
        std::fputs(anyValue->asBoolean() ? "true" : "false", stdout);
        std::fputs(RESET, stdout);
        break;

    case YOGI_ANY_STRING:
        std::fputs(STRING, stdout);
        std::fputc('"', stdout);
        std::fputs(anyValue->asString() ? anyValue->asString() : "", stdout);
        std::fputc('"', stdout);
        std::fputs(RESET, stdout);
        break;

    case YOGI_ANY_ARRAY:
        printArrayInline(anyValue->asArray(), depth + 1);
        break;

    case YOGI_ANY_OBJECT:
        printObjectInline(anyValue->asObject(), depth + 1);
        break;
    }
}

void printValueInline(void *value, std::size_t depth) {
    if(depth > MAX_DEPTH) {
        printColored(NULLISH, "[depth limit]");
        return;
    }

    printAnyInline(value, depth);
}

void printArrayInline(void *value, std::size_t depth) {
    if(!value) {
        printColored(NULLISH, "null");
        return;
    }

    if(depth > MAX_DEPTH) {
        printColored(NULLISH, "[...]");
        return;
    }

    const auto *array = static_cast<const yogi::runtime::ArrayValue *>(value);
    printColored(BRACKET, "[");

    const auto length = array->length();
    for(std::size_t index = 0; index < length; ++index) {
        if(index > 0) {
            std::fputs(", ", stdout);
        }

        printValueInline(array->get(index), depth + 1);
    }

    printColored(BRACKET, "]");
}

void printObjectInline(void *value, std::size_t depth) {
    if(!value) {
        printColored(NULLISH, "null");
        return;
    }

    if(depth > MAX_DEPTH) {
        printColored(NULLISH, "{...}");
        return;
    }

    const auto *object = static_cast<const yogi::runtime::ObjectValue *>(value);
    printColored(BRACKET, "{");

    const auto length = object->length();
    if(length == 0) {
        printColored(BRACKET, "}");
        return;
    }

    std::fputc('\n', stdout);

    for(std::size_t index = 0; index < length; ++index) {
        printIndent(depth + 1);
        std::fputs(KEY, stdout);
        std::fputs(object->keyAt(index), stdout);
        std::fputs(RESET, stdout);
        std::fputs(": ", stdout);
        printValueInline(object->valueAt(index), depth + 1);
        if(index + 1 < length) {
            std::fputc(',', stdout);
        }
        std::fputc('\n', stdout);
    }

    printIndent(depth);
    printColored(BRACKET, "}");
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
        printAnyInline(value, 0);
        std::fputc('\n', stdout);
    }

    void yogi_print_array(void *value) {
        if(!value) {
            printLine("null");
            return;
        }

        printArrayInline(value, 0);
        std::fputc('\n', stdout);
    }

    void yogi_print_object(void *value) {
        if(!value) {
            printLine("null");
            return;
        }

        printObjectInline(value, 0);
        std::fputc('\n', stdout);
    }

}
