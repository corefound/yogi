if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

function(run_valid_case case_name source_text)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source "${case_dir}/main.io")
	file(WRITE "${source}" "${source_text}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE compile_result
		OUTPUT_VARIABLE compile_stdout
		ERROR_VARIABLE compile_stderr
	)

	if(NOT compile_result EQUAL 0)
		message(FATAL_ERROR "${case_name} should compile\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
	endif()

	set(executable "${case_dir}/packages/.cache/bin/main")
	set(ir "${case_dir}/packages/.cache/modules/main.io/main.ll")
	set(object "${case_dir}/packages/.cache/modules/main.io/main.o")

	if(NOT EXISTS "${executable}")
		message(FATAL_ERROR "${case_name} did not produce executable ${executable}")
	endif()

	if(NOT EXISTS "${ir}")
		message(FATAL_ERROR "${case_name} did not produce LLVM IR ${ir}")
	endif()

	if(NOT EXISTS "${object}")
		message(FATAL_ERROR "${case_name} did not produce object file ${object}")
	endif()

	execute_process(
		COMMAND "${executable}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE run_result
		OUTPUT_VARIABLE run_stdout
		ERROR_VARIABLE run_stderr
	)

	if(NOT run_result EQUAL 0)
		message(FATAL_ERROR "${case_name} executable failed\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
	endif()
endfunction()

function(run_invalid_case case_name source_text expected_message)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source "${case_dir}/main.io")
	file(WRITE "${source}" "${source_text}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE compile_result
		OUTPUT_VARIABLE compile_stdout
		ERROR_VARIABLE compile_stderr
	)

	if(compile_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly compiled\nstdout:\n${compile_stdout}")
	endif()

	if(NOT compile_stderr MATCHES "cannot use aggregate")
		message(FATAL_ERROR "${case_name} did not report use-after-move\nstderr:\n${compile_stderr}")
	endif()

	if(NOT compile_stderr MATCHES "${expected_message}")
		message(FATAL_ERROR "${case_name} did not report expected detail '${expected_message}'\nstderr:\n${compile_stderr}")
	endif()

	set(ir "${case_dir}/packages/.cache/modules/main.io/main.ll")
	if(EXISTS "${ir}")
		message(FATAL_ERROR "${case_name} should fail before LLVM IR generation")
	endif()
endfunction()

run_valid_case("borrowed-known-callee" [=[
function sum(scores: number[]): number {
    return scores[0] + scores[1]
}

function ok(): number {
    let local: number[] = [1, 2, 3]
    let first: number = sum(local)
    return first + local[2]
}
]=])

run_valid_case("return-branch-move" [=[
function pick(flag: boolean): number[] {
    let local: number[] = [1, 2, 3]

    if (flag) {
        return local
    }

    let first: number = local[0]
    return [first]
}

let selected: number[] = pick(false)
]=])

run_invalid_case("known-retained-callee" [=[
let saved: number[] = [0]

function save(scores: number[]): void {
    saved = scores
}

function invalid(): number {
    let local: number[] = [1, 2]
    save(local)
    return local[0]
}
]=] "may retain or return")

run_invalid_case("alias-retained-callee" [=[
let saved: number[] = [0]

function save(scores: number[]): void {
    saved = scores
}

function invalid(): number {
    let local: number[] = [1, 2]
    let alias: number[] = local
    save(alias)
    return local[0]
}
]=] "may retain or return")

run_invalid_case("conditional-retain" [=[
let saved: number[] = [0]

function save(scores: number[]): void {
    saved = scores
}

function invalid(flag: boolean): number {
    let local: number[] = [1, 2]

    if (flag) {
        save(local)
    }

    return local[0]
}
]=] "may retain or return")

run_invalid_case("unknown-external-call" [=[
declare function externalUse(scores: number[]): void

function invalid(): number {
    let local: number[] = [1, 2]
    externalUse(local)
    return local[0]
}
]=] "unknown/external function")
