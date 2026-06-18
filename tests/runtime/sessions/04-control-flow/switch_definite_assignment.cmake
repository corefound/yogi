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

	if(NOT EXISTS "${executable}")
		message(FATAL_ERROR "${case_name} did not produce executable ${executable}")
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
		message(FATAL_ERROR "${case_name} should have failed to compile but succeeded")
	endif()

	string(TOLOWER "${compile_stderr}" stderr_lower)
	string(TOLOWER "${expected_message}" expected_lower)

	if(NOT stderr_lower MATCHES "${expected_lower}")
		message(FATAL_ERROR "${case_name} expected stderr to contain '${expected_message}'\nactual stderr:\n${compile_stderr}")
	endif()
endfunction()

# 1. Scalar declared in earlier case, used in later case
run_invalid_case("scalar_used_in_later_case" "
function test(x: number): number {
    switch (x) {
        case 1:
            let value: number = 10

        case 2:
            return value
    }

    return 0
}
" "may be used before initialization")

# 2. Aggregate declared in earlier case, used in later case
run_invalid_case("aggregate_used_in_later_case" "
function test(x: number): number {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]

        case 2:
            return scores[0]
    }

    return 0
}
" "may be used before initialization")

# 3. Aggregate declared in earlier case, assigned to global in later case
run_invalid_case("assign_uninit_aggregate_to_global" "
let saved: number[] = [0]

function test(x: number): void {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]

        case 2:
            saved = scores
            break
    }
}
" "may be used before initialization")

# 4. Safe use inside same case
run_valid_case("safe_same_case" "
function test(x: number): number {
    switch (x) {
        case 1:
            let value: number = 10
            return value

        case 2:
            return 0
    }

    return 0
}
")

# 5. Safe grouped cases (empty cases fall through to declaration)
run_valid_case("grouped_cases" "
function test(x: number): number {
    switch (x) {
        case 1:
        case 2:
        case 3:
            let value: number = 10
            return value

        default:
            return 0
    }
}
")

# 6. Safe explicit block (block creates its own scope)
run_valid_case("explicit_block" "
function test(x: number): number {
    switch (x) {
        case 1: {
            let value: number = 10
            return value
        }

        case 2:
            return 0
    }

    return 0
}
")

# 7. Variable declared before switch and used inside any case
run_valid_case("var_before_switch" "
function test(x: number): number {
    let value: number = 10

    switch (x) {
        case 1:
            return value

        case 2:
            return value
    }

    return value
}
")

# 8. Explicit blocks create per-case scopes, matching TypeScript switch style
run_valid_case("explicit_block_redeclare" "
function test(x: number): number {
    switch (x) {
        case 1: {
            let value: number = 1
            return value
        }

        case 2: {
            let value: number = 2
            return value
        }

        default:
            return 0
    }
}
")

# 9. Uninitialized aggregate cleanup should still be safe (no use of the variable)
run_valid_case("uninit_cleanup_safe" "
function test(x: number): void {
    switch (x) {
        case 1:
            let arr: number[] = [1, 2, 3]

        case 2:
            break
    }
}
")

# 10. Return aggregate after possible uninitialized path
run_invalid_case("return_uninit_aggregate" "
function make(x: number): number[] {
    switch (x) {
        case 1:
            let arr: number[] = [1, 2, 3]

        case 2:
            return arr

        default:
            return [0]
    }
}
" "may be used before initialization")

# 11. Multiple declarations across fall-through chain
run_invalid_case("multiple_decls_fallthrough" "
function test(x: number): number {
    switch (x) {
        case 1:
            let a: number = 1

        case 2:
            let b: number = 2

        case 3:
            return a + b
    }

    return 0
}
" "may be used before initialization")

# 12. Nested switch should not wipe the outer switch's definite-assignment tracking
run_invalid_case("nested_switch_preserves_outer_tracking" "
function test(x: number, y: number): number {
    switch (x) {
        case 1:
            let value: number = 1
            break

        case 2:
            switch (y) {
                default:
                    let nested: number = 0
            }

        case 3:
            return value

        default:
            return 0
    }
}
" "may be used before initialization")

# 13. Grouped fall-through cases should count as always-returning
run_valid_case("grouped_fallthrough_always_returns" "
function test(x: number): number {
    switch (x) {
        case 1:
        case 2:
            return 10

        default:
            return 0
    }
}
")
