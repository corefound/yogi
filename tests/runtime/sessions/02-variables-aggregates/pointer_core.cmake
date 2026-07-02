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
function acceptsPointer(value: ptr<number>): void {
    print(1)
}

let age: number = 10
const locked: number = 20
let p: ptr<number> = &age
let p2: ptr<number> = p
let readonlyPointer: ptr<number> = &locked
let readonlyPointerCopy: ptr<number> = readonlyPointer
let pp: ptr<ptr<number>> = &p

let fixed: number[3] = [1, 2, 3]
let fixedPointer: ptr<number[3]> = &fixed

let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let matrixPointer: ptr<number[2, 3]> = &matrix
let values: number[] = [1, 2, 3]
let valuesPointer: ptr<number[]> = &values

acceptsPointer(&age)
acceptsPointer(&locked)
print(1)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "pointer core compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")
set(SIR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/sir.fb")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}" "${SIR}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected pointer core artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
if(NOT ir MATCHES "age")
	message(FATAL_ERROR "expected pointer core IR to contain age storage")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "pointer core executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1\n1\n1\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "pointer core executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
	"missing_address_of"
	"let age: number = 10\nlet p: ptr<number> = age\n"
	"expected .*ptr<number>.*got .*number"
)

expect_invalid(
	"pointer_to_value"
	"let age: number = 10\nlet p: ptr<number> = &age\nlet value: number = p\n"
	"expected .*number.*got .*ptr<number>"
)

expect_invalid(
	"wrong_pointer_type"
	"let age: number = 10\nlet p: ptr<string> = &age\n"
	"expected .*ptr<string>.*got .*ptr<number>"
)

expect_invalid(
	"function_missing_address_of"
	"function acceptsPointer(value: ptr<number>): void {\n    print(1)\n}\nlet age: number = 10\nacceptsPointer(age)\n"
	"expected .*ptr<number>.*got .*number"
)

expect_invalid(
	"pointer_passed_to_value_parameter"
	"function acceptsValue(value: number): void {\n    print(value)\n}\nlet age: number = 10\nacceptsValue(&age)\n"
	"expected .*number.*got .*ptr<number>"
)

expect_invalid(
	"address_of_temporary_expression"
	"let p: ptr<number> = &(10 + 20)\n"
	"cannot take address of temporary expression"
)

expect_invalid(
	"address_of_array_literal"
	"let p: ptr<number[3]> = &[1, 2, 3]\n"
	"cannot take address of temporary array literal"
)

expect_invalid(
	"address_of_string_literal"
	"let p: ptr<string> = &\"hello\"\n"
	"cannot take address of temporary string literal"
)

expect_invalid(
	"address_of_call_result"
	"function getValue(): number {\n    return 10\n}\nlet p: ptr<number> = &getValue()\n"
	"cannot take address of temporary expression"
)

expect_invalid(
	"pointer_addition"
	"let age: number = 10\nlet p: ptr<number> = &age\nlet q: ptr<number> = p + 1\n"
	"pointer arithmetic is not supported in safe Yogi"
)

expect_invalid(
	"pointer_subtraction"
	"let age: number = 10\nlet p: ptr<number> = &age\nlet q: ptr<number> = p - 1\n"
	"pointer arithmetic is not supported in safe Yogi"
)
