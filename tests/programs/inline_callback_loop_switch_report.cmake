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
type Totals = {
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
    totals: Totals
}

function readings(): number[] {
    return [1, 2, 3, 0, 4]
}

function process(values: number[]): Report {
    let seed: Report = {
        detail: {
            values: [100],
            label: "run"
        },
        tags: ["seed"],
        totals: {
            total: 0,
            count: 0
        }
    }

    let result: Report = values.reduce((accumulator: Report, value: number): Report => {
        let next: Report = accumulator
        let cursor: number = 0

        while (cursor < 3) {
            cursor = cursor + 1
            let scratch: Report = {
                detail: {
                    values: [cursor],
                    label: "while"
                },
                tags: ["temporary"],
                totals: {
                    total: cursor,
                    count: 1
                }
            }

            if (cursor == 1) {
                continue
            }

            break
        }

        for (let index: number = 0; index < 3; index = index + 1) {
            let iteration: Report = {
                detail: {
                    values: [index],
                    label: "for"
                },
                tags: ["temporary"],
                totals: {
                    total: index,
                    count: 1
                }
            }

            switch (index) {
                case 0:
                    continue

                case 1:
                    break

                default:
                    break
            }

            if (index == 2) {
                break
            }

            next.totals.total = next.totals.total + value + index
        }

        switch (value) {
            case 2:
                let replacement: Report = {
                    detail: {
                        values: [2],
                        label: "reset"
                    },
                    tags: ["reset"],
                    totals: {
                        total: 0,
                        count: 0
                    }
                }
                return replacement

            case 3:
                next.tags.push("three")

            case 0:
                {
                    let marker: Report = {
                        detail: {
                            values: [0],
                            label: "marker"
                        },
                        tags: ["temporary"],
                        totals: {
                            total: 0,
                            count: 0
                        }
                    }
                }
                next.tags.push("zero")
                break

            default:
                break
        }

        next.detail.values.push(value)
        next.detail.label = next.detail.label + "+"
        next.totals.total = next.totals.total + value
        next.totals.count = next.totals.count + 1
        return next
    }, seed)

    print(seed.detail.values[0])
    print(seed.detail.label)
    print(seed.tags.length)
    print(seed.totals.total)
    return result
}

function inspect(copy: Report): number {
    copy.detail.values[0] = 90
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

    return total + copy.totals.total
}

function classify(values: number[]): number[] {
    return values.map((value: number): number => {
        let total: number = 0
        let cursor: number = 0

        while (cursor < 2) {
            cursor = cursor + 1

            if (cursor == 1) {
                continue
            }

            total = total + value
        }

        for (let index: number = 0; index < 2; index = index + 1) {
            if (index == 1) {
                break
            }

            total = total + index
        }

        switch (value) {
            case 2:
                return total + 20

            default:
                return total
        }
    })
}

let report: Report = process(readings())
print(report.detail.values.length)
print(report.detail.values[0])
print(report.detail.values[1])
print(report.detail.values[2])
print(report.detail.values[3])
print(report.detail.label)
print(report.tags.length)
print(report.totals.total)
print(report.totals.count)
print(inspect(report))
print(report.detail.values[0])

let classes: number[] = classify([1, 2, 3])
print(classes[0])
print(classes[1])
print(classes[2])
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "inline callback loop/switch report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected inline callback loop/switch report artifact was not generated: ${path}")
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
		message(FATAL_ERROR "expected inline callback loop/switch report IR to contain ${symbol}")
	endif()
endforeach()

foreach(block IN ITEMS
	callback.while.condition
	callback.while.body
	callback.while.end
	callback.for.condition
	callback.for.body
	callback.for.increment
	callback.for.end
	callback.switch.check
	callback.switch.case
	callback.switch.end
	callback.cleanup.active
	callback.owner.active
	callback.return)
	if(NOT ir MATCHES "${block}")
		message(FATAL_ERROR "expected inline callback loop/switch report IR to contain ${block}")
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
	message(FATAL_ERROR "inline callback loop/switch report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "100\nrun\n1\n0\n4\n2\n3\n0\n4\nreset+++\n4\n17\n3\n114\n2\n1\n22\n3\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "inline callback loop/switch report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
