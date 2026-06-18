if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(ASSERT_HELPERS "
function assertNumber(actual: number, expected: number): number {
    if (actual != expected) {
        let failure: any = \"aggregate assignment assertion failed\"
        let crash: number = failure as number
        return crash
    }

    return actual
}
")

function(run_valid_case case_name source_text expected_value)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source "${case_dir}/main.io")
	file(WRITE "${source}" "${ASSERT_HELPERS}\n${source_text}\nlet __check: number = assertNumber(main(), ${expected_value})\n")

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

	file(READ "${ir}" ir_content)

	foreach(symbol
			"yogi_array_create"
			"yogi_array_get"
			"yogi_array_destroy"
			"yogi_memory_push_context"
			"yogi_memory_pop_context")
		if(NOT ir_content MATCHES "${symbol}")
			message(FATAL_ERROR "${case_name} expected IR to contain ${symbol}")
		endif()
	endforeach()

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

function(run_valid_case_with_destroy_count case_name source_text expected_value minimum_destroy_count)
	run_valid_case("${case_name}" "${source_text}" "${expected_value}")

	set(ir "${TEST_WORK_DIR}/${case_name}/packages/.cache/modules/main.io/main.ll")
	file(READ "${ir}" ir_content)
	string(REGEX MATCHALL "yogi_array_destroy" destroy_matches "${ir_content}")
	list(LENGTH destroy_matches destroy_count)

	if(destroy_count LESS minimum_destroy_count)
		message(FATAL_ERROR "${case_name} expected at least ${minimum_destroy_count} yogi_array_destroy calls, found ${destroy_count}")
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
		message(FATAL_ERROR "${case_name} should fail to compile but succeeded")
	endif()

	string(TOLOWER "${compile_stderr}" stderr_lower)
	string(TOLOWER "${expected_message}" expected_lower)

	if(NOT stderr_lower MATCHES "${expected_lower}")
		message(FATAL_ERROR "${case_name} expected stderr to contain '${expected_message}'\nactual stderr:\n${compile_stderr}")
	endif()
endfunction()

