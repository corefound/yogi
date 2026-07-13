if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

function(expect_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/invalid/${case_name}")
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

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
function compareAscending(left: number, right: number): number {
    return left - right
}

function keepLarge(value: number): boolean {
    return value > 2
}

function sumWithIndex(total: number, value: number, index: number): number {
    return total + value + index
}

function digitsRight(total: number, value: number): number {
    return total * 10 + value
}

function pair(value: number): number[] {
    return [value, value + 10]
}

function mutatingPolicy(): number {
    let values: number[] = [2, 3]
    let lexical: number[] = [3, 1, 20]
    let pushed: number = values.push(4)
    let popped: number | undefined = values.pop()
    values.unshift(0, 1)
    let shifted: number | undefined = values.shift()
    values.reverse()
    values.fill(9, 1, 2)
    values.copyWithin(0, 2, 3)
    values.sort(compareAscending)
    let removed: number[] = values.splice(1, 1, 5, 6)
    lexical.sort()

    return pushed * 100000 + (shifted as number) * 1000 + values[1] * 100 + removed[0] * 10 + values.length + lexical[1]
}

function copyingPolicy(): number {
    let base: number[] = [3, 1, 20]
    let sorted: number[] = base.toSorted(compareAscending)
    let reversed: number[] = base.toReversed()
    let spliced: number[] = base.toSpliced(1, 1, 8, 9)
    let changed: number[] = base.with(0, 7)
    let sliced: number[] = base.slice(1, 3)
    let copied: number[] = base.copy()
    let combined: number[] = base.concat([4, 5], 6)

    return sorted[0] * 10000000 + sorted[1] * 1000000 + reversed[0] * 10000 + spliced[1] * 1000 + changed[0] * 100 + sliced[0] * 10 + copied.length + combined.length
}

function readonlyNonMutatingPolicy(): number {
    let frozen: readonly number[] = [3, 1]
    let sorted: number[] = frozen.toSorted(compareAscending)
    let reversed: number[] = frozen.toReversed()
    let sliced: number[] = frozen.slice(0, 2)

    return sorted[0] * 1000 + reversed[0] * 100 + sliced[1] * 10 + frozen[0]
}

function searchAndStringPolicy(): number {
    let values: number[] = [3, 1, 20, 1]
    let first: number | undefined = values.at(0)
    let hit: number = values.includes(20) ? 1 : 0

    print(values.join("-"))
    print(values.toString())
    print(values.toLocaleString())

    return values[0] * 1000 + hit * 100 + values.indexOf(1) * 10 + values.lastIndexOf(1)
}

function flatIteratorPolicy(): number {
    let nested: number[][] = [[1, 2], [3, 4]]
    let flat: number[] = nested.flat(1)
    let keys: number[] = flat.keys()
    let values: number[] = flat.values()
    let entries: [number, number][] = flat.entries()

    return flat[3] * 10000 + keys[2] * 1000 + values[1] * 100 + entries[2][0] * 10 + entries[2][1]
}

function callbackPolicy(): number {
    let values: number[] = [1, 2, 3]
    let mapped: number[] = values.map((value: number, index: number): number => value + index)
    let filtered: number[] = values.filter((value: number): boolean => value > 1)
    let hasLarge: boolean = values.some(keepLarge)
    let allPositive: boolean = values.every((value: number): boolean => value > 0)
    let found: number | undefined = values.find(keepLarge)
    let foundIndex: number = values.findIndex(keepLarge)
    let lastIndex: number = [1, 2, 3, 2].findLastIndex((value: number): boolean => value > 1)
    let reduced: number = values.reduce(sumWithIndex, 0)
    let reducedRight: number = values.reduceRight(digitsRight, 0)
    let expanded: number[] = values.flatMap(pair)
    let side: number = 0

    values.forEach((value: number): void => {
        side = side + value
    })

    return mapped[2] * 1000000 + filtered[0] * 100000 + (hasLarge ? 1 : 0) * 10000 + (allPositive ? 1 : 0) * 1000 + values[2] * 100 + foundIndex * 10 + lastIndex + reduced + reducedRight + expanded.length + side
}

function fixedReadPolicy(): number {
    let fixed: number[3] = [4, 5, 6]
    let value: number | undefined = fixed.at(1)
    let sliced: number[] = fixed.slice(0, 2)
    let keys: number[] = fixed.keys()

    return fixed[1] * 10000 + (fixed.includes(6) ? 1 : 0) * 1000 + sliced[1] * 10 + keys[2]
}

print(mutatingPolicy())
print(copyingPolicy())
print(readonlyNonMutatingPolicy())
print(searchAndStringPolicy())
print(flatIteratorPolicy())
print(callbackPolicy())
print(fixedReadPolicy())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array method policy compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array method policy artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_push
		yogi_array_pop
		yogi_array_shift
		yogi_array_unshift
		yogi_array_reverse
		yogi_array_fill
		yogi_array_copy_within
		yogi_array_sort
		yogi_array_splice
		yogi_array_to_spliced
		yogi_array_to_reversed
		yogi_array_with
		yogi_array_slice
		yogi_array_create
		yogi_array_clone
		yogi_array_append_array
		yogi_array_includes
		yogi_array_index_of
		yogi_array_last_index_of
		yogi_array_join
		yogi_array_to_string
		yogi_array_at_index
		yogi_array_flat
		yogi_array_keys
		yogi_array_values
		yogi_array_entries)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array method policy IR to contain ${symbol}")
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
	message(FATAL_ERROR "array method policy executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "300534\n13208719\n1113\n3-1-20-1\n3,1,20,1\n3,1,20,1\n3113\n42223\n5211665\n51052\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array method policy executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

expect_invalid(
	unsupported_method
	"let values: number[] = [1, 2]\nlet grouped: number[] = values.groupBy((value: number): number => value)\n"
	"not supported"
)

expect_invalid(
	strict_search_value
	"let values: number[] = [1, 2]\nlet hit: boolean = values.includes(\"1\")\n"
	"search value"
)

expect_invalid(
	strict_join_separator
	"let values: number[] = [1, 2]\nlet text: string = values.join(1)\n"
	"separator"
)

expect_invalid(
	strict_flat_depth
	"let values: number[][] = [[1], [2]]\nlet flat: number[] = values.flat(-1)\n"
	"non-negative integer"
)

expect_invalid(
	strict_callback_return
	"let values: number[] = [1, 2]\nlet ok: boolean = values.some((value: number): number => value)\n"
	"must return"
)

expect_invalid(
	strict_sort_comparator
	"let values: number[] = [1, 2]\nvalues.sort((left: number, right: number): boolean => true)\n"
	"must return"
)

expect_invalid(
	readonly_mutation
	"let values: readonly number[] = [1, 2]\nvalues.reverse()\n"
	"readonly"
)

expect_invalid(
	const_mutation
	"const values: number[] = [1, 2]\nvalues.sort()\n"
	"immutable"
)

expect_invalid(
	fixed_size_change
	"let values: number[3] = [1, 2, 3]\nvalues.push(4)\n"
	"fixed-size array"
)

expect_invalid(
	tuple_mutation
	"let pair: [number, string] = [1, \"ok\"]\npair.splice(0, 1)\n"
	"tuple"
)
