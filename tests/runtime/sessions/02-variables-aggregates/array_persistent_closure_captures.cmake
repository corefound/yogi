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
function immediateBorrowedViewCapture(): number {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]
    let row: number[3] = matrix[1]
    let indexes: number[] = [0, 1, 2]
    let values: number[] = indexes.map((index: number): number => {
        return row[index]
    })

    return values[0] * 100 + values[1] * 10 + values[2]
}

print(immediateBorrowedViewCapture())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array persistent closure capture positive compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array persistent closure capture artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_view
		yogi_array_get
		yogi_array_push)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected persistent closure capture IR to contain ${symbol}")
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
	message(FATAL_ERROR "array persistent closure capture executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "456\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array persistent closure capture executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
	returned_borrowed_view_closure
	"function makePicker(): (index: number) => number {\n    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\n    let row: number[3] = matrix[1]\n    return (index: number): number => row[index]\n}\n"
	"function expression cannot be returned from a function"
)

expect_invalid(
	local_named_borrowed_view_closure
	"function run(): number {\n    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\n    let row: number[3] = matrix[1]\n    let pick: (index: number) => number = (index: number): number => {\n        return row[index]\n    }\n    let indexes: number[] = [0]\n    let values: number[] = indexes.map(pick)\n    return values[0]\n}\nprint(run())\n"
	"local function value"
)

expect_invalid(
	passed_persistent_inline_callback
	"function consume(callback: (value: number) => number): number {\n    return 0\n}\nlet result: number = consume((value: number): number => value)\n"
	"function expression cannot be passed as a persistent function value"
)
