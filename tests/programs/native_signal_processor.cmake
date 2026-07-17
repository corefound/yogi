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
	message(FATAL_ERROR "native signal processor program requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/signal_native.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/signal_native.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libsignal_native.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdint.h>

double signalEnergy(double *samples, uint64_t length) {
	double total = 0.0;
	for (uint64_t index = 0; index < length; ++index) {
		total += samples[index] * samples[index];
	}
	return total;
}

void normalizeSignal(double *samples, uint64_t length) {
	for (uint64_t index = 0; index < length; ++index) {
		samples[index] = samples[index] / 2.0;
	}
}

void biasMatrix(double *values, uint64_t rows, uint64_t columns) {
	for (uint64_t row = 0; row < rows; ++row) {
		for (uint64_t column = 0; column < columns; ++column) {
			values[row * columns + column] += (double)(row + column);
		}
	}
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
	message(FATAL_ERROR "native signal fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native signal fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
endif()

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
extern signal from "./libsignal_native.a" {
    signalEnergy(samples: number[]): number
    normalizeSignal(samples: ptr<number[]>): void
    biasMatrix(values: ptr<number[2, 2]>): void
}

function total(samples: number[]): number {
    let result: number = 0

    for (let sample: number of samples) {
        result = result + sample
    }

    return result
}

let samples: number[] = [2, 4, 6, 8]
let kernel: number[2, 2] = [
    [10, 20],
    [30, 40]
]

print(signal.signalEnergy(samples))
signal.normalizeSignal(&samples)
print(total(samples))
signal.biasMatrix(&kernel)
print(kernel[0, 0])
print(kernel[0, 1])
print(kernel[1, 0])
print(kernel[1, 1])
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "native signal processor program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected native signal processor artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS signalEnergy normalizeSignal biasMatrix yogi_array_native_number_buffer)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected native signal processor IR to contain ${symbol}")
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
	message(FATAL_ERROR "native signal processor executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "120\n10\n10\n21\n31\n42\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "native signal processor printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
