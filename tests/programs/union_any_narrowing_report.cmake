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

let installed: Payload = "empty"

function summarize(values: Scalar[]): number {
    let total: number = 0
    let index: number = 0

    while (index < values.length) {
        let current: Scalar = values[index]

        if (typeof current == "number") {
            total = total + current
        } else {
            if (typeof current == "string") {
                total = total + current.length
                index = index + 1
                continue
            } else {
                if (typeof current == "boolean") {
                    total = total + (current ? 1 : 0)
                }
            }
        }

        index = index + 1
    }

    return total
}

function firstNumber(values: Scalar[]): number {
    let index: number = 0

    while (index < values.length) {
        let current: Scalar = values[index]

        if (typeof current == "number") {
            return current
        }

        index = index + 1
    }

    return -1
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

function replaceLocal(value: Payload): number {
    value = [9]

    if (typeof value == "object") {
        return value[0]
    }

    return 0
}

function stress(): number {
    let total: number = 0
    let round: number = 0

    while (round < 20) {
        let payload: Payload = [round, round + 1]

        if (typeof payload == "object") {
            total = total + payload[1]
        }

        round = round + 1

        if (round == 3) {
            continue
        }

        if (round == 7) {
            break
        }
    }

    return total
}

let values: Scalar[] = [1, "ab", true, 4]
print(summarize(values))
print(firstNumber(values))
print(summarize([5]))

let raw: any = 40
if (typeof raw == "number") {
    print(raw + 2)
}

let payloads: Payload[] = [[3, 4], "ready"]
let detached: Payload = payloads[0]
if (typeof detached == "object") {
    detached[0] = 90
}

print((payloads[0] as number[])[0])
print((detached as number[])[0])

let original: Payload = [1]
print(replaceLocal(original))
if (typeof original == "object") {
    print(original[0])
}

install()
if (typeof installed == "object") {
    print(installed[1])
}

print(stress())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "union/any narrowing report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected union/any narrowing report artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS
		yogi_any_typeof
		yogi_any_clone_owned
		yogi_any_to_number
		yogi_any_to_array
		yogi_any_destroy
		yogi_array_clone)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected union/any narrowing report IR to contain ${symbol}")
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
	message(FATAL_ERROR "union/any narrowing report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(run_stderr MATCHES "AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|runtime error:|ownership error")
	message(FATAL_ERROR "union/any narrowing report memory tooling reported a failure:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "8\n1\n5\n42\n3\n90\n9\n1\n8\n28\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "union/any narrowing report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
