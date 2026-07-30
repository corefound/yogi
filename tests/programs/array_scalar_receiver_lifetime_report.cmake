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
function makeSeries(seed: number): number[] {
    return [seed, seed + 1, seed + 2, seed + 3]
}

function makeMixed(): (number | string)[] {
    return [4, "six", 6]
}

function isEven(value: number): boolean {
    return value % 2 == 0
}

function isPositive(value: number): boolean {
    return value > 0
}

function aboveSix(value: number): boolean {
    return value > 6
}

function add(total: number, value: number): number {
    return total + value
}

function weighted(total: number, value: number, index: number): number {
    return total + value * (index + 1)
}

function doubleValue(value: number): number {
    return value * 2
}

let visited: number = 0

function record(value: number): void {
    visited = visited + value
}

function temporaryMethodReport(seed: number): void {
    let last: number = makeSeries(seed).at(-1) as number
    let dynamicLast: number | undefined = makeSeries(seed).at(-1)
    let found: number = makeSeries(seed).find(aboveSix) as number
    let foundLast: number = makeSeries(seed).findLast(isEven) as number

    print(makeSeries(seed).includes(seed + 2))
    print(makeSeries(seed).indexOf(seed + 1))
    print([seed, seed + 1, seed].lastIndexOf(seed))
    print(last)
    print(dynamicLast as number)
    print(makeSeries(seed).some(isEven))
    print(makeSeries(seed).every(isPositive))
    print(makeSeries(seed).findIndex(aboveSix))
    print(makeSeries(seed).findLastIndex(isEven))
    print(found)
    print(foundLast)
    print(makeSeries(seed).reduce(add, 0))
    print(makeSeries(seed).reduceRight(weighted, 0))
    print(makeSeries(seed).join("-"))
    print(makeSeries(seed).toString())

    makeSeries(seed).forEach(record)
    print(visited)
    print(makeSeries(seed).push(seed + 4))
    print(makeSeries(seed).unshift(seed - 1))
    print(makeSeries(seed).pop() as number)
    print(makeSeries(seed).shift() as number)
    print(makeSeries(seed).slice(1, 4).some(isEven))
    print(makeSeries(seed).map(doubleValue).join(":"))
    print(makeSeries(seed).toReversed().reduce(add, 0))
    print(makeSeries(seed).toSorted().length)
}

function cleanupAcrossControlFlow(): number {
    let total: number = 0
    let index: number = 0

    while (index < 5) {
        index = index + 1
        total = total + makeSeries(index).reduce(add, 0)

        if (index == 2) {
            continue
        }

        if (makeSeries(index).some(aboveSix)) {
            return total
        }
    }

    return total
}

temporaryMethodReport(4)
print(cleanupAcrossControlFlow())

let dynamicNeedle: number | string = "six"
let dynamicFound: boolean = makeMixed().includes(dynamicNeedle)
print(dynamicFound)
print(dynamicNeedle as string)

let owner: number[] = [10, 20, 30]
let pointer: ptr<number[]> = &owner
let view: number[] = pointer
print(view.includes(20))
print(owner.length)
view[0] = 99
print(owner[0])
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array scalar receiver lifetime report compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array scalar receiver lifetime report artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS
	yogi_array_at_index
	yogi_array_includes
	yogi_array_index_of
	yogi_array_last_index_of
	yogi_array_join
	yogi_array_destroy
	yogi_any_retain
	yogi_any_clone_owned
	yogi_observe_cleanup)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array scalar receiver lifetime report IR to contain ${symbol}")
	endif()
endforeach()

string(REGEX MATCHALL "call void @yogi_array_destroy" destroy_calls "${ir}")
list(LENGTH destroy_calls destroy_count)
if(destroy_count LESS 24)
	message(FATAL_ERROR "expected at least 24 temporary array cleanup calls, found ${destroy_count}")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "array scalar receiver lifetime report executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "true\n1\n2\n7\n7\ntrue\ntrue\n3\n2\n7\n6\n22\n60\n4-5-6-7\n4,5,6,7\n22\n5\n5\n7\n4\ntrue\n8:10:12:14\n22\n4\n64\ntrue\nsix\ntrue\n3\n99\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array scalar receiver lifetime report printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(run_stderr MATCHES "ownership error|double-free|use-after-free|LeakSanitizer|AddressSanitizer|UndefinedBehaviorSanitizer")
	message(FATAL_ERROR "array scalar receiver lifetime report emitted a memory diagnostic:\n${run_stderr}")
endif()
