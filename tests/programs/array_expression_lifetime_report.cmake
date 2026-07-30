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
type Row = number[3]
type Matrix = number[2, 3]

function makeSeries(seed: number): number[] {
    return [seed, seed + 1, seed + 2, seed + 3]
}

function makeMatrix(seed: number): Matrix {
    return [
        [seed, seed + 1, seed + 2],
        [seed + 3, seed + 4, seed + 5]
    ]
}

function sum(values: number[]): number {
    let total: number = 0

    for (let value: number of values) {
        total = total + value
    }

    return total
}

function matrixTotal(matrix: Matrix): number {
    let total: number = 0

    for (let row: Row of matrix) {
        for (let value: number of row) {
            total = total + value
        }
    }

    return total
}

function directTemporaryCalls(flag: boolean): number {
    let total: number = sum(makeSeries(1))

    if (flag) {
        total = total + sum([10, 11, 12])
    }

    let index: number = 0
    while (index < 3) {
        index = index + 1

        if (index == 1) {
            total = total + sum(makeSeries(index))
            continue
        }

        if (index == 2) {
            total = total + sum(makeSeries(index).slice(1, 3))
            break
        }
    }

    return total
}

function spreadAndCopyLifetime(): number {
    let spread: number[] = [0, ...makeSeries(4), 9]
    let sliced: number[] = spread.slice(1, -1)
    let copied: number[] = sliced.copy()
    let filtered: number[] = copied.filter((value: number): boolean => value % 2 == 0)
    let first: number = filtered[0]
    filtered.shift()
    let last: number = filtered[filtered.length - 1]
    filtered.pop()
    return first * 100 + last * 10 + filtered.length
}

function earlyPath(enabled: boolean): number {
    let total: number = sum(makeSeries(3))

    if (enabled) {
        return total
    }

    return sum(makeSeries(4))
}

function pointerArrayPolicy(): number {
    let values: number[] = [10, 20]
    let pointers: ptr<number>[] = [&values[0], &values[1]]
    let first: ptr<number> = pointers[0]
    first = 99
    return values[0] + values[1]
}

function stress(rounds: number): number {
    let total: number = 0
    let index: number = 0

    while (index < rounds) {
        let stage: number[] = makeSeries(index).slice(1, 4).toReversed()

        if (index % 2 == 0) {
            total = total + stage[0]
            stage.shift()
        } else {
            total = total + stage[stage.length - 1]
            stage.pop()
        }

        if (index == 3) {
            index = index + 1
            continue
        }

        total = total + sum(stage)
        index = index + 1
    }

    return total
}

print(directTemporaryCalls(true))
print(directTemporaryCalls(false))
print(spreadAndCopyLifetime())
print(sum(makeSeries(5).toReversed().slice(1, 3)))
print(earlyPath(true))
print(earlyPath(false))
print(pointerArrayPolicy())
print(matrixTotal(makeMatrix(1)))
print(stress(5))
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array expression lifetime report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array expression lifetime report artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
	foreach(symbol IN ITEMS
		yogi_array_set_boxed_elements
		yogi_array_copy_element
		yogi_array_destroy
		yogi_array_view
		yogi_observe_cleanup)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array expression lifetime report IR to contain ${symbol}")
	endif()
endforeach()

if(NOT ir MATCHES "yogi_array_set_boxed_elements\\(ptr %pointers\\.array\\.storage, i1 true\\)")
	message(FATAL_ERROR "expected ptr<T>[] compiler storage to use boxed pointer-tag elements")
endif()

if(NOT ir MATCHES "yogi_any_from_pointer")
	message(FATAL_ERROR "expected ptr<T>[] elements to lower through YOGI_ANY_POINTER boxes")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "array expression lifetime report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "60\n27\n460\n13\n18\n22\n119\n21\n49\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array expression lifetime report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
