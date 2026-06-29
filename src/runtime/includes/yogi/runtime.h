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
	YOGI_ANY_ARRAY = 5,
	YOGI_ANY_OBJECT = 6,
};

void *yogi_any_undefined(void);
void *yogi_any_null(void);
void *yogi_any_from_number(double value);
void *yogi_any_from_boolean(bool value);
void *yogi_any_from_string(const char *value);
void *yogi_any_from_array(void *value);
void *yogi_any_from_object(void *value);

double yogi_any_to_number(void *value);
bool yogi_any_to_boolean(void *value);
const char *yogi_any_to_string(void *value);
void *yogi_any_to_array(void *value);
void *yogi_any_to_object(void *value);
void *yogi_any_to_null(void *value);
void *yogi_any_to_undefined(void *value);
bool yogi_any_is_nullish(void *value);

void yogi_print_number(double value);
void yogi_print_boolean(bool value);
void yogi_print_string(const char *value);
void yogi_print_any(void *value);
void yogi_print_array(void *value);
void yogi_print_object(void *value);

unsigned long long yogi_string_length(const char *value);
const char *yogi_string_at(const char *value, unsigned long long index);
const char *yogi_string_concat(const char *left, const char *right);
const char *yogi_string_from_number(double value);
const char *yogi_string_from_boolean(bool value);
const char *yogi_string_slice(const char *value, double start, double end);
const char *yogi_string_substring(const char *value, double start, double end);
bool yogi_string_includes(const char *value, const char *search, double position);
bool yogi_string_starts_with(const char *value, const char *search, double position);
bool yogi_string_ends_with(const char *value, const char *search, double endPosition);
long long yogi_string_index_of(const char *value, const char *search, double position);
long long yogi_string_last_index_of(const char *value, const char *search, double position);
bool yogi_string_equals(const char *left, const char *right);
const char *yogi_string_char_at(const char *value, double index);
double yogi_string_char_code_at(const char *value, double index);
const char *yogi_string_repeat(const char *value, double count);
const char *yogi_string_pad_start(const char *value, double targetLength, const char *padString);
const char *yogi_string_pad_end(const char *value, double targetLength, const char *padString);
const char *yogi_string_to_upper_case(const char *value);
const char *yogi_string_to_lower_case(const char *value);
const char *yogi_string_trim(const char *value);
const char *yogi_string_trim_start(const char *value);
const char *yogi_string_trim_end(const char *value);
void yogi_string_destroy(const char *value);

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
unsigned long long yogi_array_push(void *array, void *value);
void *yogi_array_pop(void *array);
void *yogi_array_at(void *array, unsigned long long index);
void *yogi_array_at_index(void *array, double index);
unsigned long long yogi_array_length(void *array);
void *yogi_array_shift(void *array);
unsigned long long yogi_array_unshift(void *array, void *value);
bool yogi_array_includes(void *array, void *value, double fromIndex);
long long yogi_array_index_of(void *array, void *value, double fromIndex);
long long yogi_array_last_index_of(void *array, void *value, double fromIndex);
void yogi_array_reverse(void *array);
void *yogi_array_clone(void *array);
void yogi_array_append_array(void *array, void *source);
void yogi_array_insert(void *array, unsigned long long index, void *value);
void yogi_array_fill(void *array, void *value, double start, double end);
void yogi_array_copy_within(void *array, double target, double start, double end);
void *yogi_array_splice(void *array, double start, double deleteCount, void *inserted);
void *yogi_array_to_reversed(void *array);
void *yogi_array_to_spliced(void *array, double start, double deleteCount, void *inserted);
void *yogi_array_with(void *array, double index, void *value);
void *yogi_array_slice(void *array, double start, double end);
void *yogi_array_flat(void *array, unsigned long long depth);
void *yogi_array_keys(void *array);
void *yogi_array_values(void *array);
void *yogi_array_entries(void *array);
const char *yogi_array_join(void *array, const char *separator);
const char *yogi_array_to_string(void *array);
void yogi_array_sort(void *array);
void *yogi_array_to_sorted(void *array);
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
void yogi_memory_push_source_location(const char *sourcePath, unsigned long long line, unsigned long long column);
void yogi_memory_pop_source_location(void);
const char *yogi_memory_current_source_path(void);
unsigned long long yogi_memory_current_source_line(void);
unsigned long long yogi_memory_current_source_column(void);
unsigned long long yogi_memory_attributed_live_bytes(const char *moduleName, const char *functionName);
unsigned long long yogi_memory_attributed_live_allocations(const char *moduleName, const char *functionName);
unsigned long long yogi_memory_attributed_total_allocated_bytes(const char *moduleName, const char *functionName);
unsigned long long yogi_memory_attributed_total_freed_bytes(const char *moduleName, const char *functionName);
unsigned long long yogi_memory_attributed_peak_bytes(const char *moduleName, const char *functionName);
unsigned long long yogi_memory_attributed_location_live_bytes(const char *sourcePath, unsigned long long line, unsigned long long column);
unsigned long long yogi_memory_attributed_location_live_allocations(const char *sourcePath, unsigned long long line, unsigned long long column);
unsigned long long yogi_memory_attributed_location_total_allocated_bytes(const char *sourcePath, unsigned long long line, unsigned long long column);
unsigned long long yogi_memory_attributed_location_total_freed_bytes(const char *sourcePath, unsigned long long line, unsigned long long column);
unsigned long long yogi_memory_attributed_location_peak_bytes(const char *sourcePath, unsigned long long line, unsigned long long column);
void yogi_memory_debug_report(void);

bool yogi_debug_ownership_enabled(void);
unsigned long long yogi_debug_ownership_live_allocations(void);
unsigned long long yogi_debug_ownership_live_aggregates(void);
unsigned long long yogi_debug_ownership_report_leaks(void);
void yogi_debug_ownership_reset(void);

void yogi_runtime_abort_cast(const char *fromType, const char *toType);
void yogi_struct_validate_failed(const char *structName, const char *validatorName);

#ifdef __cplusplus
}
#endif
