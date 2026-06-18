if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
function grow(): number {
    let scores: number[] = [1]
    let i: number = 0

    while (i < 3) {
        scores.push(i)
        i = i + 1
    }

    let total: number = 0

    for (let j: number = 0; j < scores.length; j = j + 1) {
        let scratch: number[] = [j]

        if (j == 2) {
            continue
        }

        total = total + scores[j] + scratch[0]

        if (j == 3) {
            break
        }
    }

    return total
}

function getFirst(): number | undefined {
    let scores: number[] = [100, 200]
    return scores.at(0)
}

function popLast(): number | undefined {
    let scores: number[] = [10, 20, 30]
    return scores.pop()
}

function lengthDrivenSum(): number {
    let scores: number[] = [4, 5, 6]
    let total: number = 0

    for (let i: number = 0; i < scores.length; i = i + 1) {
        total = total + scores[i]
    }

    return total
}

function mutateAndMeasure(): number {
    let scores: number[] = [1, 2]
    let before: number = scores.length
    scores.push(3)
    let afterPush: number = scores.length
    scores.pop()
    let afterPop: number = scores.length

    return before * 100 + afterPush * 10 + afterPop
}

function tupleLength(): number {
    let pair: [number, string] = [7, "ready"]
    return pair.length
}

let value: number = grow()
let first: number | undefined = getFirst()
let last: number | undefined = popLast()

print(value)
print(lengthDrivenSum())
print(mutateAndMeasure())
print(tupleLength())
]=])

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
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

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
		yogi_array_length
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

set(expected_stdout "7\n15\n232\n2\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "loops and methods executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(INVALID_DIR "${TEST_WORK_DIR}/invalid")
file(MAKE_DIRECTORY "${INVALID_DIR}")
set(INVALID_SOURCE "${INVALID_DIR}/main.ts")
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

set(READONLY_LENGTH_DIR "${TEST_WORK_DIR}/readonly-length")
file(MAKE_DIRECTORY "${READONLY_LENGTH_DIR}")
set(READONLY_LENGTH_SOURCE "${READONLY_LENGTH_DIR}/main.ts")
file(WRITE "${READONLY_LENGTH_SOURCE}" "let scores: number[] = [1, 2]\nscores.length = 10\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${READONLY_LENGTH_SOURCE}"
	WORKING_DIRECTORY "${READONLY_LENGTH_DIR}"
	RESULT_VARIABLE readonly_length_result
	OUTPUT_VARIABLE readonly_length_stdout
	ERROR_VARIABLE readonly_length_stderr
)

if(readonly_length_result EQUAL 0)
	message(FATAL_ERROR "array length readonly invalid program unexpectedly compiled\nstdout:\n${readonly_length_stdout}")
endif()

if(NOT readonly_length_stderr MATCHES "readonly")
	message(FATAL_ERROR "array length readonly invalid program did not report readonly assignment:\n${readonly_length_stderr}")
endif()

if(NOT readonly_length_stderr MATCHES "length")
	message(FATAL_ERROR "array length readonly invalid program did not point at length:\n${readonly_length_stderr}")
endif()
