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
type Week = number[4]
type SalesGrid = number[3, 4]

function createQuarter(base: number): SalesGrid {
    return [
        [base, base + 2, base + 4, base + 6],
        [base + 1, base + 3, base + 5, base + 7],
        [base + 8, base + 9, base + 10, base + 11]
    ]
}

function totalSales(grid: SalesGrid): number {
    let total: number = 0

    for (let week: Week of grid) {
        for (let sale: number of week) {
            total = total + sale
        }
    }

    return total
}

function applyCorrections(): number {
    let grid: SalesGrid = createQuarter(10)
    let weekIndex: number = 0

    for (let week: Week of grid) {
        if (weekIndex == 0) {
            week[1] = 50
            weekIndex = weekIndex + 1
            continue
        }

        if (weekIndex == 1) {
            week[3] = 70
        }

        weekIndex = weekIndex + 1
    }

    return grid[0, 1] * 100 + grid[1, 3]
}

function firstSaleAbove(grid: SalesGrid, limit: number): number {
    for (let week: Week of grid) {
        for (let sale: number of week) {
            if (sale > limit) {
                return sale
            }
        }
    }

    return -1
}

function sampledTotal(grid: SalesGrid): number {
    let total: number = 0

    for (let week: Week of grid) {
        for (let sale: number of week) {
            if (sale == 15) {
                break
            }

            total = total + sale
        }
    }

    return total
}

function shapeCode(grid: ptr<SalesGrid>): number {
    let week: ptr<Week> = grid[0]
    return grid.length * 10 + week.length
}

let quarter: SalesGrid = createQuarter(10)
let generated: SalesGrid = createQuarter(1)
print(shapeCode(&quarter))
print(totalSales(quarter))
print(totalSales(generated))
print(applyCorrections())
print(firstSaleAbove(quarter, 18))
print(sampledTotal(quarter))
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "fixed matrix iteration report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected fixed matrix iteration report artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_view
		array.shape.slice.start
		array.shape.inbounds
		yogi_observe_cleanup)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected fixed matrix iteration report IR to contain ${symbol}")
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
	message(FATAL_ERROR "fixed matrix iteration report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "34\n186\n78\n5070\n19\n154\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "fixed matrix iteration report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
