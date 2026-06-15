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
bool yogi_any_is_nullish(void *value);

void *yogi_object_create(void);
unsigned long long yogi_object_sizeof(void);
void yogi_object_init(void *object);
void yogi_object_set(void *object, const char *name, void *value);
void *yogi_object_get(void *object, const char *name);
void yogi_object_drop(void *object);
void yogi_object_destroy(void *object);

void *yogi_array_create(unsigned long long length);
unsigned long long yogi_array_sizeof(void);
void yogi_array_init(void *array, unsigned long long length);
void yogi_array_set(void *array, unsigned long long index, void *value);
void *yogi_array_get(void *array, unsigned long long index);
void yogi_array_drop(void *array);
void yogi_array_destroy(void *array);

void *yogi_alloc(unsigned long long size);
void *yogi_realloc(void *address, unsigned long long newSize);
void yogi_free(void *address);
const char *yogi_allocator_name(void);
unsigned long long yogi_memory_live_bytes(void);
unsigned long long yogi_memory_live_allocations(void);
unsigned long long yogi_memory_total_allocated_bytes(void);
unsigned long long yogi_memory_total_freed_bytes(void);
unsigned long long yogi_memory_peak_bytes(void);
void yogi_memory_push_context(const char *moduleName, const char *functionName);
void yogi_memory_pop_context(void);
const char *yogi_memory_current_module(void);
const char *yogi_memory_current_function(void);
unsigned long long yogi_memory_attributed_live_bytes(const char *moduleName, const char *functionName);
unsigned long long yogi_memory_attributed_live_allocations(const char *moduleName, const char *functionName);
unsigned long long yogi_memory_attributed_total_allocated_bytes(const char *moduleName, const char *functionName);
unsigned long long yogi_memory_attributed_total_freed_bytes(const char *moduleName, const char *functionName);
unsigned long long yogi_memory_attributed_peak_bytes(const char *moduleName, const char *functionName);
void yogi_memory_debug_report(void);

bool yogi_debug_ownership_enabled(void);
unsigned long long yogi_debug_ownership_live_allocations(void);
unsigned long long yogi_debug_ownership_live_aggregates(void);
unsigned long long yogi_debug_ownership_report_leaks(void);
void yogi_debug_ownership_reset(void);

void yogi_runtime_abort_cast(const char *fromType, const char *toType);

#ifdef __cplusplus
}
#endif
