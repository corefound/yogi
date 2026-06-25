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
function sliceBatch(): void {
    let text: string = "  Hello Yogi Runtime  "
    print(text.slice(2, 7))
    print(text.slice(-9, -2))
    print(text.substring(8, 12))
    print(text.substring(12, 8))
}

function searchBatch(): void {
    let text: string = "bananas"
    print(text.includes("nan"))
    print(text.includes("nan", 3))
    print(text.startsWith("ban"))
    print(text.startsWith("nan", 2))
    print(text.endsWith("nas"))
    print(text.endsWith("nan", 5))
    print(text.indexOf("na"))
    print(text.indexOf("na", 3))
    print(text.lastIndexOf("na"))
    print(text.lastIndexOf("na", 3))
}

function transformBatch(): void {
    print("YoGi".toUpperCase())
    print("YoGi".toLowerCase())
    print("  YoGi  ".trim())
    let mixed: string = "  " + "MiXeD".toLowerCase() + "  "
    print(mixed.trim())
}

sliceBatch()
searchBatch()
transformBatch()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "string methods pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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
		yogi_string_slice
		yogi_string_substring
		yogi_string_includes
		yogi_string_starts_with
		yogi_string_ends_with
		yogi_string_index_of
		yogi_string_last_index_of
		yogi_string_to_upper_case
		yogi_string_to_lower_case
		yogi_string_trim)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected string methods IR to contain ${symbol}")
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
	message(FATAL_ERROR "string methods executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "Hello\nRuntime\nYogi\nYogi\ntrue\nfalse\ntrue\ntrue\ntrue\ntrue\n2\n4\n4\n2\nYOGI\nyogi\nYoGi\nmixed\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "string methods executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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

expect_invalid(
	invalid_string_search
	"let value: boolean = \"abc\".includes(1)\n"
	"expects .*string"
)

expect_invalid(
	invalid_string_index
	"let value: string = \"abc\".slice(\"x\")\n"
	"expects .*number"
)

expect_invalid(
	invalid_string_arity
	"let value: string = \"abc\".trim(1)\n"
	"expects .*0"
)
