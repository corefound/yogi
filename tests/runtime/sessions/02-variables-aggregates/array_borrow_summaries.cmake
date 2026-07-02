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

function firstRow(matrix: number[2, 3]): number[3] {
    return matrix[0]
}

function secondRow(matrix: number[2, 3]): number[3] {
    return matrix[1]
}

function rowAt(matrix: number[2, 3], index: number): number[3] {
    return matrix[index]
}

function pixelAt(image: number[2, 2, 3], row: number, col: number): number[3] {
    return image[row, col]
}

function blockAt(image: number[2, 2, 3], index: number): number[2, 3] {
    return image[index]
}

function localRowCopy(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[0].copy()
}

function firstRowCopy(matrix: number[2, 3]): number[3] {
    return matrix[0].copy()
}

function unionSecondRow(grid: Cell[2, 2]): Cell[2] {
    return grid[1]
}

function forwardRow(matrix: number[2, 3]): number[3] {
    return firstRow(matrix)
}

let matrixA: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let rowA: number[3] = firstRow(matrixA)
print(rowA[0])
print(rowA[1])
print(rowA[2])

let matrixB: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let rowB: number[3] = firstRow(matrixB)
rowB[2] = 99
print(matrixB[0, 2])

let matrixC: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let rowC: number[3] = secondRow(matrixC)
print(rowC[0])
print(rowC[1])
print(rowC[2])

let matrixD: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let rowD: number[3] = rowAt(matrixD, 1)
print(rowD[0])
print(rowD[1])
print(rowD[2])

let imageA: number[2, 2, 3] = [
    [
        [1, 2, 3],
        [4, 5, 6]
    ],
    [
        [7, 8, 9],
        [10, 11, 12]
    ]
]
let pixel: number[3] = pixelAt(imageA, 1, 0)
print(pixel[0])
print(pixel[1])
print(pixel[2])

let imageB: number[2, 2, 3] = [
    [
        [1, 2, 3],
        [4, 5, 6]
    ],
    [
        [7, 8, 9],
        [10, 11, 12]
    ]
]
let block: number[2, 3] = blockAt(imageB, 1)
print(block[0, 0])
print(block[0, 1])
print(block[0, 2])
print(block[1, 0])
print(block[1, 1])
print(block[1, 2])

let localOwned: number[3] = localRowCopy()
localOwned[2] = 99
print(localOwned[2])

let matrixE: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let copied: number[3] = firstRowCopy(matrixE)
copied[2] = 99
print(matrixE[0, 2])
print(copied[2])

let grid: Cell[2, 2] = [
    [1, "A"],
    ["B", 2]
]
let unionRow: Cell[2] = unionSecondRow(grid)
print(unionRow[0] as string)
print(unionRow[1] as number)
unionRow[0] = 99
unionRow[1] = "C"
print(grid[1, 0] as number)
print(grid[1, 1] as string)

let matrixF: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let forwarded: number[3] = forwardRow(matrixF)
forwarded[0] = 99
print(matrixF[0, 0])
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array borrow summaries compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array borrow summaries artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
if(NOT ir MATCHES "yogi_array_view")
	message(FATAL_ERROR "expected borrowed array returns to lower through yogi_array_view")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "array borrow summaries executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1\n2\n3\n99\n4\n5\n6\n4\n5\n6\n7\n8\n9\n7\n8\n9\n10\n11\n12\n99\n3\n99\nB\n2\n99\nC\n99\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array borrow summaries executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

function(expect_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
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

function(expect_runtime_error case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
	file(REMOVE_RECURSE "${case_dir}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source_file "${case_dir}/main.ts")
	file(WRITE "${source_file}" "${source}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source_file}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE compile_case_result
		OUTPUT_VARIABLE compile_case_stdout
		ERROR_VARIABLE compile_case_stderr
	)

	if(NOT compile_case_result EQUAL 0)
		message(FATAL_ERROR "${case_name} did not compile before runtime range check:\nstdout:\n${compile_case_stdout}\nstderr:\n${compile_case_stderr}")
	endif()

	set(case_executable "${case_dir}/packages/.cache/bin/main")
	execute_process(
		COMMAND "${case_executable}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE range_result
		OUTPUT_VARIABLE range_stdout
		ERROR_VARIABLE range_stderr
	)

	if(range_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly ran successfully\nstdout:\n${range_stdout}")
	endif()

	if(NOT range_stderr MATCHES "${expected}")
		message(FATAL_ERROR "${case_name} did not report ${expected}:\n${range_stderr}")
	endif()
endfunction()

expect_invalid(
	borrowed_slice_return_from_local
	"function bad(): number[3] {\n    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\n    return matrix[0]\n}\n"
	"cannot return borrowed slice from local fixed-shape array.*matrix"
)

expect_invalid(
	readonly_returned_borrow_assignment
	"function firstRow(matrix: number[2, 3]): number[3] {\n    return matrix[0]\n}\nconst matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet row: number[3] = firstRow(matrix)\nrow[2] = 99\n"
	"cannot mutate borrowed view.*row.*readonly source.*matrix"
)

expect_invalid(
	union_returned_borrow_invalid_assignment
	"type Cell = number | string\nfunction secondRow(grid: Cell[2, 2]): Cell[2] {\n    return grid[1]\n}\nlet grid: Cell[2, 2] = [[1, \"A\"], [\"B\", 2]]\nlet row: Cell[2] = secondRow(grid)\nrow[0] = true\n"
	"cannot assign value of type.*boolean"
)

expect_runtime_error(
	returned_dynamic_row_out_of_bounds
	"function rowAt(matrix: number[2, 3], index: number): number[3] {\n    return matrix[index]\n}\nlet matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet bad: number[3] = rowAt(matrix, 5)\nprint(bad[0])\n"
	"main.ts:[0-9]+:.*runtime range error: array subscript.*5.*length 2"
)
