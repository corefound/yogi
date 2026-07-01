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
let vec: number[3] = [10, 20, 30]
let values: number[] = [1, 2, 3]
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let tensor: number[2, 2, 2] = [
    [
        [1, 2],
        [3, 4]
    ],
    [
        [5, 6],
        [7, 8]
    ]
]
let row: number[3] = matrix[1]
let matrixValue: number = matrix[1, 2]
let tensorValue: number = tensor[1, 0, 1]
let image: number[2, 2, 3] = [
    [
        [1, 2, 3],
        [4, 5, 6]
    ],
    [
        [7, 8, 9],
        [10, 11, 12]
    ]
]
let pixel: number[3] = image[1, 0]
let r: number = 1
let dynamicRow: number[3] = matrix[r]
type Cell = number | string
let grid: Cell[2, 2] = [
    [1, "A"],
    ["B", 2]
]
let unionRow: Cell[2] = grid[1]
const frozenMatrix: number[2, 3] = [
    [11, 12, 13],
    [14, 15, 16]
]
let frozenRow: number[3] = frozenMatrix[1]
let frozenDynamicIndex: number = 0
let frozenDynamicRow: number[3] = frozenMatrix[frozenDynamicIndex]

function returnedRowCopy(): number[3] {
    let localMatrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return localMatrix[1]
}

function returnedPixelCopy(): number[3] {
    let localImage: number[2, 2, 3] = [
        [
            [1, 2, 3],
            [4, 5, 6]
        ],
        [
            [7, 8, 9],
            [10, 11, 12]
        ]
    ]

    return localImage[1, 0]
}

function returnedBlockCopy(): number[2, 3] {
    let localImage: number[2, 2, 3] = [
        [
            [1, 2, 3],
            [4, 5, 6]
        ],
        [
            [7, 8, 9],
            [10, 11, 12]
        ]
    ]

    return localImage[1]
}

function returnedUnionRowCopy(): Cell[2] {
    let localGrid: Cell[2, 2] = [
        [1, "A"],
        ["B", 2]
    ]

    return localGrid[1]
}

function returnedDynamicRowCopy(index: number): number[3] {
    let localMatrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return localMatrix[index]
}

function returnedConstRowCopy(): number[3] {
    const localMatrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return localMatrix[1]
}

function returnedFullIndexValue(): number {
    let localMatrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return localMatrix[1, 2]
}

matrix[0, 1] = 9
row[2] = 99
pixel[1] = 88
unionRow[0] = 100
unionRow[1] = "C"
let ownedRow: number[3] = returnedRowCopy()
ownedRow[2] = 199
let ownedPixel: number[3] = returnedPixelCopy()
let ownedBlock: number[2, 3] = returnedBlockCopy()
let ownedUnionRow: Cell[2] = returnedUnionRowCopy()
let ownedDynamicRow: number[3] = returnedDynamicRowCopy(1)
let ownedConstRow: number[3] = returnedConstRowCopy()
ownedConstRow[2] = 299

print(vec[2])
print(values[2])
print(matrixValue)
print(row[0])
print(tensorValue)
print(matrix[0, 1])
print(matrix[1, 2])
print(pixel[0])
print(pixel[2])
print(image[1, 0, 1])
print(dynamicRow[2])
print(grid[1, 0] as number)
print(grid[1, 1] as string)
print(frozenRow[2])
print(frozenDynamicRow[1])
print(ownedRow[0])
print(ownedRow[1])
print(ownedRow[2])
print(ownedPixel[0])
print(ownedPixel[1])
print(ownedPixel[2])
print(ownedBlock[0, 0])
print(ownedBlock[0, 1])
print(ownedBlock[0, 2])
print(ownedBlock[1, 0])
print(ownedBlock[1, 1])
print(ownedBlock[1, 2])
print(ownedUnionRow[0] as string)
print(ownedUnionRow[1] as number)
print(ownedDynamicRow[0])
print(ownedDynamicRow[1])
print(ownedDynamicRow[2])
print(ownedConstRow[2])
print(returnedFullIndexValue())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array indexing semantics compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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
		yogi_array_get
		yogi_array_create
		yogi_array_view
		yogi_runtime_abort_range)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array indexing IR to contain ${symbol}")
	endif()
endforeach()

if(NOT ir MATCHES "yogi_array_create\\(i64 6\\)")
	message(FATAL_ERROR "expected fixed 2D array to lower as a flat six-element descriptor:\n${ir}")
endif()

if(NOT ir MATCHES "array\\.shape\\.")
	message(FATAL_ERROR "expected fixed-shape indexing to use row-major shape lowering blocks:\n${ir}")
endif()

if(ir MATCHES "array\\.shape\\.slice\\.index")
	message(FATAL_ERROR "fixed-shape partial indexing still appears to copy slice elements:\n${ir}")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "array indexing executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "30\n3\n6\n4\n6\n9\n99\n7\n9\n88\n99\n100\nC\n16\n12\n4\n5\n199\n7\n8\n9\n7\n8\n9\n10\n11\n12\nB\n2\n4\n5\n6\n299\n6\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array indexing executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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

function(expect_runtime_error case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
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
	fixed_size_too_few
	"let vec: number[3] = [1, 2]\n"
	"fixed-size array.*expects.*3.*got.*2"
)

expect_invalid(
	invalid_nested_shape_syntax
	"let bad: number[[2, 3]] = [[1, 2, 3], [4, 5, 6]]\n"
	"invalid array shape syntax"
)

