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
let moduleValues: number[] = [3, 1, 20]
let moduleSorted: number[] = moduleValues.sort()

function sumValues(): number {
    let values: number[] = [3, 1, 20]
    let total: number = 0

    for (let value: number of values) {
        total = total + value
    }

    return total
}

function sumKeys(): number {
    let values: number[] = [3, 1, 20]
    let total: number = 0

    for (let key: number of values.keys()) {
        total = total + key
    }

    return total
}

function sumMaterializedValues(): number {
    let values: number[] = [3, 1, 20]
    let total: number = 0

    for (let value: number of values.values()) {
        total = total + value
    }

    return total
}

function sumEntries(): number {
    let values: number[] = [3, 1, 20]
    let total: number = 0

    for (let entry: [number, number] of values.entries()) {
        total = total + entry[0] + entry[1]
    }

    return total
}

function destructuredEntries(): number {
    let values: number[] = [3, 1, 20]
    let total: number = 0

    for (let [index, value]: [number, number] of values.entries()) {
        total = total + index * 10 + value
    }

    return total
}

function breakAndContinue(): number {
    let values: number[] = [1, 2, 3, 4, 5]
    let total: number = 0

    for (let value: number of values) {
        if (value == 2) {
            continue
        }

        if (value == 5) {
            break
        }

        total = total + value
    }

    return total
}

function makeScores(): number[] {
    let scores: number[] = [4, 5, 6]
    return scores
}

function returnedIterable(): number {
    let total: number = 0

    for (let score: number of makeScores()) {
        total = total + score
    }

    return total
}

function sortAlias(): number {
    let values: number[] = [3, 1, 20]
    let sorted: number[] = values.sort()
    print(sorted)

    return sorted[0] * 100 + values[1] * 10 + sorted[2]
}

print(moduleSorted)
print(sumValues())
print(sumKeys())
print(sumMaterializedValues())
print(sumEntries())
print(destructuredEntries())
print(breakAndContinue())
print(returnedIterable())
print(sortAlias())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "iterator protocol pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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
		for.cond
		for.body
		for.inc
		yogi_array_length
		yogi_array_get
		yogi_array_keys
		yogi_array_values
		yogi_array_entries
		yogi_array_sort)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected iterator protocol IR to contain ${symbol}")
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
	message(FATAL_ERROR "iterator protocol executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "[1, 20, 3]\n24\n3\n24\n27\n54\n8\n15\n[1, 20, 3]\n303\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "iterator protocol executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

function(expect_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
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
	for_of_missing_type
	"let scores: number[] = [1, 2]\nfor (let score of scores) {\n    print(score)\n}\n"
	"Missing explicit type annotation"
)

expect_invalid(
	for_of_wrong_element_type
	"let scores: number[] = [1, 2]\nfor (let score: string of scores) {\n    print(score)\n}\n"
	"can only initialize"
)
