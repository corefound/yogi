if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(VALID_SOURCE "${TEST_WORK_DIR}/main.io")
file(WRITE "${VALID_SOURCE}" "let raw: any = 10\nlet value: number = raw as number\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${VALID_SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE valid_compile_result
	OUTPUT_VARIABLE valid_compile_stdout
	ERROR_VARIABLE valid_compile_stderr
)

if(NOT valid_compile_result EQUAL 0)
	message(FATAL_ERROR "valid pipeline compile failed:\n${valid_compile_stderr}")
endif()

set(VALID_EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/yogi")
set(VALID_IR "${TEST_WORK_DIR}/packages/.cache/modules/main.io/main.ll")
set(VALID_OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.io/main.o")

if(NOT EXISTS "${VALID_EXECUTABLE}")
	message(FATAL_ERROR "expected executable was not generated: ${VALID_EXECUTABLE}")
endif()

if(NOT EXISTS "${VALID_IR}")
	message(FATAL_ERROR "expected LLVM IR was not generated: ${VALID_IR}")
endif()

if(NOT EXISTS "${VALID_OBJECT}")
	message(FATAL_ERROR "expected object file was not generated: ${VALID_OBJECT}")
endif()

file(READ "${VALID_IR}" valid_ir)

if(NOT valid_ir MATCHES "yogi_any_from_number")
	message(FATAL_ERROR "expected valid IR to call yogi_any_from_number")
endif()

if(NOT valid_ir MATCHES "yogi_any_to_number")
	message(FATAL_ERROR "expected valid IR to call yogi_any_to_number")
endif()

execute_process(
	COMMAND "${VALID_EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE valid_run_result
	OUTPUT_VARIABLE valid_run_stdout
	ERROR_VARIABLE valid_run_stderr
)

if(NOT valid_run_result EQUAL 0)
	message(FATAL_ERROR "valid generated executable failed:\n${valid_run_stderr}")
endif()

set(INVALID_DIR "${TEST_WORK_DIR}/invalid")
file(MAKE_DIRECTORY "${INVALID_DIR}")
set(INVALID_SOURCE "${INVALID_DIR}/main.io")
file(WRITE "${INVALID_SOURCE}" "let raw: any = 10\nlet text: string = raw as string\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${INVALID_SOURCE}"
	WORKING_DIRECTORY "${INVALID_DIR}"
	RESULT_VARIABLE invalid_compile_result
	OUTPUT_VARIABLE invalid_compile_stdout
	ERROR_VARIABLE invalid_compile_stderr
)

if(NOT invalid_compile_result EQUAL 0)
	message(FATAL_ERROR "invalid-cast program should compile before runtime validation:\n${invalid_compile_stderr}")
endif()

set(INVALID_EXECUTABLE "${INVALID_DIR}/packages/.cache/yogi")

execute_process(
	COMMAND "${INVALID_EXECUTABLE}"
	WORKING_DIRECTORY "${INVALID_DIR}"
	RESULT_VARIABLE invalid_run_result
	OUTPUT_VARIABLE invalid_run_stdout
	ERROR_VARIABLE invalid_run_stderr
)

if(invalid_run_result EQUAL 0)
	message(FATAL_ERROR "invalid any cast unexpectedly succeeded")
endif()

if(NOT invalid_run_stderr MATCHES "cannot cast value of type 'number' to 'string'")
	message(FATAL_ERROR "invalid any cast did not report the expected runtime error:\n${invalid_run_stderr}")
endif()
