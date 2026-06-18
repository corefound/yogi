if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(SOURCE "${TEST_WORK_DIR}/main.io")
file(WRITE "${SOURCE}" "function grow(): number {\n    let scores: number[] = [1]\n    let i: number = 0\n\n    while (i < 3) {\n        scores.push(i)\n        i = i + 1\n    }\n\n    let total: number = 0\n\n    for (let j: number = 0; j < 4; j = j + 1) {\n        let scratch: number[] = [j]\n\n        if (j == 2) {\n            continue\n        }\n\n        total = total + scores[j] + scratch[0]\n\n        if (j == 3) {\n            break\n        }\n    }\n\n    return total\n}\n\nfunction getFirst(): number | undefined {\n    let scores: number[] = [100, 200]\n    return scores.at(0)\n}\n\nfunction popLast(): number | undefined {\n    let scores: number[] = [10, 20, 30]\n    return scores.pop()\n}\n\nlet value: number = grow()\nlet first: number | undefined = getFirst()\nlet last: number | undefined = popLast()\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "loops and methods pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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
		while.cond
		while.body
		for.cond
		for.body
		for.inc
		yogi_array_push
		yogi_array_pop
		yogi_array_at
		yogi_array_drop)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected loops/methods IR to contain ${symbol}")
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
	message(FATAL_ERROR "loops and methods executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(INVALID_DIR "${TEST_WORK_DIR}/invalid")
file(MAKE_DIRECTORY "${INVALID_DIR}")
set(INVALID_SOURCE "${INVALID_DIR}/main.io")
file(WRITE "${INVALID_SOURCE}" "let saved: number[] = [0]\n\nfunction save(scores: number[]): void {\n    saved = scores\n}\n\nfunction invalid(flag: boolean): number {\n    let local: number[] = [1, 2]\n\n    while (flag) {\n        save(local)\n        break\n    }\n\n    return local[0]\n}\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${INVALID_SOURCE}"
	WORKING_DIRECTORY "${INVALID_DIR}"
	RESULT_VARIABLE invalid_result
	OUTPUT_VARIABLE invalid_stdout
	ERROR_VARIABLE invalid_stderr
)

if(invalid_result EQUAL 0)
	message(FATAL_ERROR "loop move-state invalid program unexpectedly compiled\nstdout:\n${invalid_stdout}")
endif()

if(NOT invalid_stderr MATCHES "cannot use aggregate")
	message(FATAL_ERROR "loop move-state invalid program did not report use-after-move:\n${invalid_stderr}")
endif()
