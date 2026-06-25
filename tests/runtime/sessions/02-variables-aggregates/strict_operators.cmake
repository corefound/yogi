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
function equalityBatch(): void {
    if (1 == 1) {
        print("number-eq")
    }

    if ("a" == "a") {
        print("string-eq")
    }

    if (true == true) {
        print("boolean-eq")
    }

    let left: string = "yo".concat("gi")
    let right: string = "yo".concat("gi")

    if (left == right) {
        print("dynamic-string-eq")
    }

    if (left !== "nope") {
        print("dynamic-string-neq")
    }
}

function relationalBatch(): void {
    if (2 > 1 && 1 <= 1) {
        print("number-rel")
    }
}

equalityBatch()
relationalBatch()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "strict operators pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")

if(NOT EXISTS "${EXECUTABLE}")
	message(FATAL_ERROR "expected executable was not generated: ${EXECUTABLE}")
endif()

if(NOT EXISTS "${IR}")
	message(FATAL_ERROR "expected LLVM IR was not generated: ${IR}")
endif()

file(READ "${IR}" ir)

if(NOT ir MATCHES "yogi_string_equals")
	message(FATAL_ERROR "expected strict operators IR to contain yogi_string_equals")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "strict operators executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "number-eq\nstring-eq\nboolean-eq\ndynamic-string-eq\ndynamic-string-neq\nnumber-rel\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "strict operators executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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
	invalid_string_number_equality
	"if (\"a\" == 1) { print(\"bad\") }\n"
	"cannot be applied"
)

expect_invalid(
	invalid_number_boolean_equality
	"if (1 == true) { print(\"bad\") }\n"
	"cannot be applied"
)

expect_invalid(
	invalid_string_boolean_equality
	"if (\"a\" !== false) { print(\"bad\") }\n"
	"cannot be applied"
)

expect_invalid(
	invalid_string_number_relational
	"if (\"a\" < 1) { print(\"bad\") }\n"
	"cannot be applied"
)

expect_invalid(
	invalid_mixed_logical
	"if (true && 1) { print(\"bad\") }\n"
	"cannot be applied"
)

expect_invalid(
	invalid_if_condition
	"if (1) { print(\"bad\") }\n"
	"if condition must be of type"
)
