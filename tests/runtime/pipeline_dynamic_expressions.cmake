if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(SOURCE "${TEST_WORK_DIR}/main.io")
file(WRITE "${SOURCE}" "function pickName(enabled: boolean, maybe: string | undefined): string {\n  let label: string = enabled ? \"yes\" : \"no\"\n  maybe ??= label\n  let value: string = maybe ?? label\n  return value\n}\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "dynamic expression pipeline compile failed:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/yogi")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.io/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.io/main.o")

if(NOT EXISTS "${EXECUTABLE}")
	message(FATAL_ERROR "expected executable was not generated: ${EXECUTABLE}")
endif()

if(NOT EXISTS "${IR}")
	message(FATAL_ERROR "expected LLVM IR was not generated: ${IR}")
endif()

if(NOT EXISTS "${OBJECT}")
	message(FATAL_ERROR "expected object file was not generated: ${OBJECT}")
endif()

file(READ "${IR}" ir)

if(NOT ir MATCHES "cond\\.then")
	message(FATAL_ERROR "expected conditional expression lowering blocks in IR")
endif()

if(NOT ir MATCHES "nullish\\.present")
	message(FATAL_ERROR "expected nullish coalescing lowering blocks in IR")
endif()

if(NOT ir MATCHES "nullishassign\\.assign")
	message(FATAL_ERROR "expected nullish assignment lowering blocks in IR")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "dynamic expression generated executable failed:\n${run_stderr}")
endif()
