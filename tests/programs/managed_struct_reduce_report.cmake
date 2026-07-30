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
type Counters = {
    total: number
    count: number
}

struct Trail {
    values: number[]
    label: string
}

struct Rollup {
    trail: Trail
    tags: string[]
    counters: Counters
}

function roll(accumulator: Rollup, value: number): Rollup {
    if (value < 0) {
        return {
            trail: {
                values: [0],
                label: "reset"
            },
            tags: ["reset"],
            counters: {
                total: 0,
                count: 0
            }
        }
    }

    accumulator.trail.values.push(value)
    accumulator.trail.label = accumulator.trail.label + "+"
    accumulator.tags.push("accepted")
    accumulator.counters.total = accumulator.counters.total + value
    accumulator.counters.count = accumulator.counters.count + 1
    return accumulator
}

function rollRight(accumulator: Rollup, value: number): Rollup {
    accumulator.trail.values.push(value * 10)
    accumulator.trail.label = accumulator.trail.label + "!"
    accumulator.counters.total = accumulator.counters.total + value
    accumulator.counters.count = accumulator.counters.count + 1
    return accumulator
}

function inspect(copy: Rollup): number {
    copy.trail.values[0] = 999
    let checksum: number = 0

    for (let value: number of copy.trail.values) {
        if (value < 0) {
            continue
        }

        checksum = checksum + value

        if (checksum > 1000) {
            break
        }
    }

    if (copy.counters.count == 0) {
        return -1
    }

    return checksum + copy.counters.total
}

function build(values: number[]): Rollup {
    let seed: Rollup = {
        trail: {
            values: [100],
            label: "run"
        },
        tags: ["seed"],
        counters: {
            total: 0,
            count: 0
        }
    }
    let result: Rollup = values.reduce(roll, seed)

    print(seed.trail.values[0])
    print(seed.trail.label)
    print(seed.tags.length)
    print(seed.counters.total)

    return result
}

let values: number[] = [3, -1, 5]
let report: Rollup = build(values)

print(report.trail.values[0])
print(report.trail.values[1])
print(report.trail.label)
print(report.tags.length)
print(report.counters.total)
print(report.counters.count)
print(inspect(report))
print(report.trail.values[0])

let rightSeed: Rollup = {
    trail: {
        values: [1],
        label: "R"
    },
    tags: [],
    counters: {
        total: 0,
        count: 0
    }
}
let right: Rollup = [2, 4].reduceRight(rollRight, rightSeed)
print(rightSeed.trail.values.length)
print(right.trail.values.length)
print(right.trail.values[1])
print(right.trail.values[2])
print(right.counters.total)

let inlineSeed: Rollup = {
    trail: {
        values: [7],
        label: "inline"
    },
    tags: [],
    counters: {
        total: 0,
        count: 0
    }
}
let inlineResult: Rollup = [1, 2].reduce((accumulator: Rollup, value: number): Rollup => {
    accumulator.trail.values.push(value)
    accumulator.counters.total = accumulator.counters.total + value
    return accumulator
}, inlineSeed)
print(inlineSeed.trail.values.length)
print(inlineResult.trail.values.length)
print(inlineResult.counters.total)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "managed struct reduce report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected managed struct reduce report artifact was not generated: ${path}")
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
		message(FATAL_ERROR "expected managed struct reduce report IR to contain ${symbol}")
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
	message(FATAL_ERROR "managed struct reduce report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "100\nrun\n1\n0\n0\n5\nreset+\n2\n5\n1\n1009\n0\n1\n3\n40\n20\n6\n1\n3\n3\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "managed struct reduce report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
