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
function withBatch(): number {
    let scores: number[] = [1, 2, 3]
    let changed: number[] = scores.with(1, 9)
    let negative: number[] = scores.with(-1, 8)

    return changed[1] * 1000 + scores[1] * 100 + negative[2] * 10 + scores[2]
}

print(withBatch())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array with/range pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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
		yogi_array_with
		yogi_array_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array with/range IR to contain ${symbol}")
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
	message(FATAL_ERROR "array with/range executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "9283\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array with/range executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
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

function(expect_runtime_error case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source_file "${case_dir}/main.ts")
	file(WRITE "${source_file}" "${source}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source_file}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE compile_case_result
		OUTPUT_VARIABLE compile_case_stdout
		ERROR_VARIABLE compile_case_stderr
	)

	if(NOT compile_case_result EQUAL 0)
		message(FATAL_ERROR "${case_name} did not compile before runtime range check:\nstdout:\n${compile_case_stdout}\nstderr:\n${compile_case_stderr}")
	endif()

	set(case_executable "${case_dir}/packages/.cache/bin/main")
	execute_process(
		COMMAND "${case_executable}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE range_result
		OUTPUT_VARIABLE range_stdout
		ERROR_VARIABLE range_stderr
	)

	if(range_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly ran successfully\nstdout:\n${range_stdout}")
	endif()

	if(NOT range_stderr MATCHES "${expected}")
		message(FATAL_ERROR "${case_name} did not report ${expected}:\n${range_stderr}")
	endif()
endfunction()

expect_invalid(
	bad_with_value
	"let scores: number[] = [1, 2]\nlet copy: number[] = scores.with(0, \"bad\")\n"
	"replacement value"
)

expect_runtime_error(
	with_out_of_range
	"let scores: number[] = [1, 2]\nlet copy: number[] = scores.with(2, 9)\nprint(copy[0])\n"
	"yogi runtime range error"
)
