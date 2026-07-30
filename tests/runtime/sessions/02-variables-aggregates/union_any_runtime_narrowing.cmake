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
type Scalar = number | string | boolean
type Payload = number[] | string

let installed: Payload = "cold"

function describe(value: Scalar): number {
    if (typeof value == "number") {
        return value + 2
    }

    if (typeof value == "string") {
        return value.length
    }

    if (typeof value == "boolean") {
        return value ? 1 : 0
    }

    return 0
}

function makePayload(arrayBranch: boolean): Payload {
    if (arrayBranch) {
        return [7, 8]
    }

    return "idle"
}

function install(): void {
    installed = makePayload(true)
}

let scalar: Scalar = 10
print(describe(scalar))
print(describe(5))
scalar = "yogi"
print(describe(scalar))

let raw: any = 40
if (typeof raw == "number") {
    print(raw + 2)
}

let payload: Payload = makePayload(true)
if (typeof payload == "object") {
    payload[0] = 70
    print(payload[0])
}

let entries: Payload[] = [[3, 4], "ready"]
let detached: Payload = entries[0]
if (typeof detached == "object") {
    detached[0] = 90
}

print((entries[0] as number[])[0])
print((detached as number[])[0])

install()
if (typeof installed == "object") {
    print(installed[1])
}
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "union/any narrowing compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected union/any narrowing artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS
		yogi_any_from_number
		yogi_any_from_array
		yogi_any_typeof
		yogi_any_to_number
		yogi_any_to_array
		yogi_any_clone_owned
		yogi_any_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected union/any narrowing IR to contain ${symbol}")
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
	message(FATAL_ERROR "union/any narrowing executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(run_stderr MATCHES "AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|runtime error:|ownership error")
	message(FATAL_ERROR "union/any narrowing memory tooling reported a failure:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "12\n7\n4\n42\n70\n3\n90\n8\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "union/any narrowing printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(INVALID_DIR "${TEST_WORK_DIR}/invalid")
file(MAKE_DIRECTORY "${INVALID_DIR}")
set(INVALID_SOURCE "${INVALID_DIR}/main.ts")
file(WRITE "${INVALID_SOURCE}" [=[
type Scalar = number | string
let value: Scalar = 10
let invalid: number = value + 1
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${INVALID_SOURCE}"
	WORKING_DIRECTORY "${INVALID_DIR}"
	RESULT_VARIABLE invalid_result
	OUTPUT_VARIABLE invalid_stdout
	ERROR_VARIABLE invalid_stderr
)

if(invalid_result EQUAL 0)
	message(FATAL_ERROR "union use without narrowing unexpectedly compiled")
endif()

if(NOT invalid_stderr MATCHES "operator.*cannot be applied")
	message(FATAL_ERROR "union use without narrowing did not report the expected diagnostic:\n${invalid_stderr}")
endif()
