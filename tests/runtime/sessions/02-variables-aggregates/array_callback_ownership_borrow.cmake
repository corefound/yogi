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
function callbackValueIsNotMutableSourceBorrow(): number {
    let values: number[] = [1, 2]

    values.forEach((value: number): void => {
        value = value + 100
    })

    return values[0] * 10 + values[1]
}

function callbackCanMutateDifferentCapturedArray(): number {
    let source: number[] = [1, 2, 3]
    let sink: number[] = []

    source.forEach((value: number): void => {
        sink.push(value * 10)
    })

    return sink[0] * 100 + sink[1] * 10 + sink[2] + source.length
}

function mapReturnedAggregateOwnership(): number {
    let values: number[] = [1, 2]
    let pairs: number[][] = values.map((value: number): number[] => {
        return [value, value + 10]
    })

    return pairs[0][1] * 100 + pairs[1][1]
}

function flatMapReturnedAggregateOwnership(): number {
    let values: number[] = [1, 2]
    let expanded: number[] = values.flatMap((value: number): number[] => {
        return [value, value + 10]
    })

    return expanded[0] * 1000 + expanded[1] * 100 + expanded[2] * 10 + expanded[3]
}

function filterDoesNotMoveSource(): number {
    let values: number[] = [1, 2, 3]
    let filtered: number[] = values.filter((value: number): boolean => {
        return value > 1
    })

    return values[0] * 100 + filtered[0] * 10 + filtered.length
}

function sortComparatorBorrowsValues(): number {
    let values: number[] = [3, 1, 2]
    let sorted: number[] = values.toSorted((left: number, right: number): number => {
        return left - right
    })

    return values[0] * 100 + sorted[0] * 10 + sorted[2]
}

function reduceReturnedAggregateOwnership(): number {
    let values: number[] = [1, 2, 3]
    let seed: number[] = []
    let collected: number[] = values.reduce((acc: number[], value: number): number[] => {
        acc.push(value)
        return acc
    }, seed)

    return collected[0] * 100 + collected[1] * 10 + collected[2]
}

print(callbackValueIsNotMutableSourceBorrow())
print(callbackCanMutateDifferentCapturedArray())
print(mapReturnedAggregateOwnership())
print(flatMapReturnedAggregateOwnership())
print(filterDoesNotMoveSource())
print(sortComparatorBorrowsValues())
print(reduceReturnedAggregateOwnership())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array callback ownership/borrow pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array callback ownership/borrow artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_get
		yogi_array_push
		yogi_array_append_array)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array callback ownership/borrow IR to contain ${symbol}")
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
	message(FATAL_ERROR "array callback ownership/borrow executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "12\n1233\n1112\n2132\n122\n313\n123\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array callback ownership/borrow executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
		message(FATAL_ERROR "${case_name} did not report ${expected}:\nstdout:\n${invalid_stdout}\nstderr:\n${invalid_stderr}")
	endif()
endfunction()

expect_invalid(
	inline_source_push
	"let values: number[] = [1, 2]\nvalues.forEach((value: number): void => {\n    values.push(value)\n})\n"
	"cannot mutate source array"
)

expect_invalid(
	inline_source_element_assignment
	"let values: number[] = [1, 2]\nlet mapped: number[] = values.map((value: number): number => {\n    values[0] = value\n    return value\n})\n"
	"cannot mutate source array"
)

expect_invalid(
	named_source_push
	"let values: number[] = [1, 2]\nfunction retain(value: number): void {\n    values.push(value)\n}\nvalues.forEach(retain)\n"
	"cannot mutate source array"
)

expect_invalid(
	sort_comparator_source_push
	"let values: number[] = [2, 1]\nvalues.sort((left: number, right: number): number => {\n    values.push(3)\n    return left - right\n})\n"
	"cannot mutate source array"
)
