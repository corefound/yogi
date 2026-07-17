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
let savedRow: number[3] = [0, 0, 0]
let savedPixel: number[3] = [0, 0, 0]
let shadowRow: number[3] = [0, 0, 0]

type RowBox = {
    row: number[3]
}

let savedBox: RowBox = { row: [0, 0, 0] }

function getPixelFromLocal(): number[3] {
    let image: number[2, 2, 3] = [
        [[1, 2, 3], [4, 5, 6]],
        [[7, 8, 9], [10, 11, 12]]
    ]
    let block: number[2, 3] = image[1]

    return block[0]
}

function saveViewOfView(): void {
    let image: number[2, 2, 3] = [
        [[1, 2, 3], [4, 5, 6]],
        [[7, 8, 9], [10, 11, 12]]
    ]
    let block: number[2, 3] = image[1]
    let viewPixel: number[3] = block[0]

    savedPixel = viewPixel
    viewPixel[1] = 99
    image[1, 0, 2] = 77
}

function retain(row: number[3]): void {
    savedRow = row
}

function saveThroughRetainingCall(): void {
    let image: number[2, 2, 3] = [
        [[1, 2, 3], [4, 5, 6]],
        [[7, 8, 9], [10, 11, 12]]
    ]
    let block: number[2, 3] = image[1]

    retain(block[1])
    image[1, 1, 0] = 91
}

function saveBoxThroughLocalIdentifier(): void {
    let image: number[2, 2, 3] = [
        [[1, 2, 3], [4, 5, 6]],
        [[7, 8, 9], [10, 11, 12]]
    ]
    let row: number[3] = image[0, 1]
    let box: RowBox = { row: row }

    savedBox = box
    row[0] = 44
    image[0, 1, 2] = 55
}

function mutateValueParam(row: number[3]): void {
    row[0] = 123
}

function valueParameterIsolation(): number {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    mutateValueParam(matrix[1])
    return matrix[1, 0]
}

function mutateShadowRow(): void {
    let shadowRow: number[3] = [1, 2, 3]
    shadowRow[0] = 9
    print(shadowRow[0])
}

let returnedPixel: number[3] = getPixelFromLocal()
returnedPixel[1] = 88
print(returnedPixel[0])
print(returnedPixel[1])
print(returnedPixel[2])

saveViewOfView()
print(savedPixel[0])
print(savedPixel[1])
print(savedPixel[2])

saveThroughRetainingCall()
print(savedRow[0])
print(savedRow[1])
print(savedRow[2])

saveBoxThroughLocalIdentifier()
print(savedBox.row[0])
print(savedBox.row[1])
print(savedBox.row[2])

print(valueParameterIsolation())
mutateShadowRow()
print(shadowRow[0])
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array view lifetime analysis compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array view lifetime artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_view
		yogi_array_retain_view_source
		yogi_array_clone)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array view lifetime IR to contain ${symbol}")
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
	message(FATAL_ERROR "array view lifetime executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "7\n88\n9\n7\n99\n77\n10\n11\n12\n44\n5\n55\n4\n9\n0\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array view lifetime executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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

expect_invalid(
	readonly_nested_view_mutation
	"const image: number[2, 2, 3] = [[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]]\nlet block: number[2, 3] = image[1]\nlet pixel: number[3] = block[0]\npixel[1] = 99\n"
	"cannot mutate borrowed view.*pixel.*readonly source.*image"
)
