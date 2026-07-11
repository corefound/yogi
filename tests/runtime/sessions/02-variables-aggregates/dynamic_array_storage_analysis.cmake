if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

function(count_storage_modes ir pointer_safe_count_var contiguous_count_var)
	string(REGEX MATCHALL "pointer_safe_chunked_mode" pointer_safe_matches "${ir}")
	string(REGEX MATCHALL "contiguous_fast_path" contiguous_matches "${ir}")
	list(LENGTH pointer_safe_matches pointer_safe_count)
	list(LENGTH contiguous_matches contiguous_count)
	set(${pointer_safe_count_var} "${pointer_safe_count}" PARENT_SCOPE)
	set(${contiguous_count_var} "${contiguous_count}" PARENT_SCOPE)
endfunction()

function(expect_run case_name source expected_stdout expected_pointer_safe expected_contiguous)
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
	set(ir_file "${case_dir}/packages/.cache/modules/main.ts/main.ll")
	set(object_file "${case_dir}/packages/.cache/modules/main.ts/main.o")

	foreach(path IN ITEMS "${executable}" "${ir_file}" "${object_file}")
		if(NOT EXISTS "${path}")
			message(FATAL_ERROR "${case_name} expected artifact was not generated: ${path}")
		endif()
	endforeach()

	file(READ "${ir_file}" ir)
	count_storage_modes("${ir}" pointer_safe_count contiguous_count)

	if(NOT pointer_safe_count EQUAL expected_pointer_safe)
		message(FATAL_ERROR "${case_name} expected ${expected_pointer_safe} pointer-safe dynamic array storage strings, got ${pointer_safe_count}")
	endif()

	if(NOT contiguous_count EQUAL expected_contiguous)
		message(FATAL_ERROR "${case_name} expected ${expected_contiguous} contiguous dynamic array storage strings, got ${contiguous_count}")
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

set(USER_STRUCT "struct User {\n    age: number\n}\n\n")
set(NESTED_USER_STRUCT "struct Address {\n    zip: number\n}\n\nstruct User {\n    age: number\n    address: Address\n}\n\n")
set(INVALIDATION_ERROR "cannot .* while pointer .* points into .*users")

expect_run(
	"no_pointer_uses_contiguous_fast_path"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nusers.push({ age: 30 })\nprint(users[0].age)\nprint(users[1].age)\n"
	"20\n30\n"
	0
	1
)

expect_run(
	"interior_pointer_without_push_uses_contiguous_fast_path"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet age: ptr<number> = &users[0].age\nage = 99\nprint(users[0].age)\n"
	"99\n"
	0
	1
)

expect_run(
	"interior_field_pointer_plus_push_uses_pointer_safe_storage"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet age: ptr<number> = &users[0].age\nusers.push({ age: 30 })\nage = 99\nprint(users[0].age)\nprint(users[1].age)\n"
	"99\n30\n"
	1
	0
)

expect_run(
	"interior_element_pointer_plus_push_uses_pointer_safe_storage"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet user: ptr<User> = &users[0]\nusers.push({ age: 30 })\nuser.age = 99\nprint(users[0].age)\nprint(users[1].age)\n"
	"99\n30\n"
	1
	0
)

expect_run(
	"nested_interior_pointer_plus_push_uses_pointer_safe_storage"
	"${NESTED_USER_STRUCT}let users: User[] = [{ age: 20, address: { zip: 10001 } }]\nlet zip: ptr<number> = &users[0].address.zip\nusers.push({ age: 30, address: { zip: 10002 } })\nzip = 10459\nprint(users[0].address.zip)\nprint(users[1].address.zip)\n"
	"10459\n10002\n"
	1
	0
)

expect_run(
	"pointer_scope_ends_before_push_keeps_contiguous_fast_path"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\n{\n    let age: ptr<number> = &users[0].age\n    age = 99\n}\nusers.push({ age: 30 })\nprint(users[0].age)\nprint(users[1].age)\n"
	"99\n30\n"
	0
	1
)

expect_run(
	"pointer_copy_preserves_provenance_and_uses_pointer_safe_storage"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet age1: ptr<number> = &users[0].age\nlet age2: ptr<number> = age1\nusers.push({ age: 30 })\nage2 = 99\nprint(age1)\nprint(users[0].age)\nprint(users[1].age)\n"
	"99\n99\n30\n"
	1
	0
)

expect_run(
	"pointer_rebind_updates_root_storage_decisions"
	"${USER_STRUCT}let usersA: User[] = [{ age: 20 }]\nlet usersB: User[] = [{ age: 30 }]\nlet age: ptr<number> = &usersA[0].age\nage = &usersB[0].age\nusersA.push({ age: 21 })\nusersB.push({ age: 31 })\nage = 99\nprint(usersA[0].age)\nprint(usersA[1].age)\nprint(usersB[0].age)\nprint(usersB[1].age)\n"
	"20\n21\n99\n31\n"
	1
	1
)

expect_run(
	"descriptor_pointer_does_not_force_pointer_safe_storage"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet descriptor: ptr<User[]> = &users\nusers.push({ age: 30 })\nprint(users[0].age)\nprint(users[1].age)\n"
	"20\n30\n"
	0
	1
)

expect_run(
	"sort_while_interior_pointer_live_uses_pointer_safe_storage"
	"${USER_STRUCT}let users: User[] = [{ age: 30 }, { age: 20 }]\nlet age: ptr<number> = &users[0].age\nusers.sort((a: User, b: User): number => a.age - b.age)\nage = 99\nprint(users[1].age)\n"
	"99\n"
	1
	0
)

expect_run(
	"reverse_while_interior_pointer_live_uses_pointer_safe_storage"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }, { age: 30 }]\nlet age: ptr<number> = &users[0].age\nusers.reverse()\nage = 99\nprint(users[1].age)\n"
	"99\n"
	1
	0
)

expect_invalid(
	"reject_replacement_while_interior_pointer_live"
	"${USER_STRUCT}let users: User[] = [{ age: 20 }]\nlet age: ptr<number> = &users[0].age\nusers = [{ age: 30 }]\n"
	"cannot replace .*users.* while pointer .*age.* points into .*users"
)
