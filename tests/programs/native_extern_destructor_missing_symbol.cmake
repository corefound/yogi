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
	message(FATAL_ERROR "native extern destructor missing-symbol program requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/missing_destructor.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/missing_destructor.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libmissing_destructor.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdlib.h>

typedef struct NativeResource {
	double id;
} NativeResource;

NativeResource *create(double id) {
	NativeResource *resource = (NativeResource *)malloc(sizeof(NativeResource));
	if (!resource) {
		return NULL;
	}

	resource->id = id;
	return resource;
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
	message(FATAL_ERROR "native extern destructor missing-symbol fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native extern destructor missing-symbol fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
endif()

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
struct NativeResource {
    id: number
}

extern algorithm from "./libmissing_destructor.a" {
    create(id: number): ptr<NativeResource>
    destructor(resource: ptr<void>): void
}

function run(): void {
    const resource: ptr<NativeResource> = algorithm.create(1)
}

run()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(compile_result EQUAL 0)
	message(FATAL_ERROR "native extern destructor missing-symbol program unexpectedly compiled:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(combined_output "${compile_stdout}\n${compile_stderr}")
if(NOT combined_output MATCHES "destructor")
	message(FATAL_ERROR "native extern destructor missing-symbol failure did not mention destructor:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()
