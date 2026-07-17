if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

function(expect_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/invalid/${case_name}")
	file(REMOVE_RECURSE "${case_dir}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source_file "${case_dir}/main.ts")
	file(WRITE "${source_file}" "${source}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source_file}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE compile_result
		OUTPUT_VARIABLE compile_stdout
		ERROR_VARIABLE compile_stderr
	)

	if(compile_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly compiled\nstdout:\n${compile_stdout}")
	endif()

	if(NOT compile_stderr MATCHES "${expected}")
		message(FATAL_ERROR "${case_name} did not report ${expected}:\n${compile_stderr}")
	endif()
endfunction()

expect_invalid(
	"extern_dynamic_array_parameter"
	"extern native from \"./libnative.a\" {\n    process(values: number[]): void\n}\n"
	"native ABI"
)

expect_invalid(
	"extern_fixed_array_parameter"
	"extern native from \"./libnative.a\" {\n    process(values: number[4]): void\n}\n"
	"native ABI"
)

expect_invalid(
	"extern_tuple_return"
	"extern native from \"./libnative.a\" {\n    load(): [number, string]\n}\n"
	"native ABI"
)

expect_invalid(
	"extern_array_variable"
	"extern native from \"./libnative.a\" {\n    readonly values: string[]\n}\n"
	"native ABI"
)