# 1. Normal function: local aggregate assigned to global
run_valid_case("normal_function_local_to_global" "
let saved: number[] = [0]

function store(): void {
    let scores: number[] = [1, 2, 3]
    saved = scores
}

function main(): number {
    store()
    return saved[0]
}
" 1)

# 2. Nested block: local aggregate assigned to global before block exit
run_valid_case("nested_block_local_to_global" "
let saved: number[] = [0]

function store(): void {
    {
        let scores: number[] = [1, 2, 3]
        saved = scores
    }
}

function main(): number {
    store()
    return saved[0]
}
" 1)

# 3. If branch: aggregate escapes inside then branch
run_valid_case("if_branch_local_to_global" "
let saved: number[] = [0]

function store(flag: boolean): void {
    if (flag) {
        let scores: number[] = [1, 2, 3]
        saved = scores
    }
}

function main(): number {
    store(true)
    return saved[0]
}
" 1)

# 4. Else branch: aggregate escapes inside else branch
run_valid_case("else_branch_local_to_global" "
let saved: number[] = [0]

function store(flag: boolean): void {
    if (flag) {
        saved = [9]
    } else {
        let scores: number[] = [1, 2, 3]
        saved = scores
    }
}

function main(): number {
    store(false)
    return saved[0]
}
" 1)

# 5. Pre-branch aggregate assigned to global inside if
run_valid_case("pre_branch_local_to_global" "
let saved: number[] = [0]

function store(flag: boolean): void {
    let scores: number[] = [1, 2, 3]

    if (flag) {
        saved = scores
    }
}

function main(): number {
    store(true)
    return saved[0]
}
" 1)

# 6. While loop: aggregate escapes inside loop body
run_valid_case("while_loop_local_to_global" "
let saved: number[] = [0]

function store(): void {
    let i: number = 0

    while (i < 1) {
        let scores: number[] = [1, 2, 3]
        saved = scores
        i = i + 1
    }
}

function main(): number {
    store()
    return saved[0]
}
" 1)

# 7. For loop: aggregate escapes inside loop body
run_valid_case("for_loop_local_to_global" "
let saved: number[] = [0]

function store(): void {
    for (let i: number = 0; i < 1; i = i + 1) {
        let scores: number[] = [1, 2, 3]
        saved = scores
    }
}

function main(): number {
    store()
    return saved[0]
}
" 1)

# 8. Switch case: aggregate escapes inside case
run_valid_case("switch_case_local_to_global" "
let saved: number[] = [0]

function store(x: number): void {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]
            saved = scores
            break

        default:
            break
    }
}

function main(): number {
    store(1)
    return saved[0]
}
" 1)

# 9. Pre-switch aggregate assigned to global inside case
run_valid_case("pre_switch_local_to_global" "
let saved: number[] = [0]

function store(x: number): void {
    let scores: number[] = [1, 2, 3]

    switch (x) {
        case 1:
            saved = scores
            break

        default:
            break
    }
}

function main(): number {
    store(1)
    return saved[0]
}
" 1)

# 10. Fall-through switch: aggregate declared in case 1, assigned in case 2
run_valid_case("fallthrough_switch_local_to_global" "
let saved: number[] = [0]

function store(): void {
    switch (1) {
        case 1:
            let scores: number[] = [1, 2, 3]

        case 2:
            saved = scores
            break

        default:
            break
    }
}

function main(): number {
    store()
    return saved[0]
}
" 1)

# 11. Alias chain: original local -> local alias -> global
run_valid_case("alias_chain_local_to_global" "
let saved: number[] = [0]

function store(): void {
    let scores: number[] = [1, 2, 3]
    let alias: number[] = scores
    saved = alias
}

function main(): number {
    store()
    return saved[0]
}
" 1)

# 12. Returned aggregate assigned to global
run_valid_case("returned_aggregate_to_global" "
let saved: number[] = [0]

function make(): number[] {
    let scores: number[] = [1, 2, 3]
    return scores
}

function store(): void {
    saved = make()
}

function main(): number {
    store()
    return saved[0]
}
" 1)

# 13. Global reassignment/replacement behavior
run_valid_case_with_destroy_count("global_reassignment_replaces_previous" "
let saved: number[] = [0]

function store(): void {
    let first: number[] = [1, 2, 3]
    saved = first

    let second: number[] = [4, 5, 6]
    saved = second
}

function main(): number {
    store()
    return saved[0]
}
" 4 3)

# 14. Fall-through direct entry assigns uninitialized aggregate to global
run_invalid_case("uninitialized_fallthrough_assignment" "
let saved: number[] = [0]

function store(x: number): void {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]

        case 2:
            saved = scores
            break
    }
}
" "may be used before initialization")

# 15. Fall-through direct entry returns uninitialized aggregate
run_invalid_case("uninitialized_fallthrough_return" "
function make(x: number): number[] {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]

        case 2:
            return scores

        default:
            return [0]
    }
}
" "may be used before initialization")

# 16. Fall-through direct entry reads uninitialized aggregate
run_invalid_case("uninitialized_fallthrough_read" "
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

# 17. Scalar declared in earlier case and used in later case
run_invalid_case("uninitialized_fallthrough_scalar" "
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

# 18. Duplicate variable names across cases without explicit block
run_invalid_case("duplicate_case_binding_without_block" "
function test(x: number): number {
    switch (x) {
        case 1:
            let value: number = 10
            break

        case 2:
            let value: number = 20
            break
    }

    return 0
}
" "defined multiple times")

# 19. Same variable names allowed with explicit blocks
run_valid_case("explicit_block_case_scopes" "
function test(x: number): number {
    switch (x) {
        case 1: {
            let value: number = 10
            return value
        }

        case 2: {
            let value: number = 20
            return value
        }

        default:
            return 0
    }
}

let saved: number[] = [20]

function main(): number {
    return test(2) + saved[0] - 20
}
" 20)

# 20. Empty case grouping remains valid
run_valid_case("empty_case_grouping" "
function test(x: number): number {
    let result: number = 0

    switch (x) {
        case 1:
        case 2:
        case 3:
            result = 10
            break

        default:
            result = 99
            break
    }

    return result
}

let saved: number[] = [10]

function main(): number {
    return test(1) + test(2) + test(3) + test(99) + saved[0] - 10
}
" 129)

# 21. Aggregate declaration in earlier case is valid if never used on direct-entry path
run_valid_case("unused_earlier_case_aggregate" "
let saved: number[] = [1]

function test(x: number): void {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]

        case 2:
            break
    }
}

function main(): number {
    test(1)
    test(2)
    return saved[0]
}
" 1)
