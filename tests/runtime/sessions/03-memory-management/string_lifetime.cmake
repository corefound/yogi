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
let globalText: string = "  Global  ".trim()
let literalText: string = "literal"

function makeLocal(): void {
    let text: string = "  Yogi  ".trim()
    print(text)

    text = "Next".toLowerCase()
    print(text)
}

function arrayAtExtractsValue(): void {
    let values: number[] = [3, 1, 20]
    let first: number = values.at(0)
    let last: number = values.at(-1)

    print(first)
    print(last)
}

makeLocal()
arrayAtExtractsValue()
print(globalText)
print(literalText)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "string lifetime pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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
		yogi_string_trim
		yogi_string_to_lower_case
		yogi_string_destroy
		yogi_array_at_index
		yogi_any_to_number)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected string lifetime IR to contain ${symbol}")
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
	message(FATAL_ERROR "string lifetime executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "Yogi\nnext\n3\n20\nGlobal\nliteral\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "string lifetime executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(INVALID_SOURCE "${TEST_WORK_DIR}/invalid.ts")
file(WRITE "${INVALID_SOURCE}" [=[
let values: number[] = [3, 1, 20]
let missing: number = values.at(3)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${INVALID_SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE invalid_result
	OUTPUT_VARIABLE invalid_stdout
	ERROR_VARIABLE invalid_stderr
)

if(invalid_result EQUAL 0)
	message(FATAL_ERROR "out-of-range at() unexpectedly compiled\nstdout:\n${invalid_stdout}")
endif()

if(NOT invalid_stderr MATCHES "can only initialize values of type")
	message(FATAL_ERROR "out-of-range at() did not keep number | undefined typing:\n${invalid_stderr}")
endif()
