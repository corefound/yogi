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
type Metrics = {
    total: number
    count: number
}

struct Detail {
    values: number[]
    label: string
}

struct Report {
    detail: Detail
    tags: string[]
    metrics: Metrics
}

function readings(): number[] {
    return [2, -1, 4, 0, 3]
}

function buildReport(values: number[]): Report {
    let seed: Report = {
        detail: {
            values: [100],
            label: "seed"
        },
        tags: ["start"],
        metrics: {
            total: 0,
            count: 0
        }
    }

    let result: Report = values.reduce((accumulator: Report, value: number): Report => {
        let next: Report = accumulator
        next.detail.values.push(value)
        next.detail.label = next.detail.label + "+"
        next.tags.push("value")
        next.metrics.total = next.metrics.total + value
        next.metrics.count = next.metrics.count + 1

        return value < 0
            ? {
                detail: {
                    values: [0],
                    label: "reset"
                },
                tags: ["negative"],
                metrics: {
                    total: 0,
                    count: 0
                }
            }
            : value == 0
                ? {
                    detail: {
                        values: [10],
                        label: "zero"
                    },
                    tags: ["zero"],
                    metrics: {
                        total: 10,
                        count: 1
                    }
                }
                : next
    }, seed)

    print(seed.detail.values[0])
    print(seed.detail.label)
    print(seed.tags.length)
    print(seed.metrics.total)

    return result
}

function inspect(copy: Report): number {
    copy.detail.values[0] = 99
    let total: number = 0

    for (let value: number of copy.detail.values) {
        if (value < 0) {
            continue
        }

        total = total + value

        if (total > 100) {
            break
        }
    }

    if (copy.metrics.count == 0) {
        return -1
    }

    return total + copy.metrics.total
}

function earlyTotal(copy: Report, enabled: boolean): number {
    if (enabled) {
        return copy.metrics.total
    }

    return copy.metrics.count
}

let report: Report = buildReport(readings())
print(report.detail.values[0])
print(report.detail.values[1])
print(report.detail.label)
print(report.tags.length)
print(report.metrics.total)
print(report.metrics.count)
print(inspect(report))
print(report.detail.values[0])
print(earlyTotal(report, true))
print(report.metrics.total)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "inline reduce branch ownership report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected inline reduce branch ownership report artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS
	yogi_array_clone
	yogi_array_release
	yogi_string_from_native_owned
	yogi_string_destroy
	yogi_object_clone
	yogi_object_destroy
	yogi_observe_cleanup)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected inline reduce branch ownership report IR to contain ${symbol}")
	endif()
endforeach()

if(NOT ir MATCHES "callback.owner.then" OR
   NOT ir MATCHES "callback.owner.else" OR
   NOT ir MATCHES "callback.owner.result" OR
   NOT ir MATCHES "callback.cleanup")
	message(FATAL_ERROR "expected inline callback ownership blocks and cleanup slots in LLVM IR")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "inline reduce branch ownership report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "100\nseed\n1\n0\n10\n3\nzero+\n2\n13\n2\n115\n10\n13\n13\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "inline reduce branch ownership report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
