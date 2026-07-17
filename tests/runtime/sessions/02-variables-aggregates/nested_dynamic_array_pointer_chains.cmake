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
function nestedCellPointerSurvivesInnerPush(): number {
    let matrix: number[][] = [[1, 2], [3, 4]]
    let cell: ptr<number> = &matrix[0][1]

    matrix[0].push(5)
    cell = 99

    return matrix[0][1] * 10 + matrix[0][2]
}

function unrelatedRowMutationDoesNotInvalidatePointer(): number {
    let matrix: number[][] = [[1, 2], [3, 4]]
    let cell: ptr<number> = &matrix[0][1]

    matrix[1].pop()
    cell = 8

    return matrix[0][1] * 10 + matrix[1].length
}

function rowPointerCanMutateOriginalRow(): number {
    let matrix: number[][] = [[1, 2], [3, 4]]
    let row: ptr<number[]> = &matrix[0]

    row.push(5)

    return matrix[0][2]
}

function outerPushKeepsNestedPointer(): number {
    let matrix: number[][] = [[1, 2], [3, 4]]
    let cell: ptr<number> = &matrix[0][1]

    matrix.push([5, 6])
    cell = 7

    return matrix[0][1] * 10 + matrix[2][1]
}

print(nestedCellPointerSurvivesInnerPush())
print(unrelatedRowMutationDoesNotInvalidatePointer())
print(rowPointerCanMutateOriginalRow())
print(outerPushKeepsNestedPointer())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "nested dynamic array pointer chain pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected nested dynamic array pointer chain artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_get
		yogi_array_push)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected nested dynamic array pointer chain IR to contain ${symbol}")
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
	message(FATAL_ERROR "nested dynamic array pointer chain executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "995\n81\n5\n76\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "nested dynamic array pointer chain executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
	inner_pop_invalidates_nested_cell_pointer
	"let matrix: number[][] = [[1, 2], [3, 4]]\nlet cell: ptr<number> = &matrix[0][1]\nmatrix[0].pop()\ncell = 99\n"
	"matrix\\[0\\].*removed"
)

expect_invalid(
	inner_shift_invalidates_nested_cell_pointer
	"let matrix: number[][] = [[1, 2], [3, 4]]\nlet cell: ptr<number> = &matrix[0][0]\nmatrix[0].shift()\ncell = 99\n"
	"matrix\\[0\\].*removed"
)

expect_invalid(
	row_replacement_invalidates_nested_cell_pointer
	"let matrix: number[][] = [[1, 2], [3, 4]]\nlet cell: ptr<number> = &matrix[0][1]\nmatrix[0] = [7, 8]\ncell = 99\n"
	"storage under 'matrix\\[0\\]' was replaced"
)

expect_invalid(
	matrix_replacement_invalidates_nested_cell_pointer
	"let matrix: number[][] = [[1, 2], [3, 4]]\nlet cell: ptr<number> = &matrix[0][1]\nmatrix = [[7, 8], [9, 10]]\ncell = 99\n"
	"storage under 'matrix\\[0\\]' was replaced"
)
