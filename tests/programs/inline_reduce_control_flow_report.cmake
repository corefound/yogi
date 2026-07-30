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

struct Log {
    samples: number[]
    label: string
}

struct Session {
    log: Log
    flags: string[]
    totals: Totals
}

function measurements(): number[] {
    return [5, -2, 4, 0, 3]
}

function summarize(values: number[]): Session {
    let seed: Session = {
        log: {
            samples: [50],
            label: "source"
        },
        flags: ["seed"],
        totals: {
            total: 0,
            count: 0
        }
    }

    let result: Session = values.reduce((accumulator: Session, value: number): Session => {
        let next: Session = accumulator
        next.log.samples.push(value)
        next.log.label = next.log.label + "+"
        next.flags.push("accepted")
        next.totals.total = next.totals.total + value
        next.totals.count = next.totals.count + 1

        if (value < 0) {
            let reset: Session = {
                log: {
                    samples: [value],
                    label: "reset"
                },
                flags: ["reset"],
                totals: {
                    total: 0,
                    count: 0
                }
            }
            return reset
        } else {
            if (value == 0) {
                {
                    let checkpoint: Session = {
                        log: {
                            samples: [0],
                            label: "checkpoint"
                        },
                        flags: ["checkpoint"],
                        totals: {
                            total: 10,
                            count: 1
                        }
                    }
                    return checkpoint
                }
            }
        }

        return next
    }, seed)

    print(seed.log.samples[0])
    print(seed.log.label)
    print(seed.flags.length)
    print(seed.totals.total)

    return result
}

function inspect(copy: Session): number {
    copy.log.samples[0] = 90
    let total: number = 0

    for (let value: number of copy.log.samples) {
        if (value < 0) {
            continue
        }

        total = total + value

        if (total > 100) {
            break
        }
    }

    if (copy.totals.count == 0) {
        return -1
    }

    return total + copy.totals.total
}

function earlyTotal(copy: Session, enabled: boolean): number {
    if (enabled) {
        return copy.totals.total
    }

    return copy.totals.count
}

function choose(values: number[]): Session {
    let seed: Session = {
        log: {
            samples: [8],
            label: "choice"
        },
        flags: [],
        totals: {
            total: 0,
            count: 0
        }
    }

    let result: Session = values.reduce((accumulator: Session, value: number): Session => {
        if (value > 0) {
            let positive: Session = accumulator
            positive.log.samples.push(value)
            positive.log.label = positive.log.label + "+"
            positive.totals.total = positive.totals.total + value
            positive.totals.count = positive.totals.count + 1
            return positive
        } else {
            return {
                log: {
                    samples: [value],
                    label: "negative"
                },
                flags: ["negative"],
                totals: {
                    total: value,
                    count: 1
                }
            }
        }
    }, seed)

    print(seed.log.samples[0])
    return result
}

let report: Session = summarize(measurements())
print(report.log.samples[0])
print(report.log.samples[1])
print(report.log.label)
print(report.flags.length)
print(report.totals.total)
print(report.totals.count)
print(inspect(report))
print(report.log.samples[0])
print(earlyTotal(report, true))
print(report.totals.total)

let selected: Session = choose([1, -1])
print(selected.log.samples[0])
print(selected.log.label)
print(selected.totals.total)
print(selected.totals.count)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "inline reduce control-flow report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected inline reduce control-flow report artifact was not generated: ${path}")
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
		message(FATAL_ERROR "expected inline reduce control-flow report IR to contain ${symbol}")
	endif()
endforeach()

foreach(block IN ITEMS
	callback.if.then
	callback.if.else
	callback.if.end
	callback.return
	callback.return.value
	callback.return.result
	callback.cleanup)
	if(NOT ir MATCHES "${block}")
		message(FATAL_ERROR "expected inline reduce control-flow report IR to contain ${block}")
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
	message(FATAL_ERROR "inline reduce control-flow report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "50\nsource\n1\n0\n0\n3\ncheckpoint+\n2\n13\n2\n106\n0\n13\n13\n8\n-1\nnegative\n-1\n1\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "inline reduce control-flow report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
