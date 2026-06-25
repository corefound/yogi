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
function indexBatch(): void {
    print("yogi".charAt(1))
    print("yogi".charAt(99))
    print("AZ".charCodeAt(1))
}

function composeBatch(): void {
    print("ha".repeat(3))
    print("7".padStart(3, "0"))
    print("7".padEnd(3, "0"))
    print("yo".concat("g", "i"))
}

function trimBatch(): void {
    print("[" + "  yogi  ".trimStart() + "]")
    print("[" + "  yogi  ".trimEnd() + "]")
}

indexBatch()
composeBatch()
trimBatch()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "string extended methods pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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
		yogi_string_char_at
		yogi_string_char_code_at
		yogi_string_repeat
		yogi_string_pad_start
		yogi_string_pad_end
		yogi_string_concat
		yogi_string_trim_start
		yogi_string_trim_end)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected string extended methods IR to contain ${symbol}")
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
	message(FATAL_ERROR "string extended methods executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "o\n\n90\nhahaha\n007\n700\nyogi\n[yogi  ]\n[  yogi]\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "string extended methods executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
	invalid_concat_argument
	"let value: string = \"x\".concat(1)\n"
	"expects .*string"
)

expect_invalid(
	invalid_pad_length
	"let value: string = \"x\".padStart(\"3\")\n"
	"expects .*number"
)

expect_invalid(
	invalid_repeat_count
	"let value: string = \"x\".repeat(\"bad\")\n"
	"expects .*number"
)

expect_invalid(
	invalid_char_index
	"let value: string = \"x\".charAt(\"0\")\n"
	"expects .*number"
)
