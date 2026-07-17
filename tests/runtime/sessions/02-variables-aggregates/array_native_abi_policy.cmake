if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

find_program(YOGI_NATIVE_CC NAMES cc clang gcc)
find_program(YOGI_NATIVE_AR NAMES ar llvm-ar)

if(NOT YOGI_NATIVE_CC OR NOT YOGI_NATIVE_AR)
	message(FATAL_ERROR "array native ABI test requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/native_array.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/native_array.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libnative_array.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

double sumValues(double *values, uint64_t length) {
	double total = 0.0;
	for (uint64_t index = 0; index < length; ++index) {
		total += values[index];
	}
	return total;
}

void incrementValues(double *values, uint64_t length) {
	for (uint64_t index = 0; index < length; ++index) {
		values[index] += 10.0;
	}
}

double sumFixed(double *values, uint64_t length) {
	return length == 4 ? values[0] + values[1] + values[2] + values[3] : -1.0;
}

void transformMatrix(double *values, uint64_t rows, uint64_t columns) {
	for (uint64_t row = 0; row < rows; ++row) {
		for (uint64_t column = 0; column < columns; ++column) {
			values[row * columns + column] = values[row * columns + column] + (double)(row * 100 + column);
		}
	}
}

typedef struct {
	double score;
	double weight;
} NativeReading;

double weightedScore(NativeReading *readings, uint64_t length) {
	double total = 0.0;
	for (uint64_t index = 0; index < length; ++index) {
		total += readings[index].score * readings[index].weight;
	}
	return total;
}

void boostReadings(NativeReading *readings, uint64_t length) {
	for (uint64_t index = 0; index < length; ++index) {
		readings[index].score += readings[index].weight;
	}
}

double totalStringLength(const char **values, uint64_t length) {
	double total = 0.0;
	for (uint64_t index = 0; index < length; ++index) {
		total += (double)strlen(values[index]);
	}
	return total;
}

bool containsString(const char **values, uint64_t length, const char *target) {
	for (uint64_t index = 0; index < length; ++index) {
		if (strcmp(values[index], target) == 0) {
			return true;
		}
	}
	return false;
}
]=])

execute_process(
	COMMAND "${YOGI_NATIVE_CC}" -c "${NATIVE_SOURCE}" -o "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_compile_result
	OUTPUT_VARIABLE native_compile_stdout
	ERROR_VARIABLE native_compile_stderr
)

if(NOT native_compile_result EQUAL 0)
	message(FATAL_ERROR "native fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
endif()

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
struct Reading {
    score: number
    weight: number
}

extern native from "./libnative_array.a" {
    sumValues(values: number[]): number
    incrementValues(values: ptr<number[]>): void
    sumFixed(values: number[4]): number
    transformMatrix(values: ptr<number[2, 3]>): void
    weightedScore(readings: Reading[]): number
    boostReadings(readings: ptr<Reading[]>): void
    totalStringLength(values: string[]): number
    containsString(values: string[], target: string): boolean
}

let samples: number[] = [1, 2, 3, 4]
let coefficients: number[4] = [2, 4, 6, 8]
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let readings: Reading[] = [
    { score: 2, weight: 10 },
    { score: 3, weight: 20 }
]
let names: string[] = ["Ana", "Luis", "Mia"]
let emptyNames: string[] = []

print(native.sumValues(samples))
native.incrementValues(&samples)
print(samples[0])
print(samples[3])
print(native.sumFixed(coefficients))
native.transformMatrix(&matrix)
print(matrix[0, 2])
print(matrix[1, 0])
print(matrix[1, 2])
print(native.weightedScore(readings))
native.boostReadings(&readings)
print(readings[0].score)
print(readings[1].score)
print(native.totalStringLength(names))
print(native.containsString(names, "Luis"))
print(names.length)
print(names[0])
print(native.totalStringLength(emptyNames))
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array native ABI pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array native ABI artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_native_number_buffer
		yogi_array_native_number_buffer_copy_back
		yogi_array_native_buffer_destroy
		yogi_array_native_string_buffer
		yogi_array_native_string_buffer_destroy
		sumValues
		incrementValues
		transformMatrix
		weightedScore
		boostReadings
		totalStringLength
		containsString)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array native ABI IR to contain ${symbol}")
	endif()
endforeach()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "array native ABI executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "10\n11\n14\n20\n5\n104\n108\n80\n12\n23\n10\ntrue\n3\nAna\n0\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array native ABI executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

function(expect_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/invalid/${case_name}")
	file(REMOVE_RECURSE "${case_dir}")
	file(MAKE_DIRECTORY "${case_dir}")
	file(COPY "${NATIVE_LIBRARY}" DESTINATION "${case_dir}")
	set(source_file "${case_dir}/main.ts")
	file(WRITE "${source_file}" "${source}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source_file}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE compile_result
		OUTPUT_VARIABLE compile_stdout
		ERROR_VARIABLE compile_stderr
	)

	if(compile_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly compiled\nstdout:\n${compile_stdout}")
	endif()

	if(NOT compile_stderr MATCHES "${expected}")
		message(FATAL_ERROR "${case_name} did not report ${expected}:\n${compile_stderr}")
	endif()
endfunction()

expect_invalid(
	"extern_string_pointer_array_parameter"
	"extern native from \"./libnative_array.a\" {\n    process(values: ptr<string[]>): void\n}\n"
	"native ABI"
)

expect_invalid(
	"extern_nested_dynamic_array_parameter"
	"extern native from \"./libnative_array.a\" {\n    process(values: string[][]): void\n}\n"
	"native ABI"
)

expect_invalid(
	"extern_string_array_return"
	"extern native from \"./libnative_array.a\" {\n    load(): string[]\n}\n"
	"native ABI"
)

expect_invalid(
	"extern_struct_string_array_parameter"
	"struct User {\n    id: number\n    name: string\n}\n\nextern native from \"./libnative_array.a\" {\n    process(values: User[]): void\n}\n"
	"native ABI"
)

expect_invalid(
	"extern_tuple_return"
	"extern native from \"./libnative_array.a\" {\n    load(): [number, number]\n}\n"
	"native ABI"
)

expect_invalid(
	"extern_array_variable"
	"extern native from \"./libnative_array.a\" {\n    readonly values: number[]\n}\n"
	"native ABI"
)
