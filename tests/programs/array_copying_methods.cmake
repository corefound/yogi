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
function ascending(left: number, right: number): number {
    return left - right
}

function isEven(value: number): boolean {
    return value % 2 == 0
}

let source: number[] = [3, 1, 20, 2]
let sliced: number[] = source.slice(1, -1)
let concatenated: number[] = source.concat([7, 8], 9)
let spliced: number[] = source.toSpliced(1, 2, 4, 5)
let reversed: number[] = source.toReversed()
let sorted: number[] = source.toSorted(ascending)
let nested: number[][] = [[1, 2], [3], [4, 5]]
let flattened: number[] = nested.flat(1)
let replaced: number[] = source.with(-1, 99)
let mapped: number[] = source.map((value: number): number => value * 10)
let filtered: number[] = source.filter(isEven)
let expanded: number[] = source.flatMap((value: number): number[] => [value, value + 10])

print(sliced[0])
print(sliced[1])
print(sliced.length)
print(concatenated[4])
print(concatenated[6])
print(concatenated.length)
print(spliced[1])
print(spliced[2])
print(source[1])
print(reversed[0])
print(reversed[3])
print(source[0])
print(sorted[0])
print(sorted[3])
print(source[0])
print(flattened[0])
print(flattened[4])
print(flattened.length)
print(replaced[3])
print(source[3])
print(mapped[2])
print(filtered[0])
print(filtered[1])
print(expanded[1])
print(expanded[6])
print(expanded[7])
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array copying methods program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array copying methods artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS
		yogi_array_slice
		yogi_array_clone
		yogi_array_append_array
		yogi_array_to_spliced
		yogi_array_to_reversed
		yogi_array_flat
		yogi_array_with
		yogi_array_push
		yogi_array_get)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array copying methods IR to contain ${symbol}")
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
	message(FATAL_ERROR "array copying methods executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1\n20\n2\n7\n9\n7\n4\n5\n1\n2\n3\n3\n1\n20\n3\n1\n5\n5\n99\n2\n200\n20\n2\n13\n2\n12\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array copying methods printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
