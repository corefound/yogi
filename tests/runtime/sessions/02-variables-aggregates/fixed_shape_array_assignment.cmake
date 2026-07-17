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
function replaceRowFromVariable(): number {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]
    let row: number[3] = [7, 8, 9]

    matrix[0] = row

    return matrix[0, 0] * 100 + matrix[0, 1] * 10 + matrix[0, 2]
}

function replaceRowFromLiteral(): number {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    matrix[1] = [7, 8, 9]

    return matrix[1, 0] * 100 + matrix[1, 1] * 10 + matrix[1, 2]
}

function replaceRowFromDynamicIndex(): number {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]
    let row: number[3] = [7, 8, 9]
    let index: number = 1

    matrix[index] = row

    return matrix[1, 2]
}

function replaceBlock3d(): void {
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
    let block: number[2, 3] = [
        [70, 80, 90],
        [100, 110, 120]
    ]

    image[1] = block

    print(image[1, 0, 2])
    print(image[1, 1, 2])
}

function replacePixelSlice(): void {
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
    let pixel: number[3] = [40, 50, 60]

    image[0, 1] = pixel

    print(image[0, 1, 0])
    print(image[0, 1, 2])
    print(image[1, 1, 2])
}

function replaceFullMatrix(): number {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    matrix = [
        [7, 8, 9],
        [10, 11, 12]
    ]

    return matrix[1, 2]
}

print(replaceRowFromVariable())
print(replaceRowFromLiteral())
print(replaceRowFromDynamicIndex())
replaceBlock3d()
replacePixelSlice()
print(replaceFullMatrix())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "fixed-shape array assignment compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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
		array.shape.slice.start
		array.shape.slice.copy.index
		yogi_array_get
		yogi_array_set)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected fixed-shape assignment IR to contain ${symbol}:\n${ir}")
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
	message(FATAL_ERROR "fixed-shape array assignment executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "789\n789\n9\n90\n120\n40\n60\n12\n12\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "fixed-shape array assignment executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
	row_shape_mismatch_assignment
	"let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet row: number[2] = [7, 8]\nmatrix[0] = row\n"
	"cannot assign.*number\\[2\\].*number\\[3\\]"
)

expect_invalid(
	block_shape_mismatch_assignment
	"let image: number[2, 2, 3] = [[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]]\nlet block: number[2, 2] = [[1, 2], [3, 4]]\nimage[1] = block\n"
	"cannot assign.*number\\[2, 2\\].*number\\[2, 3\\]"
)

expect_invalid(
	too_many_indices_assignment
	"let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nmatrix[1, 2, 0] = 9\n"
	"expects at most.*2.*got.*3"
)
