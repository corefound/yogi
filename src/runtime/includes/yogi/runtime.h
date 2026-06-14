#pragma once

#ifndef __cplusplus
#include <stdbool.h>
#endif

#ifdef __cplusplus
extern "C" {
#endif

enum YogiAnyTag {
	YOGI_ANY_UNDEFINED = 0,
	YOGI_ANY_NULL = 1,
	YOGI_ANY_NUMBER = 2,
	YOGI_ANY_BOOLEAN = 3,
	YOGI_ANY_STRING = 4,
};

void *yogi_any_undefined(void);
void *yogi_any_null(void);
void *yogi_any_from_number(double value);
void *yogi_any_from_boolean(bool value);
void *yogi_any_from_string(const char *value);

double yogi_any_to_number(void *value);
bool yogi_any_to_boolean(void *value);
const char *yogi_any_to_string(void *value);
void *yogi_any_to_null(void *value);
void *yogi_any_to_undefined(void *value);

void yogi_runtime_abort_cast(const char *fromType, const char *toType);

#ifdef __cplusplus
}
#endif
