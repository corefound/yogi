if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
function doubleValue(value: number): number {
    return value * 2
}

function isLarge(value: number, index: number): boolean {
    return value + index > 3
}

function consume(value: number): void {
    print(value)
}

function mapBatch(): number {
    let scores: number[] = [1, 2, 3]
    let doubled: number[] = scores.map(doubleValue)

    return doubled[0] * 100 + doubled[1] * 10 + doubled[2]
}

function filterBatch(): number {
    let scores: number[] = [1, 2, 3]
    let filtered: number[] = scores.filter(isLarge)

    return filtered[0] * 10 + filtered.length
}

function predicateBatch(): number {
    let scores: number[] = [1, 2, 3]
    let hasLarge: boolean = scores.some(isLarge)
    let allLarge: boolean = scores.every(isLarge)
    let foundIndex: number = scores.findIndex(isLarge)
    let hasScore: number = hasLarge ? 1 : 0
    let allScore: number = allLarge ? 1 : 0

    return hasScore * 100 + allScore * 10 + foundIndex
}

function findBatch(): number {
    let scores: number[] = [1, 2, 3]
    let found: number | undefined = scores.find(isLarge)

    return scores.findIndex(isLarge)
}

function forEachBatch(): void {
    let scores: number[] = [1, 2, 3]
    scores.forEach(consume)
}

print(mapBatch())
print(filterBatch())
print(predicateBatch())
print(findBatch())
forEachBatch()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array named callbacks pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

if(NOT EXISTS "${EXECUTABLE}")
	message(FATAL_ERROR "expected executable was not generated: ${EXECUTABLE}")
endif()

if(NOT EXISTS "${IR}")
	message(FATAL_ERROR "expected LLVM IR was not generated: ${IR}")
endif()

if(NOT EXISTS "${OBJECT}")
	message(FATAL_ERROR "expected object file was not generated: ${OBJECT}")
endif()

file(READ "${IR}" ir)

foreach(symbol
		yogi_array_get
		yogi_array_push
		yogi_array_create
		_yogi_fn_main.ts_doubleValue
		_yogi_fn_main.ts_isLarge
		_yogi_fn_main.ts_consume)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array named callbacks IR to contain ${symbol}")
	endif()
endforeach()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "array named callbacks executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "246\n31\n102\n2\n1\n2\n3\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array named callbacks executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

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

expect_invalid(
	inline_callback
	"let scores: number[] = [1, 2]\nlet doubled: number[] = scores.map((value: number): number => value * 2)\n"
	"named callback function"
)

expect_invalid(
	bad_predicate_return
	"function bad(value: number): number {\n    return value\n}\nlet scores: number[] = [1, 2]\nlet ok: boolean = scores.some(bad)\n"
	"must return"
)