expect_invalid(
	fixed_shape_wrong_outer_length
	"let matrix: number[2, 3] = [[1, 2, 3]]\n"
	"fixed-shape array.*expects.*dimension.*0.*length.*2.*got.*1"
)

expect_invalid(
	fixed_shape_wrong_inner_length
	"let matrix: number[2, 3] = [[1, 2, 3], [4, 5]]\n"
	"fixed-shape array.*expects.*dimension.*1.*length.*3.*got.*2"
)

expect_invalid(
	fixed_shape_element_type_mismatch
	"let matrix: number[2, 3] = [[1, 2, 3], [4, \"bad\", 6]]\n"
	"expected.*number.*got.*string"
)

expect_invalid(
	dynamic_array_coordinate_index
	"let values: number[] = [1, 2, 3]\nlet value: number = values[0, 1]\n"
	"expects.*1.*index.*got.*2"
)

expect_invalid(
	fixed_array_too_many_indices
	"let vec: number[3] = [1, 2, 3]\nlet value: number = vec[0, 1]\n"
	"expects at most.*1.*got.*2"
)

expect_invalid(
	fixed_array_constant_out_of_bounds
	"let vec: number[3] = [1, 2, 3]\nlet value: number = vec[3]\n"
	"out of bounds.*dimension.*0.*size.*3"
)

expect_invalid(
	fixed_shape_dimension_zero_out_of_bounds
	"let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet value: number = matrix[2, 0]\n"
	"out of bounds.*dimension.*0.*size.*2"
)

expect_invalid(
	fixed_shape_dimension_one_out_of_bounds
	"let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet value: number = matrix[1, 3]\n"
	"out of bounds.*dimension.*1.*size.*3"
)

expect_invalid(
	fixed_shape_too_many_indices
	"let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet value: number = matrix[1, 2, 0]\n"
	"expects at most.*2.*got.*3"
)

expect_invalid(
	fixed_array_push
	"let vec: number[3] = [1, 2, 3]\nvec.push(4)\n"
	"size-changing method.*push.*fixed-size array"
)

expect_invalid(
	union_view_invalid_assignment
	"type Cell = number | string\nlet grid: Cell[2, 2] = [[1, \"A\"], [\"B\", 2]]\nlet row: Cell[2] = grid[1]\nrow[0] = true\n"
	"cannot assign value of type.*boolean"
)

expect_invalid(
	returned_union_view_invalid_assignment
	"type Cell = number | string\nfunction getRow(): Cell[2] {\n    let grid: Cell[2, 2] = [[1, \"A\"], [\"B\", 2]]\n    return grid[1]\n}\nlet row: Cell[2] = getRow()\nrow[0] = true\n"
	"cannot assign value of type.*boolean"
)

expect_invalid(
	readonly_borrowed_view_assignment
	"const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet row: number[3] = matrix[1]\nrow[0] = 99\n"
	"cannot mutate borrowed view.*row.*readonly source.*matrix"
)

expect_invalid(
	direct_const_fixed_shape_assignment
	"const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nmatrix[1, 2] = 99\n"
	"cannot mutate.*matrix.*const|cannot mutate.*matrix.*immutable"
)

expect_invalid(
	nested_readonly_borrowed_view_assignment
	"const image: number[2, 2, 3] = [[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]]\nlet row: number[2, 3] = image[1]\nlet pixel: number[3] = row[0]\npixel[1] = 88\n"
	"cannot mutate borrowed view.*pixel.*readonly source.*image"
)

expect_invalid(
	readonly_borrowed_view_mutating_method
	"const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet row: number[3] = matrix[1]\nrow.reverse()\n"
	"cannot mutate borrowed view.*row.*readonly source.*matrix"
)

expect_invalid(
	readonly_union_borrowed_view_assignment
	"type Cell = number | string\nconst grid: Cell[2, 2] = [[1, \"A\"], [\"B\", 2]]\nlet row: Cell[2] = grid[1]\nrow[0] = 100\n"
	"cannot mutate borrowed view.*row.*readonly source.*grid"
)

expect_invalid(
	dynamic_index_readonly_borrowed_view_assignment
	"const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet r: number = 1\nlet row: number[3] = matrix[r]\nrow[0] = 99\n"
	"cannot mutate borrowed view.*row.*readonly source.*matrix"
)

expect_runtime_error(
	dynamic_array_read_out_of_bounds
	"let values: number[] = [1, 2, 3]\nprint(values[5])\n"
	"main.ts:[0-9]+:.*runtime range error: array subscript index 5 is out of range for length 3"
)

expect_runtime_error(
	dynamic_array_write_out_of_bounds
	"let values: number[] = [1, 2, 3]\nvalues[5] = 9\n"
	"main.ts:[0-9]+:.*runtime range error: array subscript.*5.*length 3"
)

expect_runtime_error(
	fixed_shape_dynamic_partial_index_out_of_bounds
	"let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet r: number = 2\nlet row: number[3] = matrix[r]\nprint(row[0])\n"
	"main.ts:[0-9]+:.*runtime range error: array subscript.*2.*length 2"
)

expect_runtime_error(
	returned_dynamic_row_out_of_bounds
	"function getRow(index: number): number[3] {\n    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\n    return matrix[index]\n}\nlet bad: number[3] = getRow(5)\nprint(bad[0])\n"
	"main.ts:[0-9]+:.*runtime range error: array subscript.*5.*length 2"
)
