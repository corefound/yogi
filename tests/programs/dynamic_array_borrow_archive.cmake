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
let archived: number[] = [0]

function makeBatch(start: number, count: number): number[] {
    let values: number[] = []
    let index: number = 0

    while (index < count) {
        values.push(start + index)
        index = index + 1
    }

    return values
}

function archiveDirect(values: ptr<number[]>): void {
    archived = values
}

function archiveAlias(values: ptr<number[]>): void {
    let view: number[] = values
    archived = view
}

function forwardArchive(values: ptr<number[]>, throughAlias: boolean): void {
    if (throughAlias) {
        archiveAlias(values)
        return
    }

    archiveDirect(values)
}

function snapshot(values: ptr<number[]>): number[] {
    return values
}

function sum(values: ptr<number[]>): number {
    let total: number = 0

    for (let value: number of values) {
        total = total + value
    }

    return total
}

function earlySnapshot(values: ptr<number[]>, enabled: boolean): number {
    let copy: number[] = snapshot(values)

    if (enabled) {
        return copy[0]
    }

    return -1
}

function runArchiveScenario(): void {
    let first: number[] = makeBatch(1, 4)
    forwardArchive(&first, false)
    print(first.length)
    print(archived.length)
    print(sum(&archived))

    let second: number[] = makeBatch(10, 3)
    forwardArchive(&second, true)
    print(second.length)
    print(archived.length)
    print(sum(&archived))

    let stable: number[] = snapshot(&archived)
    archived[0] = 100
    print(stable[0])
    print(sum(&archived))
    print(earlySnapshot(&archived, true))

    let round: number = 0
    let throughAlias: boolean = false

    while (round < 10) {
        let next: number[] = makeBatch(round * 10, 3)

        if (round == 1) {
            snapshot(&next)
        }

        forwardArchive(&next, throughAlias)
        let detached: number[] = snapshot(&archived)
        detached[0] = -1

        if (round == 2) {
            throughAlias = !throughAlias
            round = round + 1
            continue
        }

        if (round == 6) {
            break
        }

        throughAlias = !throughAlias
        round = round + 1
    }

    print(sum(&archived))
    print(archived[0])
    print(round)

    archived = []
    print(archived.length)
}

runArchiveScenario()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "dynamic array borrow archive compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected dynamic array borrow archive artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS yogi_array_move_replace_from yogi_array_clone yogi_array_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected dynamic array borrow archive IR to contain ${symbol}")
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
	message(FATAL_ERROR "dynamic array borrow archive executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(run_stderr MATCHES "AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|runtime error:|ownership error")
	message(FATAL_ERROR "dynamic array borrow archive memory tooling reported a failure:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "4\n4\n10\n3\n3\n33\n10\n123\n100\n183\n60\n6\n0\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "dynamic array borrow archive printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
