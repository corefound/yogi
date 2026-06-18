set(SOURCE "${TEST_WORK_DIR}/main.io")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")
file(WRITE "${SOURCE}" "let saved: number[] = [0]\n\nfunction earlyReturn(flag: boolean): number {\n    let scores: number[] = [1, 2, 3]\n\n    if (flag) {\n        return scores[0]\n    }\n\n    return 0\n}\n\nfunction returnMove(flag: boolean): number[] {\n    let scores: number[] = [1, 2, 3]\n\n    if (flag) {\n        return scores\n    }\n\n    return [0]\n}\n\nfunction nestedReturn(flag: boolean): void {\n    let a: number[] = [1]\n\n    if (flag) {\n        let b: number[] = [2]\n        return\n    }\n}\n\nfunction branchLocals(flag: boolean): void {\n    if (flag) {\n        let a: number[] = [1]\n    } else {\n        let b: number[] = [2]\n    }\n}\n\nfunction multipleOwners(flag: boolean): number[] {\n    let a: number[] = [1, 2, 3]\n\n    if (flag) {\n        return a\n    }\n\n    let b: number[] = [4, 5, 6]\n    return b\n}\n\nfunction aliasReturn(): number[] {\n    let original: number[] = [7, 8]\n    let alias: number[] = original\n    return alias\n}\n\nfunction save(scores: number[]): void {\n    saved = scores\n}\n\nfunction retainedByCallee(): void {\n    let local: number[] = [9]\n    save(local)\n}\n\nfunction sum(scores: number[]): number {\n    return scores[0]\n}\n\nfunction borrowedCall(): number {\n    let local: number[] = [10]\n    return sum(local)\n}\n\nlet one: number = earlyReturn(true)\nlet moved: number[] = returnMove(false)\nbranchLocals(true)\nretainedByCallee()\nlet borrowed: number = borrowedCall()\n")

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
set(EXECUTABLE_FILE "${TEST_WORK_DIR}/packages/.cache/bin/main")

if(NOT EXISTS "${IR_FILE}")
	message(FATAL_ERROR "expected IR file ${IR_FILE}")
endif()

if(NOT EXISTS "${EXECUTABLE_FILE}")
	message(FATAL_ERROR "expected executable ${EXECUTABLE_FILE}")
endif()

file(READ "${IR_FILE}" IR_CONTENT)

foreach(SYMBOL
	"_yogi_fn_main_io_earlyReturn"
	"_yogi_fn_main_io_returnMove"
	"_yogi_fn_main_io_nestedReturn"
	"_yogi_fn_main_io_branchLocals"
	"_yogi_fn_main_io_multipleOwners"
	"_yogi_fn_main_io_aliasReturn"
	"_yogi_fn_main_io_retainedByCallee"
	"_yogi_fn_main_io_borrowedCall"
)
	string(FIND "${IR_CONTENT}" "${SYMBOL}" SYMBOL_INDEX)
	if(SYMBOL_INDEX EQUAL -1)
		message(FATAL_ERROR "expected destructor scheduling IR to contain ${SYMBOL}")
	endif()
endforeach()

foreach(RUNTIME_SYMBOL "yogi_array_init" "yogi_array_drop" "yogi_array_create" "yogi_array_destroy")
	string(FIND "${IR_CONTENT}" "${RUNTIME_SYMBOL}" RUNTIME_INDEX)
	if(RUNTIME_INDEX EQUAL -1)
		message(FATAL_ERROR "expected destructor scheduling IR to call ${RUNTIME_SYMBOL}")
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
