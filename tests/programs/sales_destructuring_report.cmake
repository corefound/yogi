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
struct Sale {
    id: number
    amount: number
    active: boolean
}

function activeRevenue(rows: Sale[]): number {
    let total: number = 0

    for (let [index, sale]: [number, Sale] of rows.entries()) {
        if (sale.active) {
            total = total + sale.amount + index
        }
    }

    return total
}

let sales: Sale[] = [
    { id: 1, amount: 120, active: true },
    { id: 2, amount: 65, active: false },
    { id: 3, amount: 50, active: true }
]

let quarterly: number[] = [120, 90, 150, 100]
let [q1, ...restQuarters]: [number, ...number[]] = quarterly
let [q2, q3, q4]: number[] = restQuarters

print(q1)
print(q2 + q3 + q4)
print(activeRevenue(sales))
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "sales destructuring report program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected sales destructuring artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir_text)
foreach(symbol IN ITEMS yogi_array_entries yogi_array_slice yogi_array_get)
	if(NOT ir_text MATCHES "${symbol}")
		message(FATAL_ERROR "expected sales destructuring IR to contain ${symbol}")
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
	message(FATAL_ERROR "sales destructuring report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "120\n340\n172\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "sales destructuring report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
