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
type Cell = number | string

function flatDefaultDepth(): number {
    let values: number[][] = [[1, 2], [3, 4]]
    let result: number[] = values.flat()

    return result[0] * 1000 + result[1] * 100 + result[2] * 10 + result[3]
}

function flatOneFromTwoLevels(): number {
    let values: number[][] = [[1, 2], [3, 4]]
    let result: number[] = values.flat(1)

    return result[0] * 1000 + result[1] * 100 + result[2] * 10 + result[3]
}

function flatOneFromThreeLevels(): number {
    let values: number[][][] = [
        [[1, 2]],
        [[3, 4]]
    ]
    let result: number[][] = values.flat(1)

    return result[0][0] * 1000 + result[0][1] * 100 + result[1][0] * 10 + result[1][1]
}

function flatTwoFromThreeLevels(): number {
    let values: number[][][] = [
        [[1, 2]],
        [[3, 4]]
    ]
    let result: number[] = values.flat(2)

    return result[0] * 1000 + result[1] * 100 + result[2] * 10 + result[3]
}

function flatZeroKeepsNesting(): number {
    let values: number[][] = [[1, 2], [3, 4]]
    let result: number[][] = values.flat(0)

    return result[0][0] * 1000 + result[0][1] * 100 + result[1][0] * 10 + result[1][1]
}

function flatDepthClamps(): number {
    let values: number[][] = [[1, 2], [3, 4]]
    let result: number[] = values.flat(99)

    return result[0] * 1000 + result[1] * 100 + result[2] * 10 + result[3]
}

function flatUnion(): number {
    let values: Cell[][] = [
        [1, "A"],
        [2, "B"]
    ]
    let result: Cell[] = values.flat(1)

    print(result[1] as string)
    print(result[3] as string)

    return (result[0] as number) * 10 + (result[2] as number)
}

function flatNestedUnionOne(): number {
    let values: Cell[][][] = [
        [[1, "A"]],
        [[2, "B"]]
    ]
    let one: Cell[][] = values.flat(1)

    print(one[0][1] as string)
    print(one[1][1] as string)

    return (one[0][0] as number) * 10 + (one[1][0] as number)
}

function flatNestedUnionTwo(): number {
    let values: Cell[][][] = [
        [[1, "A"]],
        [[2, "B"]]
    ]
    let two: Cell[] = values.flat(2)

    print(two[1] as string)
    print(two[3] as string)

    return (two[0] as number) * 10 + (two[2] as number)
}

function flatNonLiteralFallback(): number {
    let values: number[][][] = [
        [[1, 2]],
        [[3, 4]]
    ]
    let depth: number = 1
    let result: number[][] = values.flat(depth)

    return result[0][0] * 1000 + result[0][1] * 100 + result[1][0] * 10 + result[1][1]
}

print(flatDefaultDepth())
print(flatOneFromTwoLevels())
print(flatOneFromThreeLevels())
print(flatTwoFromThreeLevels())
print(flatZeroKeepsNesting())
print(flatDepthClamps())
print(flatUnion())
print(flatNestedUnionOne())
print(flatNestedUnionTwo())
print(flatNonLiteralFallback())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array flat depth semantics compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array flat depth artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
if(NOT ir MATCHES "yogi_array_flat")
	message(FATAL_ERROR "expected flat depth IR to call yogi_array_flat")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "array flat depth executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1234\n1234\n1234\n1234\n1234\n1234\nA\nB\n12\nA\nB\n12\nA\nB\n12\n1234\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array flat depth executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

function(expect_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/invalid/${case_name}")
	file(REMOVE_RECURSE "${case_dir}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source_file "${case_dir}/main.ts")
	file(WRITE "${source_file}" "${source}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source_file}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE invalid_result
		OUTPUT_VARIABLE invalid_stdout
		ERROR_VARIABLE invalid_stderr
	)

	if(invalid_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly compiled\nstdout:\n${invalid_stdout}")
	endif()

	if(NOT invalid_stderr MATCHES "${expected}")
		message(FATAL_ERROR "${case_name} did not report ${expected}:\n${invalid_stderr}")
	endif()
endfunction()

expect_invalid(
	"invalid_union_assignment"
	"type Cell = number | string\nlet values: Cell[][] = [[1, \"A\"], [2, \"B\"]]\nlet bad: number[] = values.flat(1)\n"
	"can only initialize"
)

expect_invalid(
	"invalid_depth_type"
	"let values: number[][] = [[1], [2]]\nlet result: number[] = values.flat(\"1\")\n"
	"depth must be"
)

expect_invalid(
	"negative_depth"
	"let values: number[][] = [[1], [2]]\nlet result: number[] = values.flat(-1)\n"
	"non-negative integer"
)

expect_invalid(
	"fractional_depth"
	"let values: number[][] = [[1], [2]]\nlet result: number[] = values.flat(1.5)\n"
	"non-negative integer"
)
