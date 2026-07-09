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
	set(object "${case_dir}/packages/.cache/modules/main.ts/main.o")
	set(sir "${case_dir}/packages/.cache/modules/main.ts/sir.fb")

	foreach(path IN ITEMS "${executable}" "${ir}" "${object}" "${sir}")
		if(NOT EXISTS "${path}")
			message(FATAL_ERROR "${case_name} expected artifact was not generated: ${path}")
		endif()
	endforeach()

	file(READ "${ir}" ir_text)
	foreach(symbol IN ITEMS yogi_array_get yogi_array_set yogi_array_clone array.shape)
		if(NOT ir_text MATCHES "${symbol}")
			message(FATAL_ERROR "${case_name} IR did not contain ${symbol}:\n${ir_text}")
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

function(expect_runtime_error case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/runtime/${case_name}")
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
		message(FATAL_ERROR "${case_name} did not compile before runtime check:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
	endif()

	set(executable "${case_dir}/packages/.cache/bin/main")
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
		message(FATAL_ERROR "${case_name} did not report ${expected}:\n${run_stderr}")
	endif()
endfunction()

expect_run(
	"pointer_array_indexing"
	"function change(matrix: ptr<number[2, 3]>): void {\n    matrix[0, 2] = 99\n}\n\nfunction changeLocal(matrix: number[2, 3]): void {\n    matrix[0, 2] = 77\n}\n\nfunction readCell(matrix: ptr<number[2, 3]>): number {\n    return matrix[1, 2]\n}\n\nfunction setAt(matrix: ptr<number[2, 3]>, row: number, col: number, value: number): void {\n    matrix[row, col] = value\n}\n\nfunction firstRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {\n    return matrix[0]\n}\n\nfunction setSecond(row: ptr<number[3]>): void {\n    row[1] = 77\n}\n\nfunction firstPixel(image: ptr<number[2, 2, 3]>): ptr<number[3]> {\n    return image[1, 0]\n}\n\nfunction setVector(values: ptr<number[3]>): void {\n    values[2] = 42\n}\n\nfunction setFirst(values: ptr<number[]>): void {\n    values[0] = 55\n}\n\nfunction first(values: ptr<number[]>): number {\n    return values[0]\n}\n\ntype Cell = number | string\n\nfunction updateGrid(grid: ptr<Cell[2, 2]>): void {\n    grid[0, 0] = 123\n    grid[0, 1] = \"ok\"\n}\n\nlet matrix: number[2, 3] = [\n    [1, 2, 3],\n    [4, 5, 6]\n]\nchange(&matrix)\nprint(matrix[0, 2])\nprint(readCell(&matrix))\nsetAt(&matrix, 1, 1, 88)\nprint(matrix[1, 1])\nlet row: ptr<number[3]> = firstRow(&matrix)\nrow[1] = 66\nprint(matrix[0, 1])\nsetSecond(firstRow(&matrix))\nprint(matrix[0, 1])\n\nlet image: number[2, 2, 3] = [\n    [[1, 2, 3], [4, 5, 6]],\n    [[7, 8, 9], [10, 11, 12]]\n]\nlet pixel: ptr<number[3]> = firstPixel(&image)\npixel[2] = 44\nprint(image[1, 0, 2])\n\nlet localMatrix: number[2, 3] = [\n    [1, 2, 3],\n    [4, 5, 6]\n]\nchangeLocal(localMatrix)\nprint(localMatrix[0, 2])\n\nlet vector: number[3] = [7, 8, 9]\nsetVector(&vector)\nprint(vector[2])\n\nlet values: number[] = [1, 2, 3]\nsetFirst(&values)\nprint(values[0])\nprint(first(&values))\n\nlet grid: Cell[2, 2] = [\n    [1, \"a\"],\n    [2, \"b\"]\n]\nupdateGrid(&grid)\nprint(grid[0, 0] as number)\nprint(grid[0, 1] as string)\n"
	"99\n6\n88\n66\n77\n44\n3\n42\n55\n55\n123\nok\n"
)

expect_run(
	"pointer_return_borrow_summaries"
	"function firstRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {\n    return matrix[0]\n}\n\nfunction forwardRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {\n    return firstRow(matrix)\n}\n\nfunction aliasRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {\n    let row: ptr<number[3]> = matrix[0]\n    return row\n}\n\nfunction setThird(row: ptr<number[3]>, value: number): void {\n    row[2] = value\n}\n\nfunction touchValue(matrix: number[2, 3]): void {\n    matrix[0, 0] = 5\n}\n\nfunction readScalar(value: ptr<number>): number {\n    return value\n}\n\nfunction writeScalar(value: ptr<number>, next: number): void {\n    value = next\n}\n\nfunction readMatrix(matrix: ptr<number[2, 3]>): number {\n    return matrix[1, 2]\n}\n\nlet matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nsetThird(forwardRow(&matrix), 90)\nprint(matrix[0, 2])\nlet alias: ptr<number[3]> = aliasRow(&matrix)\nalias[0] = 31\nprint(matrix[0, 0])\ntouchValue(matrix)\nprint(matrix[0, 0])\nlet scalar: number = 7\nprint(readScalar(&scalar))\nwriteScalar(&scalar, 42)\nprint(scalar)\nprint(readMatrix(&matrix))\n"
	"90\n31\n31\n7\n42\n6\n"
)

expect_invalid(
	"missing_address_of"
	"function change(matrix: ptr<number[2, 3]>): void {\n    matrix[0, 0] = 99\n}\nlet matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nchange(matrix)\n"
	"expected .*ptr<number\\[2, 3\\]>.*got .*number\\[2, 3\\]"
)

expect_invalid(
	"pointer_passed_to_value_parameter"
	"function consume(matrix: number[2, 3]): void {\n    print(matrix[0, 0])\n}\nlet matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nconsume(&matrix)\n"
	"expected .*number\\[2, 3\\].*got .*ptr<number\\[2, 3\\]>"
)

expect_invalid(
	"wrong_pointee_shape"
	"function change(matrix: ptr<number[2, 3]>): void {\n    matrix[0, 0] = 99\n}\nlet other: number[3, 2] = [[1, 2], [3, 4], [5, 6]]\nchange(&other)\n"
	"expected .*ptr<number\\[2, 3\\]>.*got .*ptr<number\\[3, 2\\]>"
)

expect_invalid(
	"pointer_to_pointer_mismatch"
	"function change(matrix: ptr<number[2, 3]>): void {\n    matrix[0, 0] = 99\n}\nlet matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet p: ptr<number[2, 3]> = &matrix\nchange(&p)\n"
	"expected .*ptr<number\\[2, 3\\]>.*got .*ptr<ptr<number\\[2, 3\\]>>"
)

expect_invalid(
	"pointer_partial_view_return_type_mismatch"
	"function firstRow(matrix: ptr<number[2, 3]>): number[3] {\n    return matrix[0]\n}\n"
	"must return .*number\\[3\\].*got .*ptr<number\\[3\\]>"
)

expect_invalid(
	"pointer_partial_view_direct_assignment"
	"function replaceRow(matrix: ptr<number[2, 3]>, row: number[3]): void {\n    matrix[0] = row\n}\n"
	"cannot assign directly to pointer slice"
)

expect_invalid(
	"readonly_pointer_partial_view"
	"const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet p: ptr<number[2, 3]> = &matrix\nlet row: ptr<number[3]> = p[0]\nrow[1] = 99\n"
	"cannot mutate storage derived from const value"
)

expect_invalid(
	"readonly_returned_pointer_view"
	"function firstRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {\n    return matrix[0]\n}\nconst matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet row: ptr<number[3]> = firstRow(&matrix)\nrow[1] = 99\n"
	"cannot mutate storage derived from const value"
)

expect_invalid(
	"return_local_pointer_view"
	"function bad(): ptr<number[3]> {\n    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\n    let p: ptr<number[2, 3]> = &matrix\n    return p[0]\n}\n"
	"cannot return pointer or pointer view derived from local storage"
)

expect_invalid(
	"return_local_address"
	"function bad(): ptr<number> {\n    let value: number = 1\n    return &value\n}\n"
	"cannot return pointer or pointer view derived from local storage"
)

expect_invalid(
	"conflicting_pointer_borrow_return"
	"function choose(left: ptr<number[2, 3]>, right: ptr<number[2, 3]>, flag: boolean): ptr<number[3]> {\n    if (flag) {\n        return left[0]\n    }\n    return right[0]\n}\n"
	"return paths borrow from different parameters"
)

expect_invalid(
	"dereference_non_pointer"
	"let value: number = 1\nprint(*value)\n"
	"Yogi does not use .*\\*p.* pointer dereference syntax"
)

expect_invalid(
	"public_dereference_write"
	"const value: number = 1\nlet p: ptr<number> = &value;\n(*p) = 2\n"
	"Yogi does not use .*\\(\\*p\\) = value"
)

expect_invalid(
	"public_full_array_dereference_assignment"
	"let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet p: ptr<number[2, 3]> = &matrix;\n(*p) = [[7, 8, 9], [10, 11, 12]]\n"
	"Yogi does not use .*\\(\\*p\\) = value"
)

expect_invalid(
	"full_array_pointer_replacement"
	"let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nlet p: ptr<number[2, 3]> = &matrix\np = [[7, 8, 9], [10, 11, 12]]\n"
	"full aggregate replacement through pointer is not supported"
)

expect_invalid(
	"public_return_local_dereferenced_array"
	"function bad(): number[3] {\n    let row: number[3] = [1, 2, 3]\n    let p: ptr<number[3]> = &row\n    return *p\n}\n"
	"Yogi does not use .*\\*p.* pointer dereference syntax"
)

expect_invalid(
	"return_local_read_through_array"
	"function bad(): number[3] {\n    let row: number[3] = [1, 2, 3]\n    let p: ptr<number[3]> = &row\n    return p\n}\n"
	"cannot return pointer or pointer view derived from local storage"
)

expect_invalid(
	"union_element_type_mismatch"
	"type Cell = number | string\nfunction bad(grid: ptr<Cell[2, 2]>): void {\n    grid[0, 0] = true\n}\n"
	"cannot assign .*boolean.*array element type .*number \\| string"
)

expect_runtime_error(
	"dynamic_pointer_bounds"
	"function get(matrix: ptr<number[2, 3]>, row: number, col: number): number {\n    return matrix[row, col]\n}\nlet matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]\nprint(get(&matrix, 1, 4))\n"
	"runtime range error"
)
