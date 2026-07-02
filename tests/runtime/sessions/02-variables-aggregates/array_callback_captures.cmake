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
function expressionMapCapture(): number {
    let values: number[] = [1, 2, 3]
    let offset: number = 10
    let result: number[] = values.map((value: number): number => value + offset)

    return result[0] * 100 + result[1] * 10 + result[2]
}

function blockMapCapture(): number {
    let values: number[] = [1, 2, 3]
    let offset: number = 10
    let result: number[] = values.map((value: number): number => {
        let next: number = value + offset
        return next
    })

    return result[0] * 100 + result[1] * 10 + result[2]
}

function multipleCapture(): number {
    let values: number[] = [1, 2, 3]
    let factor: number = 2
    let offset: number = 10
    let result: number[] = values.map((value: number): number => {
        return value * factor + offset
    })

    return result[0] * 100 + result[1] * 10 + result[2]
}

function filterCapture(): number {
    let values: number[] = [1, 2, 3, 4, 5]
    let min: number = 3
    let result: number[] = values.filter((value: number): boolean => {
        return value > min
    })

    return result[0] * 10 + result[1]
}

function findCapture(): number {
    let values: number[] = [1, 2, 3, 4, 5]
    let target: number = 4
    let found: number | undefined = values.find((value: number): boolean => {
        return value == target
    })

    return values.findIndex((value: number): boolean => {
        return value == target
    })
}

function predicateCapture(): number {
    let evens: number[] = [2, 4, 6]
    let divisor: number = 2
    let allEven: boolean = evens.every((value: number): boolean => {
        return value % divisor == 0
    })

    let values: number[] = [1, 3, 6]
    let threshold: number = 5
    let hasLarge: boolean = values.some((value: number): boolean => {
        return value > threshold
    })

    let allScore: number = allEven ? 1 : 0
    let someScore: number = hasLarge ? 1 : 0

    return allScore * 10 + someScore
}

function reduceCapture(): number {
    let values: number[] = [1, 2, 3]
    let bonus: number = 10
    return values.reduce((acc: number, value: number): number => {
        return acc + value + bonus
    }, 0)
}

function reduceRightCapture(): number {
    let values: number[] = [1, 2, 3]
    let bonus: number = 1
    return values.reduceRight((acc: number, value: number): number => {
        return acc * 10 + value + bonus
    }, 0)
}

function shadowParameter(): number {
    let values: number[] = [1, 2, 3]
    let value: number = 100
    let result: number[] = values.map((value: number): number => {
        return value + 1
    })

    return result[0] * 100 + result[1] * 10 + result[2]
}

function shadowLocal(): number {
    let values: number[] = [1, 2, 3]
    let offset: number = 10
    let result: number[] = values.map((value: number): number => {
        let offset: number = 100
        return value + offset
    })

    return result[0] * 10000 + result[1] * 100 + result[2]
}

function updatedCaptureValue(): number {
    let values: number[] = [1, 2, 3]
    let offset: number = 10
    offset = 20
    let result: number[] = values.map((value: number): number => {
        return value + offset
    })

    return result[0] * 100 + result[1] * 10 + result[2]
}

function mutableCaptureWrite(): number {
    let values: number[] = [1, 2, 3]
    let total: number = 0
    values.forEach((value: number): void => {
        total = total + value
    })

    return total
}

function capturedString(): string {
    let values: string[] = ["a", "b", "c"]
    let prefix: string = "item-"
    let result: string[] = values.map((value: string): string => {
        return prefix + value
    })

    return result[0] + result[1] + result[2]
}

function capturedArrayIndexing(): number {
    let values: number[] = [1, 2, 3]
    let weights: number[] = [10, 20, 30]
    let result: number[] = values.map((value: number, index: number): number => {
        return value * weights[index]
    })

    return result[0] * 10000 + result[1] * 100 + result[2]
}

function capturedFixedShape(): number {
    let rows: number[] = [0, 1]
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]
    let result: number[] = rows.map((rowIndex: number): number => {
        return matrix[rowIndex, 2]
    })

    return result[0] * 10 + result[1]
}

function capturedBorrowedView(): number {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]
    let row: number[3] = matrix[1]
    let indices: number[] = [0, 1, 2]
    let result: number[] = indices.map((index: number): number => {
        return row[index]
    })

    return result[0] * 100 + result[1] * 10 + result[2]
}

function flatMapCapture(): number {
    let values: number[] = [1, 2]
    let offset: number = 10
    let result: number[] = values.flatMap((value: number): number[] => {
        return [value, value + offset]
    })

    return result[0] * 1000 + result[1] * 100 + result[2] * 10 + result[3]
}

function findIndexCapture(): number {
    let values: number[] = [1, 2, 3, 4, 5]
    let target: number = 4
    let first: number = values.findIndex((value: number): boolean => {
        return value == target
    })
    let last: number = values.findLastIndex((value: number): boolean => {
        return value < target
    })

    return first * 10 + last
}

print(expressionMapCapture())
print(blockMapCapture())
print(multipleCapture())
print(filterCapture())
print(findCapture())
print(predicateCapture())
print(reduceCapture())
print(reduceRightCapture())
print(shadowParameter())
print(shadowLocal())
print(updatedCaptureValue())
print(mutableCaptureWrite())
print(capturedString())
print(capturedArrayIndexing())
print(capturedFixedShape())
print(capturedBorrowedView())
print(flatMapCapture())
print(findIndexCapture())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array callback captures pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array callback captures artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS yogi_array_get yogi_array_push yogi_array_append_array)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected callback captures IR to contain ${symbol}")
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
	message(FATAL_ERROR "array callback captures executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1233\n1233\n1356\n45\n3\n11\n36\n432\n234\n1020303\n2343\n6\nitem-aitem-bitem-c\n104090\n36\n456\n2132\n32\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array callback captures executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

function(expect_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/invalid/${case_name}")
	file(REMOVE_RECURSE "${case_dir}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source_file "${case_dir}/main.ts")
	file(WRITE "${source_file}" "${source}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source_file}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE invalid_result
		OUTPUT_VARIABLE invalid_stdout
		ERROR_VARIABLE invalid_stderr
	)

	if(invalid_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly compiled\nstdout:\n${invalid_stdout}")
	endif()

	if(NOT invalid_stderr MATCHES "${expected}")
		message(FATAL_ERROR "${case_name} did not report ${expected}:\n${invalid_stderr}")
	endif()
endfunction()

expect_invalid(
	"invalid_capture_type"
	"let values: number[] = [1, 2, 3]\nlet offset: string = \"x\"\nlet result: number[] = values.map((value: number): number => {\n    return value + offset\n})\n"
	"cannot be applied"
)

expect_invalid(
	"readonly_borrowed_view_capture_mutation"
	"const matrix: number[2, 3] = [\n    [1, 2, 3],\n    [4, 5, 6]\n]\nlet row: number[3] = matrix[1]\nlet indices: number[] = [0, 1, 2]\nindices.forEach((index: number): void => {\n    row[index] = 99\n})\n"
	"cannot mutate borrowed view"
)
