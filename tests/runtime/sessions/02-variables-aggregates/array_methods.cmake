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
function mutationBatch(): number {
    let scores: number[] = [2, 3]
    scores.unshift(0, 1)
    scores.reverse()
    scores.shift()

    return scores[0] * 100 + scores[1] * 10 + scores.length
}

function searchBatch(): number {
    let scores: number[] = [10, 20, 30, 20]
    let hit: number = scores.includes(20) ? 1 : 0
    let miss: number = scores.includes(99) ? 1 : 0
    let first: number = scores.indexOf(20)
    let last: number = scores.lastIndexOf(20)
    let from: number = scores.indexOf(20, 2)

    return hit * 10000 + miss * 1000 + first * 100 + last * 10 + from
}

function sliceBatch(): number {
    let scores: number[] = [1, 2, 3, 4, 5]
    let middle: number[] = scores.slice(1, -1)

    return middle[0] * 100 + middle[2] * 10 + middle.length
}

function negativeAtBatch(): void {
    let scores: number[] = [5, 6, 7]
    let last: number | undefined = scores.at(-1)
}

print(mutationBatch())
print(searchBatch())
print(sliceBatch())
negativeAtBatch()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array methods pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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
		yogi_array_shift
		yogi_array_unshift
		yogi_array_includes
		yogi_array_index_of
		yogi_array_last_index_of
		yogi_array_reverse
		yogi_array_slice
		yogi_array_at_index
		yogi_array_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array methods IR to contain ${symbol}")
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
	message(FATAL_ERROR "array methods executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "213\n10133\n243\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array methods executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
	readonly_reverse
	"let scores: readonly number[] = [1, 2]\nscores.reverse()\n"
	"readonly"
)

expect_invalid(
	wrong_search_type
	"let scores: number[] = [1, 2]\nlet found: boolean = scores.includes(\"bad\")\n"
	"search value"
)

expect_invalid(
	tuple_mutation
	"let pair: [number, string] = [1, \"ready\"]\npair.unshift(0)\n"
	"tuple"
)
