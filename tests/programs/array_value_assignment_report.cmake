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

function snapshot(values: ptr<number[]>): number[] {
    return values
}

function archive(values: ptr<number[]>): void {
    archived = values
}

function copiedParameter(values: number[]): number[] {
    let local: number[] = values
    local[0] = local[0] + 10
    return local
}

function assignmentStress(source: ptr<number[]>): number {
    let stage: number[] = [0]
    let total: number = 0
    let round: number = 0

    while (round < 5) {
        let view: number[] = source
        let pass: number[] = view
        pass[0] = round
        stage = pass
        total = total + stage[0]

        if (round == 1) {
            round = round + 1
            continue
        }

        if (round == 4) {
            break
        }

        round = round + 1
    }

    return total
}

function run(): void {
    let source: number[] = [1, 2, 3]
    let direct: number[] = source
    direct[0] = 99

    print(source.length)
    print(source[0])
    print(direct.length)
    print(direct[0])

    let pointer: ptr<number[]> = &source
    let view: number[] = pointer
    view[1] = 88

    print(source[1])

    let copiedView: number[] = view
    copiedView[2] = 77

    print(source[2])
    print(copiedView[2])

    let assigned: number[] = [-1, -2]
    let preserved: ptr<number> = &assigned[0]
    assigned = source
    preserved = 55

    print(source.length)
    print(source[0])
    print(assigned.length)
    print(assigned[0])

    let returned: number[] = snapshot(pointer)
    returned[0] = 44

    print(source[0])
    print(returned[0])

    archive(pointer)
    archived[1] = 66

    print(source[1])
    print(archived[1])

    let throughParameter: number[] = copiedParameter(source)
    throughParameter[2] = 22

    print(source[0])
    print(throughParameter[0])
    print(source[2])
    print(throughParameter[2])
    print(assignmentStress(pointer))
    print(source[0])
}

run()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array value-assignment report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array value-assignment artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS yogi_array_move_replace_from yogi_array_clone yogi_array_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array value-assignment IR to contain ${symbol}")
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
	message(FATAL_ERROR "array value-assignment report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(run_stderr MATCHES "AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|runtime error:|ownership error")
	message(FATAL_ERROR "array value-assignment memory tooling reported a failure:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "3\n1\n3\n99\n88\n3\n77\n3\n1\n3\n55\n1\n44\n88\n66\n1\n11\n3\n22\n10\n1\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array value-assignment report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
