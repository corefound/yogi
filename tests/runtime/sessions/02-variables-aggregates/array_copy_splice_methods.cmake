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
function fillCopyWithinBatch(): number {
    let scores: number[] = [1, 2, 3, 4]
    scores.fill(9, 1, 3)
    scores.copyWithin(0, 2, 4)

    return scores[0] * 1000 + scores[1] * 100 + scores[2] * 10 + scores[3]
}

function concatBatch(): number {
    let left: number[] = [1, 2]
    let right: number[] = [3, 4]
    let combined: number[] = left.concat(right, 5)

    return combined[0] * 10000 + combined[2] * 1000 + combined[4] * 100 + left.length
}

function toReversedBatch(): number {
    let scores: number[] = [1, 2, 3, 4]
    let reversed: number[] = scores.toReversed()

    return reversed[0] * 1000 + reversed[3] * 100 + scores[0] * 10 + scores.length
}

function spliceBatch(): number {
    let scores: number[] = [1, 2, 3, 4, 5]
    let removed: number[] = scores.splice(1, 2, 8, 9)

    return scores[1] * 10000 + scores[2] * 1000 + removed[0] * 100 + removed[1] * 10 + scores.length
}

function toSplicedBatch(): number {
    let scores: number[] = [1, 2, 3, 4]
    let copy: number[] = scores.toSpliced(1, 2, 8, 9)

    return copy[1] * 10000 + copy[2] * 1000 + scores[1] * 100 + scores.length
}

print(fillCopyWithinBatch())
print(concatBatch())
print(toReversedBatch())
print(spliceBatch())
print(toSplicedBatch())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array copy/splice pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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
		yogi_array_fill
		yogi_array_copy_within
		yogi_array_clone
		yogi_array_append_array
		yogi_array_splice
		yogi_array_to_reversed
		yogi_array_to_spliced
		yogi_array_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array copy/splice IR to contain ${symbol}")
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
	message(FATAL_ERROR "array copy/splice executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "9494\n13502\n4114\n89235\n89204\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array copy/splice executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
	readonly_fill
	"let scores: readonly number[] = [1, 2]\nscores.fill(9)\n"
	"readonly"
)

expect_invalid(
	bad_concat_value
	"let scores: number[] = [1, 2]\nlet merged: number[] = scores.concat(\"bad\")\n"
	"values or arrays"
)

expect_invalid(
	tuple_splice
	"let pair: [number, string] = [1, \"ready\"]\npair.splice(0, 1)\n"
	"tuple"
)
