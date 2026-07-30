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
let saved: number[] = [0]
let savedAlias: number[] = [0]

function storeDirect(values: ptr<number[]>): void {
    saved = values
}

function storeAlias(values: ptr<number[]>): void {
    let view: number[] = values
    savedAlias = view
}

function forward(values: ptr<number[]>, mode: number): void {
    if (mode == 1) {
        storeDirect(values)
        return
    }

    storeAlias(values)
}

function ownedSnapshot(values: ptr<number[]>): number[] {
    return values
}

function saveDirectScenario(): void {
    let local: number[] = [1, 2, 3]
    forward(&local, 1)
    print(local.length)
}

function saveAliasScenario(): void {
    let local: number[] = [4, 5, 6]
    forward(&local, 2)
    print(local.length)
}

function localBorrowScenario(): number {
    let local: number[] = [7, 8, 9]
    let pointer: ptr<number[]> = &local
    let view: number[] = pointer
    view[1] = 88
    return local[1]
}

function materializedReturnScenario(): number {
    let local: number[] = [10, 11, 12]
    let snapshot: number[] = ownedSnapshot(&local)
    local[0] = 99
    return snapshot[0]
}

saveDirectScenario()
saveAliasScenario()

print(saved[0])
print(saved[1])
print(saved[2])
print(savedAlias[0])
print(savedAlias[1])
print(savedAlias[2])
print(localBorrowScenario())
print(materializedReturnScenario())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "dynamic escaping-borrow compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected dynamic escaping-borrow artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS yogi_array_move_replace_from yogi_array_clone yogi_array_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected dynamic escaping-borrow IR to contain ${symbol}")
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
	message(FATAL_ERROR "dynamic escaping-borrow executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(run_stderr MATCHES "AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|runtime error:|ownership error")
	message(FATAL_ERROR "dynamic escaping-borrow memory tooling reported a failure:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "3\n3\n1\n2\n3\n4\n5\n6\n88\n10\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "dynamic escaping-borrow executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
