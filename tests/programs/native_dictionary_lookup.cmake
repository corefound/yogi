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
	message(FATAL_ERROR "native dictionary lookup program requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/dictionary_native.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/dictionary_native.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libdictionary_native.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdint.h>
#include <string.h>

double lookupWord(const char **words, uint64_t length) {
	for (uint64_t index = 0; index < length; ++index) {
		if (strcmp(words[index], "banana") == 0) {
			return (double)(index + 1);
		}
	}

	return 0.0;
}

double totalLetters(const char **words, uint64_t length) {
	double total = 0.0;
	for (uint64_t index = 0; index < length; ++index) {
		total += (double)strlen(words[index]);
	}

	return total;
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
	message(FATAL_ERROR "native dictionary fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native dictionary fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
endif()

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
extern dictionary from "./libdictionary_native.a" {
    lookupWord(words: string[]): number
    totalLetters(words: string[]): number
}

const words: string[] = [
    "apple",
    "banana",
    "orange"
]
const empty: string[] = []

const result: number = dictionary.lookupWord(words)

print(result)
print(dictionary.totalLetters(words))
print(words.length)
print(words[0])
print(dictionary.lookupWord(empty))
print(empty.length)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "native dictionary lookup program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected native dictionary lookup artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS lookupWord totalLetters yogi_array_native_string_buffer yogi_array_native_string_buffer_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected native dictionary lookup IR to contain ${symbol}")
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
	message(FATAL_ERROR "native dictionary lookup executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "2\n17\n3\napple\n0\n0\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "native dictionary lookup printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
