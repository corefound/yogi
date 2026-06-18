if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(SOURCE "${TEST_WORK_DIR}/main.io")
file(WRITE "${SOURCE}" "let globalScores: number[] = [0]\n\nfunction returnAlias(): number[] {\n    let original: number[] = [4, 5]\n    let alias: number[] = original\n    return alias\n}\n\nfunction storeGlobal(): void {\n    let local: number[] = [7, 8]\n    let alias: number[] = local\n    globalScores = alias\n}\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "escape analysis pipeline compile failed:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
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

foreach(symbol
		returnAlias
		storeGlobal
		yogi_module_cleanup
		yogi_array_create
		yogi_array_set
		yogi_array_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected escape-analysis IR to contain ${symbol}")
	endif()
endforeach()

foreach(symbol
		yogi_array_init
		yogi_array_drop)
	if(ir MATCHES "${symbol}")
		message(FATAL_ERROR "escaped aggregate alias should not use local stack cleanup symbol ${symbol}")
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
	message(FATAL_ERROR "escape analysis generated executable failed:\n${run_stderr}")
endif()
