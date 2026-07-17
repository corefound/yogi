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
	message(FATAL_ERROR "native reading calibrator program requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/reading_native.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/reading_native.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libreading_native.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdint.h>

typedef struct {
	double value;
	double offset;
} NativeReading;

double weightedTotal(NativeReading *readings, uint64_t length) {
	double total = 0.0;
	for (uint64_t index = 0; index < length; ++index) {
		total += readings[index].value * readings[index].offset;
	}
	return total;
}

void calibrate(NativeReading *readings, uint64_t length) {
	for (uint64_t index = 0; index < length; ++index) {
		readings[index].value += readings[index].offset;
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
	message(FATAL_ERROR "native reading fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native reading fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
endif()

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
struct Reading {
    value: number
    offset: number
}

extern reading from "./libreading_native.a" {
    weightedTotal(readings: Reading[]): number
    calibrate(readings: ptr<Reading[]>): void
}

function sumValues(readings: Reading[]): number {
    let total: number = 0

    for (let reading: Reading of readings) {
        total = total + reading.value
    }

    return total
}

let batch: Reading[] = [
    { value: 10, offset: 2 },
    { value: 20, offset: 3 },
    { value: 30, offset: 4 }
]

print(reading.weightedTotal(batch))
reading.calibrate(&batch)
print(batch[0].value)
print(batch[1].value)
print(batch[2].value)
print(sumValues(batch))
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "native reading calibrator program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected native reading calibrator artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS weightedTotal calibrate native.struct.fill native.struct.copyback)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected native reading calibrator IR to contain ${symbol}")
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
	message(FATAL_ERROR "native reading calibrator executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "200\n12\n23\n34\n69\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "native reading calibrator printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
