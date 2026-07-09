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

function(expect_run case_name source expected_stdout)
	set(case_dir "${TEST_WORK_DIR}/valid/${case_name}")
	file(REMOVE_RECURSE "${case_dir}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source_file "${case_dir}/main.ts")
	file(WRITE "${source_file}" "${source}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source_file}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE case_compile_result
		OUTPUT_VARIABLE case_compile_stdout
		ERROR_VARIABLE case_compile_stderr
	)

	if(NOT case_compile_result EQUAL 0)
		message(FATAL_ERROR "${case_name} compile failed:\nstdout:\n${case_compile_stdout}\nstderr:\n${case_compile_stderr}")
	endif()

	set(case_executable "${case_dir}/packages/.cache/bin/main")
	if(NOT EXISTS "${case_executable}")
		message(FATAL_ERROR "${case_name} executable was not generated: ${case_executable}")
	endif()

	execute_process(
		COMMAND "${case_executable}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE case_run_result
		OUTPUT_VARIABLE case_run_stdout
		ERROR_VARIABLE case_run_stderr
	)

	if(NOT case_run_result EQUAL 0)
		message(FATAL_ERROR "${case_name} executable failed:\nstdout:\n${case_run_stdout}\nstderr:\n${case_run_stderr}")
	endif()

	if(NOT case_run_stdout STREQUAL expected_stdout)
		message(FATAL_ERROR "${case_name} printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${case_run_stdout}\nstderr:\n${case_run_stderr}")
	endif()
endfunction()

expect_run(
	"pointer_scalar_read_from_let"
	"let age: number = 31\nlet pAge: ptr<number> = &age\nprint(pAge[0])\n"
	"31\n"
)

expect_run(
	"pointer_scalar_read_through_print"
	"let age: number = 31\nlet pAge: ptr<number> = &age\nprint(pAge)\n"
	"31\n"
)

expect_run(
	"pointer_scalar_read_from_const"
	"const age: number = 31\nlet pAge: ptr<number> = &age\nprint(pAge[0])\n"
	"31\n"
)

expect_run(
	"pointer_scalar_write_from_let"
	"let age: number = 31\nlet pAge: ptr<number> = &age\npAge[0] = 32\nprint(age)\n"
	"32\n"
)

expect_run(
	"pointer_scalar_write_through_assignment"
	"let age: number = 31\nlet pAge: ptr<number> = &age\npAge = 32\nprint(age)\n"
	"32\n"
)

expect_run(
	"pointer_scalar_string_boolean_read_write"
	"let name: string = \"Yogi\"\nlet ok: boolean = false\nlet pName: ptr<string> = &name\nlet pOk: ptr<boolean> = &ok\npName[0] = \"Joki\"\npOk[0] = true\nprint(name)\nprint(ok)\n"
	"Joki\ntrue\n"
)

expect_run(
	"pointer_scalar_write_via_const_pointer_binding_to_let_root"
	"let age: number = 31\nconst pAge: ptr<number> = &age\npAge = 32\nprint(age)\n"
	"32\n"
)

expect_run(
	"pointer_copy_read_write_from_let"
	"let age: number = 31\nlet p1: ptr<number> = &age\nlet p2: ptr<number> = p1\nprint(p2[0])\np2[0] = 33\nprint(age)\n"
	"31\n33\n"
)

expect_run(
	"pointer_value_copy_from_pointer"
	"let age: number = 31\nlet pAge: ptr<number> = &age\nlet value: number = pAge\npAge = 32\nprint(value)\nprint(age)\n"
	"31\n32\n"
)

expect_run(
	"pointer_reassignment_updates_permission_to_mutable"
	"const fixed: number = 31\nlet mutable: number = 10\nlet p: ptr<number> = &fixed\np = &mutable\np = 20\nprint(mutable)\n"
	"20\n"
)

expect_run(
	"function_pointer_read"
	"function readAge(age: ptr<number>): number {\n    return age[0]\n}\nlet age: number = 31\nprint(readAge(&age))\n"
	"31\n"
)

expect_run(
	"function_pointer_write_from_let"
	"function setAge(age: ptr<number>): void {\n    age = 32\n}\nlet age: number = 31\nsetAge(&age)\nprint(age)\n"
	"32\n"
)

expect_run(
	"function_value_parameter_reads_pointer"
	"function acceptsValue(value: number): void {\n    print(value)\n}\nlet age: number = 10\nacceptsValue(&age)\n"
	"10\n"
)

expect_run(
	"function_value_return_reads_pointer"
	"function read(value: ptr<number>): number {\n    return value\n}\nlet age: number = 12\nprint(read(&age))\n"
	"12\n"
)

expect_run(
	"function_pointer_return_copies_pointer"
	"function identity(value: ptr<number>): ptr<number> {\n    return value\n}\nlet age: number = 12\nlet same: ptr<number> = identity(&age)\nsame = 13\nprint(age)\n"
	"13\n"
)

expect_run(
	"struct_field_address_write"
	"struct Point {\n    x: number\n    y: number\n}\nlet point: Point = { x: 1, y: 2 }\nlet px: ptr<number> = &point.x\nprint(px)\npx = 10\nprint(point.x)\n"
	"1\n10\n"
)

expect_invalid(
	"missing_address_of"
	"let age: number = 10\nlet p: ptr<number> = age\n"
	"expected .*ptr<number>.*got .*number"
)

expect_invalid(
	"pointer_scalar_write_from_const_error"
	"const age: number = 31\nlet pAge: ptr<number> = &age\npAge = 32\n"
	"cannot write through pointer .*pAge.* readonly value .*age"
)

expect_invalid(
	"pointer_copy_from_const_write_error"
	"const age: number = 31\nlet p1: ptr<number> = &age\nlet p2: ptr<number> = p1\np2[0] = 32\n"
	"cannot mutate storage derived from const value .*age"
)

expect_invalid(
	"pointer_reassignment_updates_permission_to_readonly_error"
	"let mutable: number = 10\nconst fixed: number = 31\nlet p: ptr<number> = &mutable\np = &fixed\np[0] = 20\n"
	"cannot mutate storage derived from const value .*fixed"
)

expect_invalid(
	"const_pointer_binding_reassignment_error"
	"let age: number = 31\nlet score: number = 10\nconst p: ptr<number> = &age\np = &score\n"
	"cannot reassign const pointer binding .*p"
)

expect_invalid(
	"pointer_scalar_access_nonzero_index_error"
	"let age: number = 31\nlet pAge: ptr<number> = &age\nprint(pAge[1])\n"
	"scalar pointer access only supports index 0"
)

expect_invalid(
	"pointer_scalar_access_nonliteral_index_error"
	"let age: number = 31\nlet pAge: ptr<number> = &age\nlet i: number = 0\nprint(pAge[i])\n"
	"scalar pointer access currently requires literal index 0"
)

expect_invalid(
	"pointer_scalar_write_type_mismatch_error"
	"let age: number = 31\nlet pAge: ptr<number> = &age\npAge[0] = \"hello\"\n"
	"expected .*number.*got .*string"
)

expect_invalid(
	"function_pointer_write_from_const_error"
	"function setAge(age: ptr<number>): void {\n    age = 32\n}\nconst age: number = 31\nsetAge(&age)\n"
	"function .*setAge.* may mutate pointer parameter .*age.* points to const storage"
)

expect_invalid(
	"unknown_prt_type_diagnostic"
	"let age: number = 31\nlet pAge: prt<number> = &age\n"
	"unknown type .*prt"
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
	"address_of_temporary_expression"
	"let p: ptr<number> = &(10 + 20)\n"
	"cannot take address of temporary expression"
)

expect_invalid(
	"public_dereference_read"
	"let age: number = 10\nlet p: ptr<number> = &age\nprint(*p)\n"
	"Yogi does not use .*\\*p.* pointer dereference syntax"
)

expect_invalid(
	"public_dereference_write"
	"let age: number = 10\nlet p: ptr<number> = &age;\n(*p) = 11\n"
	"Yogi does not use .*\\(\\*p\\) = value"
)

expect_invalid(
	"address_of_object_property"
	"type Box = { value: number }\nlet box: Box = { value: 1 }\nlet p: ptr<number> = &box.value\n"
	"address-of runtime object properties is not lowerable yet"
)

expect_invalid(
	"address_of_array_element"
	"let values: number[2, 2] = [[1, 2], [3, 4]]\nlet p: ptr<number> = &values[0, 1]\n"
	"address-of array elements is not lowerable"
)

expect_invalid(
	"readonly_struct_field_write"
	"struct Point {\n    x: number\n    y: number\n}\nconst point: Point = { x: 1, y: 2 }\nlet px: ptr<number> = &point.x\npx = 10\n"
	"cannot write through pointer .*px.* readonly value .*point"
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
