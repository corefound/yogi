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
struct User {
    age: number
    active: boolean
}

function total(values: number[]): number {
    let result: number = 0

    for (let value: number of values) {
        result = result + value
    }

    return result
}

let values: number[] = [3, 5, 7]
let matrix: number[2, 2] = [
    [1, 2],
    [3, 4]
]
let users: User[] = [
    { age: 20, active: true }
]

let firstAge: ptr<number> = &users[0].age
users.push({ age: 30, active: false })
firstAge = 99

print(total(values))
print(matrix[1, 1])
print(users[0].age)
print(users[1].age)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array storage policy report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array storage policy artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir_text)
foreach(symbol IN ITEMS yogi_array_create_with_storage contiguous_fast_path pointer_safe_chunked_mode)
	if(NOT ir_text MATCHES "${symbol}")
		message(FATAL_ERROR "expected array storage policy IR to contain ${symbol}")
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
	message(FATAL_ERROR "array storage policy report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "15\n4\n99\n30\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array storage policy report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
