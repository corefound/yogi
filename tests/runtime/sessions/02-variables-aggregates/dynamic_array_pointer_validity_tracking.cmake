if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

function(compile_case case_name source case_dir_var executable_var ir_var)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
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

	if(NOT compile_result EQUAL 0)
		message(FATAL_ERROR "${case_name} compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
	endif()

	set(executable "${case_dir}/packages/.cache/bin/main")
	set(ir_file "${case_dir}/packages/.cache/modules/main.ts/main.ll")
	set(object_file "${case_dir}/packages/.cache/modules/main.ts/main.o")

	foreach(path IN ITEMS "${executable}" "${ir_file}" "${object_file}")
		if(NOT EXISTS "${path}")
			message(FATAL_ERROR "${case_name} expected artifact was not generated: ${path}")
		endif()
	endforeach()

	set(${case_dir_var} "${case_dir}" PARENT_SCOPE)
	set(${executable_var} "${executable}" PARENT_SCOPE)
	set(${ir_var} "${ir_file}" PARENT_SCOPE)
endfunction()

function(expect_run case_name source expected_stdout)
	compile_case("valid/${case_name}" "${source}" case_dir executable ir_file)

	file(READ "${ir_file}" ir)
	if(NOT ir MATCHES "yogi_array_pointer_cell")
		message(FATAL_ERROR "${case_name} expected LLVM IR to use yogi_array_pointer_cell")
	endif()

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

function(expect_runtime_error case_name source expected_error)
	compile_case("invalid/${case_name}" "${source}" case_dir executable ir_file)

	file(READ "${ir_file}" ir)
	if(NOT ir MATCHES "yogi_pointer_cell_get|yogi_pointer_cell_set")
		message(FATAL_ERROR "${case_name} expected LLVM IR to use runtime pointer cell checks")
	endif()

	execute_process(
		COMMAND "${executable}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE run_result
		OUTPUT_VARIABLE run_stdout
		ERROR_VARIABLE run_stderr
	)

	if(run_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly succeeded:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
	endif()

	if(NOT run_stderr MATCHES "${expected_error}")
		message(FATAL_ERROR "${case_name} did not report ${expected_error}:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
	endif()
endfunction()

function(expect_semantic_error case_name source expected_error)
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
		message(FATAL_ERROR "${case_name} unexpectedly compiled:\nstdout:\n${compile_stdout}")
	endif()

	if(NOT compile_stderr MATCHES "${expected_error}")
		message(FATAL_ERROR "${case_name} did not report ${expected_error}:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
	endif()
endfunction()

set(USER_STRUCT "struct User {\n    age: number\n}\n\n")
set(NESTED_USER_STRUCT "struct Address {\n    zip: number\n}\n\nstruct User {\n    age: number\n    address: Address\n}\n\n")
set(INVALID_POINTER_ERROR "pointer.*array element.*removed")

expect_run(
	"pop_removes_another_slot_pointer_remains_valid"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.pop()\nage = 99\nprint(users[0].age)\n"
	"99\n"
)

expect_run(
	"pop_removes_pointed_slot_without_later_use_is_allowed"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[1].age\nusers.pop()\nprint(users.length)\n"
	"1\n"
)

expect_run(
	"shift_removes_another_slot_pointer_remains_valid"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[1].age\nusers.shift()\nage = 99\nprint(users[0].age)\n"
	"99\n"
)

expect_run(
	"shift_removes_pointed_slot_without_later_use_is_allowed"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.shift()\nprint(users[0].age)\n"
	"30\n"
)

expect_run(
	"unshift_preserves_existing_pointer_identity"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet age: ptr<number> = &users[0].age\nusers.unshift({ age: 10 })\nage = 99\nprint(users[1].age)\n"
	"99\n"
)

expect_run(
	"splice_removes_non_pointed_range_pointer_remains_valid"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }, { age: 40 }]\nlet age: ptr<number> = &users[2].age\nusers.splice(0, 1)\nage = 99\nprint(users[1].age)\n"
	"99\n"
)

expect_run(
	"splice_removes_pointed_range_without_later_use_is_allowed"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }, { age: 40 }]\nlet age: ptr<number> = &users[1].age\nusers.splice(0, 2)\nprint(users[0].age)\n"
	"40\n"
)

expect_run(
	"reverse_reorders_slots_without_invalidating_pointer"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.reverse()\nage = 99\nprint(users[1].age)\n"
	"99\n"
)

expect_run(
	"sort_reorders_slots_without_invalidating_pointer"
	"${USER_STRUCT}let users: User[] = [{ age: 30 }, { age: 20 }]\nlet age: ptr<number> = &users[0].age\nusers.sort((a: User, b: User): number => a.age - b.age)\nage = 99\nprint(users[1].age)\n"
	"99\n"
)

expect_run(
	"fill_preserves_slot_identity_and_pointer_observes_overwrite"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.fill({ age: 50 }, 0, 2)\nprint(age)\nage = 99\nprint(users[0].age)\n"
	"50\n99\n"
)

expect_run(
	"copy_within_preserves_slot_identity_and_pointer_observes_overwrite"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.copyWithin(0, 1, 2)\nprint(age)\nage = 99\nprint(users[0].age)\n"
	"30\n99\n"
)

