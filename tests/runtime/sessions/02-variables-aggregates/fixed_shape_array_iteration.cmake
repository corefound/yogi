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
type Row = number[3]
type Matrix = number[2, 3]

function makeMatrix(seed: number): Matrix {
    return [
        [seed, seed + 1, seed + 2],
        [seed + 3, seed + 4, seed + 5]
    ]
}

function sumProducedMatrix(seed: number): number {
    let total: number = 0

    for (let row: Row of makeMatrix(seed)) {
        for (let value: number of row) {
            total = total + value
        }
    }

    return total
}

function mutateBorrowedRows(): number {
    let matrix: Matrix = makeMatrix(1)
    let rowIndex: number = 0

    for (let row: Row of matrix) {
        if (rowIndex == 0) {
            row[1] = 20
            rowIndex = rowIndex + 1
            continue
        }

        row[2] = 60
        rowIndex = rowIndex + 1
    }

    return matrix[0, 1] * 100 + matrix[1, 2]
}

function firstAbove(limit: number): number {
    let matrix: Matrix = makeMatrix(5)

    for (let row: Row of matrix) {
        for (let value: number of row) {
            if (value > limit) {
                return value
            }
        }
    }

    return -1
}

function totalBeforeFive(): number {
    let matrix: Matrix = makeMatrix(1)
    let total: number = 0

    for (let row: Row of matrix) {
        for (let value: number of row) {
            if (value == 5) {
                break
            }

            total = total + value
        }
    }

    return total
}

function shapeCode(matrix: ptr<Matrix>): number {
    let first: ptr<Row> = matrix[0]
    return matrix.length * 10 + first.length
}

let dimensions: Matrix = makeMatrix(1)
print(dimensions.length)
print(shapeCode(&dimensions))
print(sumProducedMatrix(1))
print(mutateBorrowedRows())
print(firstAbove(7))
print(totalBeforeFive())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "fixed-shape array iteration compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected fixed-shape iteration artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_view
		array.shape.slice.start
		array.shape.inbounds
		yogi_array_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected fixed-shape iteration IR to contain ${symbol}")
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
	message(FATAL_ERROR "fixed-shape array iteration executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "2\n23\n21\n2060\n8\n10\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "fixed-shape array iteration printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
		message(FATAL_ERROR "${case_name} did not report ${expected}:\nstdout:\n${invalid_stdout}\nstderr:\n${invalid_stderr}")
	endif()
endfunction()

expect_invalid(
	readonly_matrix_row_iteration
	"type Row = number[3]\ntype Matrix = number[2, 3]\nconst matrix: Matrix = [[1, 2, 3], [4, 5, 6]]\nfor (let row: Row of matrix) {\n    row[0] = 99\n}\n"
	"cannot mutate borrowed view.*row.*readonly source.*matrix"
)

expect_invalid(
	matrix_iteration_row_shape_mismatch
	"type Matrix = number[2, 3]\nlet matrix: Matrix = [[1, 2, 3], [4, 5, 6]]\nfor (let row: number[2] of matrix) {\n    print(row[0])\n}\n"
	"can only initialize values of type.*number\\[2\\]"
)

expect_invalid(
	matrix_iteration_requires_explicit_element_type
	"type Matrix = number[2, 3]\nlet matrix: Matrix = [[1, 2, 3], [4, 5, 6]]\nfor (let row of matrix) {\n    print(row[0])\n}\n"
	"explicit type annotation|required.*type|data type"
)
