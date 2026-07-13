if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

function(run_positive case_name source expected_stdout)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
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

	if(NOT compile_result EQUAL 0)
		message(FATAL_ERROR "${case_name} compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
	endif()

	set(executable "${case_dir}/packages/.cache/bin/main")
	set(ir "${case_dir}/packages/.cache/modules/main.ts/main.ll")
	set(object "${case_dir}/packages/.cache/modules/main.ts/main.o")

	foreach(path "${executable}" "${ir}" "${object}")
		if(NOT EXISTS "${path}")
			message(FATAL_ERROR "${case_name} expected artifact was not generated: ${path}")
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
		message(FATAL_ERROR "${case_name} executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
	endif()

	if(NOT run_stdout STREQUAL expected_stdout)
		message(FATAL_ERROR "${case_name} printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
	endif()
endfunction()

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

function(expect_runtime_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
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

	if(NOT compile_result EQUAL 0)
		message(FATAL_ERROR "${case_name} compile failed unexpectedly:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
	endif()

	set(executable "${case_dir}/packages/.cache/bin/main")
	if(NOT EXISTS "${executable}")
		message(FATAL_ERROR "${case_name} expected executable was not generated: ${executable}")
	endif()

	execute_process(
		COMMAND "${executable}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE run_result
		OUTPUT_VARIABLE run_stdout
		ERROR_VARIABLE run_stderr
	)

	if(run_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly ran successfully\nstdout:\n${run_stdout}")
	endif()

	if(NOT run_stderr MATCHES "${expected}")
		message(FATAL_ERROR "${case_name} did not report ${expected}:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
	endif()
endfunction()

set(FAST_SOURCE [=[
function fastIteration(): number {
    let values: number[] = [1, 2, 3]
    let total: number = 0

    for (let value: number of values) {
        total = (total * 10) + value
    }

    return total
}

print(fastIteration())
]=])

run_positive("fast_for_of" "${FAST_SOURCE}" "123\n")

set(FAST_IR "${TEST_WORK_DIR}/fast_for_of/packages/.cache/modules/main.ts/main.ll")
file(READ "${FAST_IR}" fast_ir)

if(fast_ir MATCHES "yogi_array_iteration_plan")
	message(FATAL_ERROR "fast for...of path unexpectedly emitted stable iteration plan:\n${fast_ir}")
endif()

foreach(symbol yogi_array_length yogi_array_get)
	if(NOT fast_ir MATCHES "${symbol}")
		message(FATAL_ERROR "fast for...of IR did not contain ${symbol}:\n${fast_ir}")
	endif()
endforeach()

set(STABLE_SOURCE [=[
struct User {
    age: number
}

function pushDuringIteration(): number {
    let values: number[] = [1, 2, 3]
    let total: number = 0

    for (let value: number of values) {
        total = (total * 10) + value
        values.push(9)
    }

    return total * 10 + values.length
}

function unshiftDuringIteration(): number {
    let values: number[] = [1, 2, 3]
    let total: number = 0

    for (let value: number of values) {
        total = (total * 10) + value
        values.unshift(0)
    }

    return total * 10 + values.length
}

function shiftSkipsUnvisitedSlot(): number {
    let values: number[] = [1, 2, 3]
    let total: number = 0

    for (let value: number of values) {
        total = (total * 10) + value

        if (value == 1) {
            values.shift()
            values.shift()
        }
    }

    return total * 10 + values.length
}

function spliceSkipsRemovedSlots(): number {
    let values: number[] = [1, 2, 3, 4]
    let total: number = 0

    for (let value: number of values) {
        total = (total * 10) + value

        if (value == 1) {
            values.splice(1, 2)
        }
    }

    return total * 10 + values.length
}

function reverseKeepsPlanOrder(): number {
    let values: number[] = [1, 2, 3]
    let total: number = 0

    for (let value: number of values) {
        total = (total * 10) + value

        if (value == 1) {
            values.reverse()
        }
    }

    return total * 10 + values[0]
}

function sortKeepsPlanOrder(): number {
    let values: number[] = [3, 1, 20]
    let total: number = 0

    for (let value: number of values) {
        total = (total * 100) + value

        if (value == 3) {
            values.sort()
        }
    }

    return total
}

function assignmentPreservesSurvivingSlots(): number {
    let values: number[] = [1, 2]
    let total: number = 0

    for (let value: number of values) {
        total = (total * 10) + value

        if (value == 1) {
            values = [9, 8]
        }
    }

    return total
}

function shorterAssignmentSkipsRemovedSlots(): number {
    let values: number[] = [1, 2, 3]
    let total: number = 0

    for (let value: number of values) {
        total = (total * 10) + value

        if (value == 1) {
            values = [9]
        }
    }

    return total * 10 + values.length
}

function byValueIsNotImplicitPointer(): number {
    let values: number[] = [1, 2]

    for (let value: number of values) {
        value = 99
    }

    return values[0] * 10 + values[1]
}

function explicitPointerIterationMutatesSlots(): number {
    let values: number[] = [1, 2]

    for (let value: ptr<number> of values) {
        value = 9
    }

    return values[0] * 10 + values[1]
}

function level3(values: ptr<number[]>): void {
    values.shift()
    values.shift()
}

function level2(values: ptr<number[]>): void {
    values.shift()
    level3(values)
}

function level1(values: ptr<number[]>): void {
    values.shift()
    level2(values)
}

function nestedShiftsEmptyArray(): number {
    let values: number[] = [1, 2, 3]
    level1(&values)
    let missing: number | undefined = values.shift()

    return values.length
}

function deepFunctionMutationSelectsStableIteration(): number {
    let values: number[] = [1, 2, 3]
    let total: number = 0

    for (let value: number of values) {
        total = (total * 10) + value
        level1(&values)
    }

    return total * 10 + values.length
}

function breakAndContinueWithMutation(): number {
    let values: number[] = [1, 2, 3, 4]
    let total: number = 0

    for (let value: number of values) {
        if (value == 1) {
            values.shift()
            continue
        }

        if (value == 3) {
            break
        }

        total = (total * 10) + value
    }

    return total
}

function returnStopsIteration(): number {
    let values: number[] = [1, 2, 3]

    for (let value: number of values) {
        values.push(9)
        return value
    }

    return 0
}

print(pushDuringIteration())
print(unshiftDuringIteration())
print(shiftSkipsUnvisitedSlot())
print(spliceSkipsRemovedSlots())
print(reverseKeepsPlanOrder())
print(sortKeepsPlanOrder())
print(assignmentPreservesSurvivingSlots())
print(shorterAssignmentSkipsRemovedSlots())
print(byValueIsNotImplicitPointer())
print(explicitPointerIterationMutatesSlots())
print(nestedShiftsEmptyArray())
print(deepFunctionMutationSelectsStableIteration())
print(breakAndContinueWithMutation())
print(returnStopsIteration())
]=])

run_positive(
	"stable_for_of_structural_mutation"
	"${STABLE_SOURCE}"
	"1236\n1236\n131\n142\n1233\n30120\n18\n11\n12\n99\n0\n10\n2\n1\n"
)

set(STABLE_IR "${TEST_WORK_DIR}/stable_for_of_structural_mutation/packages/.cache/modules/main.ts/main.ll")
file(READ "${STABLE_IR}" stable_ir)

foreach(symbol
		yogi_array_iteration_plan
		yogi_array_iteration_plan_length
		yogi_array_iteration_plan_valid
		yogi_array_iteration_plan_value
		yogi_array_iteration_plan_pointer
		yogi_array_iteration_plan_destroy)
	if(NOT stable_ir MATCHES "${symbol}")
		message(FATAL_ERROR "stable for...of IR did not contain ${symbol}:\n${stable_ir}")
	endif()
endforeach()

set(EARLY_RETURN_CLEANUP_SOURCE [=[
function takeFirst(): number {
    let values: number[] = [1, 2, 3]

    for (let value: number of values) {
        values.push(9)
        return value
    }

    return 0
}

print(takeFirst())
]=])

run_positive("early_return_stable_cleanup" "${EARLY_RETURN_CLEANUP_SOURCE}" "1\n")

set(EARLY_RETURN_IR "${TEST_WORK_DIR}/early_return_stable_cleanup/packages/.cache/modules/main.ts/main.ll")
file(READ "${EARLY_RETURN_IR}" early_return_ir)

if(NOT early_return_ir MATCHES "yogi_array_iteration_plan")
	message(FATAL_ERROR "early-return stable for...of IR did not contain an iteration plan:\n${early_return_ir}")
endif()

string(REGEX MATCHALL "call void @yogi_array_iteration_plan_destroy" early_return_destroy_calls "${early_return_ir}")
list(LENGTH early_return_destroy_calls early_return_destroy_call_count)
if(early_return_destroy_call_count LESS 2)
	message(FATAL_ERROR "early-return stable for...of IR did not clean up both return and fallthrough paths:\n${early_return_ir}")
endif()

expect_runtime_invalid(
	removed_pointer_after_nested_shift
	"function level3(values: ptr<number[]>): void {\n    values.shift()\n}\nfunction level2(values: ptr<number[]>): void {\n    values.shift()\n    level3(values)\n}\nfunction level1(values: ptr<number[]>): void {\n    values.shift()\n    level2(values)\n}\nlet values: number[] = [1, 2, 3]\nlet selected: ptr<number> = &values[1]\nlevel1(&values)\nselected = 99\n"
	"array element.*removed"
)

expect_runtime_invalid(
	strict_empty_array_index_remains_range_error
	"let values: number[] = []\nvalues.shift()\nprint(values[0])\n"
	"array subscript"
)
