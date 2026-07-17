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
let savedForecast: number[4] = [0, 0, 0, 0]

function rowTotal(row: number[4]): number {
    return row[0] + row[1] + row[2] + row[3]
}

function bestQuarter(region: number[3, 4]): number[4] {
    let best: number[4] = region[0]

    if (rowTotal(region[1]) > rowTotal(best)) {
        best = region[1]
    }

    if (rowTotal(region[2]) > rowTotal(best)) {
        best = region[2]
    }

    return best
}

function saveForecast(): void {
    let plan: number[2, 4] = [
        [7, 8, 9, 10],
        [11, 12, 13, 14]
    ]
    let forecast: number[4] = plan[1]

    savedForecast = forecast
    forecast[2] = 77
}

let revenue: number[3, 4] = [
    [10, 20, 30, 40],
    [5, 15, 25, 35],
    [12, 18, 24, 30]
]

let north: number[4] = revenue[0]
print(rowTotal(north))
north[3] = 45
print(revenue[0, 3])
print(rowTotal(north))

let best: number[4] = bestQuarter(revenue)
print(rowTotal(best))
best[0] = 99
print(best[0])
print(revenue[0, 0])

saveForecast()
print(savedForecast[0])
print(savedForecast[1])
print(savedForecast[2])
print(savedForecast[3])
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "matrix report program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected matrix report artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_view
		yogi_array_retain_view_source
		yogi_array_clone
		array.shape)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected matrix report IR to contain ${symbol}")
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
	message(FATAL_ERROR "matrix report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "100\n45\n105\n105\n99\n10\n11\n12\n77\n14\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "matrix report program printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
