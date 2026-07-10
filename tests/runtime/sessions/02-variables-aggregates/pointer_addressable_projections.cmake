if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

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
	set(ir "${case_dir}/packages/.cache/modules/main.ts/main.ll")

	if(NOT EXISTS "${executable}")
		message(FATAL_ERROR "${case_name} executable was not generated: ${executable}")
	endif()

	if(NOT EXISTS "${ir}")
		message(FATAL_ERROR "${case_name} IR was not generated: ${ir}")
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

	string(ASCII 27 esc)
	string(REGEX REPLACE "${esc}\\[[0-9;]*m" "" normalized_stdout "${run_stdout}")

	if(NOT normalized_stdout STREQUAL expected_stdout)
		message(FATAL_ERROR "${case_name} printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
	endif()
endfunction()

function(expect_run_with_ir case_name source expected_stdout)
	expect_run("${case_name}" "${source}" "${expected_stdout}")
	set(ir "${TEST_WORK_DIR}/valid/${case_name}/packages/.cache/modules/main.ts/main.ll")
	file(READ "${ir}" ir_text)

	foreach(symbol IN LISTS ARGN)
		if(NOT ir_text MATCHES "${symbol}")
			message(FATAL_ERROR "${case_name} IR did not contain ${symbol}:\n${ir_text}")
		endif()
	endforeach()
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

expect_run_with_ir(
	"nested_struct_field_address"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nfunction write(value: ptr<number>, next: number): void {\n    value = next\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nlet px: ptr<number> = &box.point.x\nprint(px)\npx = 9\nprint(box.point.x)\nwrite(&box.point.y, 12)\nprint(box.point.y)\n"
	"1\n9\n12\n"
	"getelementptr"
	"ptr.write.raw"
)

expect_run(
	"nested_struct_field_assignment"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nbox.point.x = 100\nprint(box)\nprint(box.point.x)\n"
	"{\n  point: {\n    x: 100,\n    y: 2\n  }\n}\n100\n"
)

expect_run(
	"nested_struct_assignment_and_pointer_agree"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nlet px: ptr<number> = &box.point.x\nbox.point.x = 100\nprint(box)\npx = 10\nprint(box)\n"
	"{\n  point: {\n    x: 100,\n    y: 2\n  }\n}\n{\n  point: {\n    x: 10,\n    y: 2\n  }\n}\n"
)

expect_run(
	"nested_struct_sibling_field_assignment"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nbox.point.y = 200\nprint(box)\n"
	"{\n  point: {\n    x: 1,\n    y: 200\n  }\n}\n"
)

expect_run(
	"nested_struct_multiple_field_assignment"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nbox.point.x = 10\nbox.point.y = 20\nprint(box)\n"
	"{\n  point: {\n    x: 10,\n    y: 20\n  }\n}\n"
)

expect_run(
	"deeper_nested_struct_field_assignment"
	"struct Coordinate {\n    value: number\n}\n\nstruct Point {\n    x: Coordinate\n    y: Coordinate\n}\n\nstruct Box {\n    point: Point\n}\n\nlet box: Box = {\n    point: {\n        x: { value: 1 },\n        y: { value: 2 }\n    }\n}\n\nbox.point.x.value = 100\nbox.point.y.value = 200\nprint(box)\n"
	"{\n  point: {\n    x: {\n      value: 100\n    },\n    y: {\n      value: 200\n    }\n  }\n}\n"
)

expect_run_with_ir(
	"ptr_struct_field_assignment"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nfunction update(box: ptr<Box>): void {\n    box.point.x = 999\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nupdate(&box)\nprint(box)\n"
	"{\n  point: {\n    x: 999,\n    y: 2\n  }\n}\n"
	"getelementptr"
)

expect_run(
	"ptr_struct_sibling_field_assignment"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nfunction update(box: ptr<Box>): void {\n    box.point.x = 10\n    box.point.y = 20\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nupdate(&box)\nprint(box)\n"
	"{\n  point: {\n    x: 10,\n    y: 20\n  }\n}\n"
)

expect_run(
	"ptr_struct_deeper_nested_field_assignment"
	"struct Coordinate {\n    value: number\n}\n\nstruct Point {\n    x: Coordinate\n    y: Coordinate\n}\n\nstruct Box {\n    point: Point\n}\n\nfunction update(box: ptr<Box>): void {\n    box.point.x.value = 100\n    box.point.y.value = 200\n}\n\nlet box: Box = {\n    point: {\n        x: { value: 1 },\n        y: { value: 2 }\n    }\n}\nupdate(&box)\nprint(box)\n"
	"{\n  point: {\n    x: {\n      value: 100\n    },\n    y: {\n      value: 200\n    }\n  }\n}\n"
)

expect_run(
	"ptr_struct_field_read"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nfunction readX(box: ptr<Box>): number {\n    return box.point.x\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nprint(readX(&box))\n"
	"1\n"
)

expect_run(
	"ptr_struct_return_field_pointer"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nfunction getX(box: ptr<Box>): ptr<number> {\n    return &box.point.x\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nlet px: ptr<number> = getX(&box)\npx = 123\nprint(box)\n"
	"{\n  point: {\n    x: 123,\n    y: 2\n  }\n}\n"
)

expect_run(
	"ptr_struct_return_nested_struct_pointer"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nfunction getPoint(box: ptr<Box>): ptr<Point> {\n    return &box.point\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nlet point: ptr<Point> = getPoint(&box)\npoint.x = 10\npoint.y = 20\nprint(box)\n"
	"{\n  point: {\n    x: 10,\n    y: 20\n  }\n}\n"
)

expect_run(
	"ptr_struct_rebind_then_project"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nlet a: Box = { point: { x: 1, y: 2 } }\nlet b: Box = { point: { x: 10, y: 20 } }\nlet p: ptr<Box> = &a\np.point.x = 100\nprint(a)\np = &b\np.point.x = 999\nprint(a)\nprint(b)\n"
	"{\n  point: {\n    x: 100,\n    y: 2\n  }\n}\n{\n  point: {\n    x: 100,\n    y: 2\n  }\n}\n{\n  point: {\n    x: 999,\n    y: 20\n  }\n}\n"
)

expect_run(
	"const_ptr_struct_binding_mutates_mutable_pointee"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nconst p: ptr<Box> = &box\np.point.x = 100\nprint(box)\n"
	"{\n  point: {\n    x: 100,\n    y: 2\n  }\n}\n"
)

expect_run(
	"ptr_struct_rebind_from_readonly_to_mutable"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nconst readonlyBox: Box = { point: { x: 1, y: 2 } }\nlet mutableBox: Box = { point: { x: 10, y: 20 } }\nlet p: ptr<Box> = &readonlyBox\np = &mutableBox\np.point.x = 999\nprint(mutableBox)\n"
	"{\n  point: {\n    x: 999,\n    y: 20\n  }\n}\n"
)

expect_run_with_ir(
	"object_field_cell_address"
	"type User = {\n    age: number\n    name: string\n}\n\nfunction write(value: ptr<number>, next: number): void {\n    value = next\n}\n\nlet user: User = { age: 31, name: \"Ada\" }\nlet age: ptr<number> = &user.age\nprint(age)\nage = 32\nprint(user.age)\nwrite(&user.age, 33)\nprint(user.age)\n"
	"31\n32\n33\n"
	"yogi_object_cell"
	"yogi_cell_get"
	"yogi_cell_set"
)

expect_run_with_ir(
	"fixed_shape_array_cell_address"
	"function write(value: ptr<number>, next: number): void {\n    value = next\n}\n\nlet matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet cell: ptr<number> = &matrix[1, 2]\nprint(cell)\ncell = 60\nprint(matrix[1, 2])\nwrite(&matrix[0, 1], 70)\nprint(matrix[0, 1])\n"
	"6\n60\n70\n"
	"yogi_array_cell"
	"yogi_cell_get"
	"yogi_cell_set"
)

expect_run_with_ir(
	"dynamic_array_cell_address"
	"function write(value: ptr<number>, next: number): void {\n    value = next\n}\n\nlet values: number[] = [3, 4, 5]\nlet first: ptr<number> = &values[0]\nprint(first)\nfirst = 10\nprint(values[0])\nwrite(&values[2], 50)\nprint(values[2])\n"
	"3\n10\n50\n"
	"yogi_array_cell"
	"yogi_cell_get"
	"yogi_cell_set"
)

expect_invalid(
	"const_object_field_cell_write"
	"type User = {\n    age: number\n}\nconst user: User = { age: 31 }\nlet age: ptr<number> = &user.age\nage = 32\n"
	"cannot write through pointer"
)

expect_invalid(
	"const_array_cell_write"
	"const values: number[] = [1, 2, 3]\nlet first: ptr<number> = &values[0]\nfirst = 10\n"
	"cannot write through pointer"
)

expect_invalid(
	"partial_array_view_address"
	"let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet row: ptr<number[3]> = &matrix[0]\n"
	"cannot take address of a borrowed array view"
)

expect_invalid(
	"const_nested_struct_field_assignment"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nconst box: Box = { point: { x: 1, y: 2 } }\nbox.point.x = 100\n"
	"cannot mutate .*box.*const"
)

expect_invalid(
	"nested_struct_field_assignment_type_mismatch"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nbox.point.x = \"bad\"\n"
	"cannot assign value of type .*string.*box.point.x.*number"
)

expect_invalid(
	"const_ptr_struct_binding_cannot_rebind"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nlet box: Box = { point: { x: 1, y: 2 } }\nlet other: Box = { point: { x: 10, y: 20 } }\nconst p: ptr<Box> = &box\np.point.x = 100\np = &other\n"
	"cannot reassign const pointer binding .*p"
)

expect_invalid(
	"ptr_struct_readonly_pointee_field_assignment"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nconst box: Box = { point: { x: 1, y: 2 } }\nlet p: ptr<Box> = &box\np.point.x = 100\n"
	"cannot mutate through pointer.*readonly"
)

expect_invalid(
	"ptr_struct_function_rejects_readonly_pointee_argument"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nfunction update(box: ptr<Box>): void {\n    box.point.x = 999\n}\n\nconst box: Box = { point: { x: 1, y: 2 } }\nupdate(&box)\n"
	"may mutate pointer parameter .*box.*points to const storage"
)

expect_invalid(
	"ptr_struct_missing_field"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nfunction bad(box: ptr<Box>): void {\n    box.point.z = 123\n}\n"
	"has no field .*z"
)

expect_invalid(
	"ptr_struct_rhs_type_mismatch"
	"struct Point {\n    x: number\n    y: number\n}\n\nstruct Box {\n    point: Point\n}\n\nfunction bad(box: ptr<Box>): void {\n    box.point.x = \"bad\"\n}\n"
	"cannot assign value of type .*string.*box.point.x.*number"
)

expect_invalid(
	"ptr_non_struct_field_projection"
	"let value: number = 1\nlet p: ptr<number> = &value\nprint(p.x)\n"
	"cannot access field .*x.*pointee type .*number"
)
