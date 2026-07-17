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
let values: number[] = [10, 20, 30, 40]

let [first, , third, ...tail]: number[] = values
print(first)
print(third)
print(tail[0])

let [start, ...remaining]: [number, ...number[]] = values
print(start)
print(remaining[0])
print(remaining[2])

let pair: [number, string] = [7, "done"]
let [id, label]: [number, string] = pair
print(id)
print(label)

let total: number = 0
for (let [index, value]: [number, number] of values.entries()) {
    if (index < 2) {
        total = total + index * 10 + value
    }
}

print(total)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array destructuring compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array destructuring artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir_text)
foreach(symbol IN ITEMS yogi_array_get yogi_array_slice yogi_array_entries)
	if(NOT ir_text MATCHES "${symbol}")
		message(FATAL_ERROR "expected array destructuring IR to contain ${symbol}")
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
	message(FATAL_ERROR "array destructuring executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "10\n30\n40\n10\n20\n40\n7\ndone\n40\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array destructuring executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

function(expect_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/invalid/${case_name}")
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
	"rest_not_last"
	"let values: number[] = [1, 2, 3]\nlet [...head, last]: number[] = values\n"
	"array rest bindings must be the last"
)

expect_invalid(
	"rest_type_mismatch"
	"let values: string[] = [\"a\", \"b\"]\nlet [head, ...tail]: [string, number[]] = values\n"
	"tail"
)

expect_invalid(
	"missing_type_annotation"
	"let values: number[] = [1, 2, 3]\nlet [head, ...tail] = values\n"
	"Missing explicit type annotation"
)
