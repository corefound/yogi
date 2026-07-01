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

let tail: number[] = [2, 3]
let dynamic: number[] = [1, ...tail, 4]

let fixedTail: number[3] = [20, 30, 40]
let fixed: number[5] = [10, ...fixedTail, 50]

let pair: [number, string] = [7, "x"]
let cells: Cell[] = [0, ...pair, "done"]

let copied: number[] = [...dynamic.copy(), ...fixedTail.copy()]

print(dynamic[0])
print(dynamic[1])
print(dynamic[2])
print(dynamic[3])
print(fixed[0])
print(fixed[3])
print(fixed[4])
print(cells[0] as number)
print(cells[1] as number)
print(cells[2] as string)
print(cells[3] as string)
print(copied[0])
print(copied[5])
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array spread compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array spread artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir_text)
foreach(symbol IN ITEMS yogi_array_push yogi_array_get yogi_array_set yogi_array_length)
	if(NOT ir_text MATCHES "${symbol}")
		message(FATAL_ERROR "expected array spread IR to contain ${symbol}")
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
	message(FATAL_ERROR "array spread executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1\n2\n3\n4\n10\n40\n50\n0\n7\nx\ndone\n1\n30\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array spread executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
	"spread_non_array"
	"let bad: number[] = [...1]\n"
	"array spread expects an array or tuple"
)

expect_invalid(
	"dynamic_spread_into_fixed"
	"let values: number[] = [1, 2]\nlet fixed: number[3] = [0, ...values]\n"
	"cannot spread dynamic array"
)

expect_invalid(
	"spread_type_mismatch"
	"let text: string[] = [\"x\"]\nlet nums: number[] = [1, ...text]\n"
	"array spread"
)
