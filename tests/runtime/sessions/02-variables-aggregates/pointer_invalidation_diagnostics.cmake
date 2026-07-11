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

function(expect_run case_name source expected_stdout)
	set(case_dir "${TEST_WORK_DIR}/valid/${case_name}")
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

	if(NOT EXISTS "${executable}")
		message(FATAL_ERROR "${case_name} executable was not generated: ${executable}")
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

set(USER_STRUCT "struct User {\n    age: number\n}\n\n")
set(NESTED_USER_STRUCT "struct Address {\n    zip: number\n}\n\nstruct User {\n    age: number\n    address: Address\n}\n\n")
set(INVALIDATION_ERROR "cannot .* while pointer .* points into .*users")

expect_run(
	"allow_push_while_element_field_pointer_live"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet age: ptr<number> = &users[0].age\nusers.push({ age: 30 })\nage = 99\nprint(users[0].age)\nprint(users[1].age)\n"
	"99\n30\n"
)

expect_run(
	"allow_multiple_pushes_while_element_field_pointer_live"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet age: ptr<number> = &users[0].age\nusers.push({ age: 30 })\nusers.push({ age: 40 })\nage = 99\nprint(users[0].age)\nprint(users[1].age)\nprint(users[2].age)\n"
	"99\n30\n40\n"
)

expect_run(
	"allow_push_while_element_pointer_live"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet user: ptr<User> = &users[0]\nusers.push({ age: 30 })\nuser.age = 99\nprint(users[0].age)\nprint(users[1].age)\n"
	"99\n30\n"
)

expect_run(
	"allow_push_while_nested_element_field_pointer_live"
	"${NESTED_USER_STRUCT}let users: User[] = [{ age: 20, address: { zip: 10001 } }]\nlet zip: ptr<number> = &users[0].address.zip\nusers.push({ age: 30, address: { zip: 10002 } })\nzip = 12345\nprint(users[0].address.zip)\nprint(users[1].address.zip)\n"
	"12345\n10002\n"
)

expect_run(
	"pointer_copy_survives_push"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet age1: ptr<number> = &users[0].age\nlet age2: ptr<number> = age1\nusers.push({ age: 30 })\nage2 = 99\nprint(age1)\nprint(users[0].age)\nprint(users[1].age)\n"
	"99\n99\n30\n"
)

expect_run(
	"pointer_rebind_then_push_both_roots"
	"${USER_STRUCT}let usersA: User[] = [{ age: 20 }]\nlet usersB: User[] = [{ age: 30 }]\nlet age: ptr<number> = &usersA[0].age\nage = &usersB[0].age\nusersA.push({ age: 21 })\nusersB.push({ age: 31 })\nage = 99\nprint(usersA[0].age)\nprint(usersA[1].age)\nprint(usersB[0].age)\nprint(usersB[1].age)\n"
	"20\n21\n99\n31\n"
)

expect_run(
	"descriptor_pointer_does_not_block_push"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet descriptor: ptr<User[]> = &users\nusers.push({ age: 30 })\nprint(users[0].age)\nprint(users[1].age)\n"
	"20\n30\n"
)

expect_run(
	"push_without_interior_pointer_still_works"
	"${USER_STRUCT}let users: User[] = []\nusers.push({ age: 20 })\nusers.push({ age: 30 })\nprint(users[0].age)\nprint(users[1].age)\n"
	"20\n30\n"
)

expect_run(
	"allow_splice_when_pointer_slot_survives"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }, { age: 40 }]\nlet age: ptr<number> = &users[2].age\nusers.splice(0, 1)\nage = 99\nprint(users[1].age)\n"
	"99\n"
)

expect_run(
	"allow_shift_when_pointer_slot_survives"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[1].age\nusers.shift()\nage = 99\nprint(users[0].age)\n"
	"99\n"
)

expect_run(
	"allow_unshift_while_pointer_live"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.unshift({ age: 10 })\nage = 99\nprint(users[1].age)\n"
	"99\n"
)

expect_run(
	"allow_pop_when_pointer_slot_survives"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.pop()\nage = 99\nprint(users[0].age)\n"
	"99\n"
)

expect_run(
	"allow_reverse_while_pointer_live"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.reverse()\nage = 99\nprint(users[1].age)\n"
	"99\n"
)

expect_run(
	"allow_sort_while_pointer_live"
	"${USER_STRUCT}let users: User[] = [{ age: 30 }, { age: 20 }]\nlet age: ptr<number> = &users[0].age\nusers.sort((a: User, b: User): number => a.age - b.age)\nage = 99\nprint(users[1].age)\n"
	"99\n"
)

expect_invalid(
	"reject_replacement_while_pointer_live"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet age: ptr<number> = &users[0].age\nusers = [{ age: 30 }]\n"
	"cannot replace .*users.* while pointer .*age.* points into .*users"
)

expect_run(
	"allow_sort_while_copied_pointer_live"
	"${USER_STRUCT}let users: User[] = [{ age: 30 }, { age: 20 }]\nlet age1: ptr<number> = &users[0].age\nlet age2: ptr<number> = age1\nusers.sort((a: User, b: User): number => a.age - b.age)\nage2 = 99\nprint(age1)\nprint(users[1].age)\n"
	"99\n99\n"
)

expect_invalid(
	"reject_readonly_root_push"
	"${USER_STRUCT}const users: User[] = [{ age: 20 }]\nusers.push({ age: 30 })\n"
	"cannot mutate .*users.*immutable"
)

expect_run(
	"allow_field_assignment_and_pointer_write_while_live"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet age: ptr<number> = &users[0].age\nusers[0].age = 25\nprint(age)\nage = 30\nprint(users[0].age)\n"
	"25\n30\n"
)

expect_run(
	"allow_structural_mutation_after_pointer_scope"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\n{\n    let age: ptr<number> = &users[0].age\n    age = 21\n}\nusers.push({ age: 30 })\nprint(users[0].age)\nprint(users[1].age)\n"
	"21\n30\n"
)

expect_run(
	"allow_mutating_another_array"
	"${USER_STRUCT}let usersA: User[] = [{ age: 20 }]\nlet usersB: User[] = [{ age: 30 }]\nlet age: ptr<number> = &usersA[0].age\nusersB.push({ age: 40 })\nprint(age)\nprint(usersB[1].age)\n"
	"20\n40\n"
)
