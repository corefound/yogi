set(SOURCE "${TEST_WORK_DIR}/main.io")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")
file(WRITE "${SOURCE}" "let saved: number[] = [0]\n\nfunction makeScores(): number[] {\n    let scores: number[] = [1, 2, 3]\n    return scores\n}\n\nfunction sum(scores: number[]): number {\n    return scores[0] + scores[1]\n}\n\nfunction touch(scores: number[]): void {\n    scores[0] = scores[0] + 1\n}\n\nfunction save(scores: number[]): void {\n    saved = scores\n}\n\nfunction borrowOnly(): number {\n    let local: number[] = [1, 2, 3]\n    return sum(local)\n}\n\nfunction mutateOnly(): void {\n    let local: number[] = [1, 2, 3]\n    touch(local)\n}\n\nfunction retainLocal(): void {\n    let local: number[] = [1, 2, 3]\n    let alias: number[] = local\n    save(alias)\n}\n\nlet result: number[] = makeScores()\nlet total: number = sum(result)\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE YOGI_RESULT
	OUTPUT_VARIABLE YOGI_OUTPUT
	ERROR_VARIABLE YOGI_ERROR
)

if(NOT YOGI_RESULT EQUAL 0)
	message(FATAL_ERROR "yogi pipeline failed\nstdout:\n${YOGI_OUTPUT}\nstderr:\n${YOGI_ERROR}")
endif()

set(IR_FILE "${TEST_WORK_DIR}/packages/.cache/modules/main.io/main.ll")
set(EXECUTABLE_FILE "${TEST_WORK_DIR}/packages/.cache/yogi")

if(NOT EXISTS "${IR_FILE}")
	message(FATAL_ERROR "expected IR file ${IR_FILE}")
endif()

if(NOT EXISTS "${EXECUTABLE_FILE}")
	message(FATAL_ERROR "expected executable ${EXECUTABLE_FILE}")
endif()

file(READ "${IR_FILE}" IR_CONTENT)

foreach(SYMBOL "_yogi_fn_main_io_makeScores" "_yogi_fn_main_io_sum" "_yogi_fn_main_io_touch" "_yogi_fn_main_io_save" "_yogi_fn_main_io_borrowOnly" "_yogi_fn_main_io_retainLocal")
	string(FIND "${IR_CONTENT}" "${SYMBOL}" SYMBOL_INDEX)
	if(SYMBOL_INDEX EQUAL -1)
		message(FATAL_ERROR "expected function ownership IR to contain ${SYMBOL}")
	endif()
endforeach()

foreach(RUNTIME_SYMBOL
		"yogi_array_create"
		"yogi_array_init"
		"yogi_array_drop"
		"yogi_array_destroy"
		"yogi_memory_push_context"
		"yogi_memory_pop_context")
	string(FIND "${IR_CONTENT}" "${RUNTIME_SYMBOL}" RUNTIME_INDEX)
	if(RUNTIME_INDEX EQUAL -1)
		message(FATAL_ERROR "expected function ownership IR to call ${RUNTIME_SYMBOL}")
	endif()
endforeach()

execute_process(
	COMMAND "${EXECUTABLE_FILE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE EXEC_RESULT
	OUTPUT_VARIABLE EXEC_OUTPUT
	ERROR_VARIABLE EXEC_ERROR
)

if(NOT EXEC_RESULT EQUAL 0)
	message(FATAL_ERROR "generated executable failed\nstdout:\n${EXEC_OUTPUT}\nstderr:\n${EXEC_ERROR}")
endif()
