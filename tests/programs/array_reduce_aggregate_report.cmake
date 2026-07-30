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
type Batch = {
    name: string
    scores: number[]
}

function readings(seed: number): number[] {
    return [seed, seed + 1, seed + 2]
}

function appendScore(accumulator: number[], value: number): number[] {
    accumulator.push(value)
    return accumulator
}

function prependReport(accumulator: string, value: number): string {
    return accumulator + ":item"
}

function updateBatch(accumulator: Batch, value: number): Batch {
    accumulator.scores.push(value * 10)
    return accumulator
}

function buildReport(seed: number): number {
    let baseline: number[] = [100]
    let collected: number[] = readings(seed).reduce(appendScore, baseline)
    let label: string = readings(seed).reduceRight(prependReport, "batch")
    let batchSeed: Batch = { name: "daily", scores: [5] }
    let batch: Batch = readings(seed).reduce(updateBatch, batchSeed)

    collected[0] = 200
    batch.scores[0] = 50

    print(baseline[0])
    print(collected[0])
    print(collected.length)
    print(label)
    print(batchSeed.scores[0])
    print(batch.scores[0])
    print(batch.scores.length)

    let checksum: number = 0
    for (let value: number of collected) {
        if (value == seed + 1) {
            continue
        }

        checksum = checksum + value

        if (checksum > 205) {
            break
        }
    }

    if (batch.scores.length == 4) {
        return checksum + batch.scores[3]
    }

    return -1
}

print(buildReport(1))
print(buildReport(4))
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "aggregate reduce report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected aggregate reduce report artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS
	yogi_array_clone
	yogi_array_destroy
	yogi_object_clone
	yogi_object_destroy
	yogi_string_from_native_owned
	yogi_string_destroy
	yogi_observe_cleanup)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected aggregate reduce report IR to contain ${symbol}")
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
	message(FATAL_ERROR "aggregate reduce report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "100\n200\n4\nbatch:item:item:item\n5\n50\n4\n234\n100\n200\n4\nbatch:item:item:item\n5\n50\n4\n270\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "aggregate reduce report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