expect_run(
	"copy_returning_methods_do_not_invalidate_original_pointer"
	"${USER_STRUCT}let users: User[] = [{ age: 30 }, { age: 20 }]\nlet age: ptr<number> = &users[0].age\nlet spliced: User[] = users.toSpliced(0, 1, { age: 50 })\nlet reversed: User[] = users.toReversed()\nlet sorted: User[] = users.toSorted((a: User, b: User): number => a.age - b.age)\nage = 99\nprint(users[0].age)\nprint(spliced.length)\nprint(reversed.length)\nprint(sorted.length)\n"
	"99\n2\n2\n2\n"
)

expect_run(
	"same_length_assignment_preserves_pointer"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers = [{ age: 99 }, { age: 100 }]\nage = 50\nprint(users[0].age)\nprint(users[1].age)\n"
	"50\n100\n"
)

expect_run(
	"longer_assignment_preserves_pointer_and_creates_slots"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers = [{ age: 99 }, { age: 100 }, { age: 200 }, { age: 300 }]\nage = 50\nprint(users[0].age)\nprint(users[1].age)\nprint(users[2].age)\nprint(users[3].age)\n"
	"50\n100\n200\n300\n"
)

expect_run(
	"shorter_assignment_preserves_pointer_to_surviving_slot"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers = [{ age: 99 }]\nage = 50\nprint(users[0].age)\nprint(users.length)\n"
	"50\n1\n"
)

expect_run(
	"pointer_rebind_after_slot_invalidation_is_allowed"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.shift()\nage = &users[0].age\nage = 99\nprint(users[0].age)\n"
	"99\n"
)

expect_run(
	"nested_projected_pointer_survives_assignment_when_slot_survives"
	"${NESTED_USER_STRUCT}let users: User[] = [{ age: 20, address: { zip: 10001 } }, { age: 30, address: { zip: 10002 } }]\nlet zip: ptr<number> = &users[0].address.zip\nusers = [{ age: 99, address: { zip: 20001 } }, { age: 100, address: { zip: 20002 } }]\nprint(zip)\nzip = 10459\nprint(users[0].address.zip)\n"
	"20001\n10459\n"
)

expect_semantic_error(
	"pop_removed_pointed_slot_errors_on_later_use"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[1].age\nusers.pop()\nage = 99\n"
	"${INVALID_POINTER_ERROR}"
)

expect_semantic_error(
	"shift_removed_pointed_slot_errors_on_later_use"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.shift()\nage = 99\n"
	"${INVALID_POINTER_ERROR}"
)

expect_semantic_error(
	"splice_removed_pointed_slot_errors_on_later_use"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }, { age: 40 }]\nlet age: ptr<number> = &users[1].age\nusers.splice(0, 2)\nage = 99\n"
	"${INVALID_POINTER_ERROR}"
)

expect_runtime_error(
	"dynamic_splice_removed_pointed_slot_errors_on_later_use"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }, { age: 40 }]\nlet index: number = 1\nlet start: number = 0\nlet count: number = 2\nlet age: ptr<number> = &users[index].age\nusers.splice(start, count)\nage = 99\n"
	"${INVALID_POINTER_ERROR}"
)

expect_semantic_error(
	"copied_pointer_to_removed_slot_errors_on_later_use"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age1: ptr<number> = &users[0].age\nlet age2: ptr<number> = age1\nusers.shift()\nage2 = 99\n"
	"${INVALID_POINTER_ERROR}"
)

expect_semantic_error(
	"copying_already_invalidated_pointer_preserves_error"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age1: ptr<number> = &users[0].age\nusers.shift()\nlet age2: ptr<number> = age1\nage2 = 99\n"
	"${INVALID_POINTER_ERROR}"
)

expect_semantic_error(
	"passing_invalidated_pointer_to_function_errors"
	"${USER_STRUCT}function writeAge(age: ptr<number>): void {\n    age = 99\n}\n\nlet users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.shift()\nwriteAge(age)\n"
	"${INVALID_POINTER_ERROR}"
)

expect_semantic_error(
	"ptr_to_removed_user_slot_errors_when_field_is_used"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet user: ptr<User> = &users[0]\nusers.shift()\nuser.age = 99\n"
	"${INVALID_POINTER_ERROR}"
)

expect_semantic_error(
	"nested_pointer_to_removed_slot_errors_on_later_use"
	"${NESTED_USER_STRUCT}let users: User[] = [{ age: 20, address: { zip: 10001 } }, { age: 30, address: { zip: 10002 } }]\nlet zip: ptr<number> = &users[0].address.zip\nusers.shift()\nzip = 10459\n"
	"${INVALID_POINTER_ERROR}"
)

expect_semantic_error(
	"shorter_assignment_invalidates_pointer_to_removed_slot"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[1].age\nusers = [{ age: 99 }]\nage = 50\n"
	"${INVALID_POINTER_ERROR}"
)

expect_semantic_error(
	"nested_projected_pointer_fails_when_assignment_removes_slot"
	"${NESTED_USER_STRUCT}let users: User[] = [{ age: 20, address: { zip: 10001 } }, { age: 30, address: { zip: 10002 } }]\nlet zip: ptr<number> = &users[1].address.zip\nusers = [{ age: 99, address: { zip: 20001 } }]\nzip = 10459\n"
	"${INVALID_POINTER_ERROR}"
)

expect_semantic_error(
	"parameter_shorter_assignment_invalidates_pointer_to_removed_slot"
	"${USER_STRUCT}function shrink(users: User[]): void {\n    let age: ptr<number> = &users[1].age\n    users = [{ age: 99 }]\n    age = 50\n}\n\nlet users: User[] = [{ age: 20 }, { age: 30 }]\nshrink(users)\n"
	"${INVALID_POINTER_ERROR}"
)
