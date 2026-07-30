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
type Summary = {
    total: number
    count: number
}

struct Totals {
    total: number
    count: number
}

type Audit = {
    count: number
}

struct ManagedDetails {
    scores: number[]
    label: string
}

struct ManagedBucket {
    details: ManagedDetails
    tags: string[]
    audit: Audit
}

function values(): number[] {
    return [1, 2, 3]
}

function append(accumulator: number[], value: number): number[] {
    accumulator.push(value)
    return accumulator
}

function appendRight(accumulator: number[], value: number): number[] {
    accumulator.push(value)
    return accumulator
}

function joinValue(accumulator: string, value: number): string {
    return accumulator + "x"
}

function summarize(accumulator: Summary, value: number): Summary {
    accumulator.total = accumulator.total + value
    accumulator.count = accumulator.count + 1
    return accumulator
}

function totalStruct(accumulator: Totals, value: number): Totals {
    accumulator.total = accumulator.total + value
    accumulator.count = accumulator.count + 1
    return accumulator
}

function collectManaged(accumulator: ManagedBucket, value: number): ManagedBucket {
    accumulator.details.scores.push(value)
    accumulator.details.label = accumulator.details.label + "x"
    accumulator.tags.push("item")
    accumulator.audit.count = accumulator.audit.count + value
    return accumulator
}

function replaceManaged(accumulator: ManagedBucket, value: number): ManagedBucket {
    return {
        details: {
            scores: [value],
            label: "fresh"
        },
        tags: ["replacement"],
        audit: {
            count: value
        }
    }
}

function chooseRight(accumulator: number[], value: number[]): number[] {
    return value
}

let seed: number[] = [10]
let collected: number[] = values().reduce(append, seed)
collected[0] = 99
print(seed[0])
print(collected[0])
print(collected.length)

let inlineSeed: number[] = [20]
let inlineCollected: number[] = values().reduce((accumulator: number[], value: number): number[] => {
    accumulator.push(value * 2)
    return accumulator
}, inlineSeed)
inlineCollected[0] = 88
print(inlineSeed[0])
print(inlineCollected[0])
print(inlineCollected.length)

let rightSeed: number[] = [0]
let right: number[] = values().reduceRight(appendRight, rightSeed)
print(right[0])
print(right[1])
print(right[3])

let textSeed: string = "v"
let text: string = values().reduce(joinValue, textSeed)
print(textSeed)
print(text)

let summarySeed: Summary = { total: 0, count: 0 }
let summary: Summary = values().reduce(summarize, summarySeed)
summary.total = 99
print(summarySeed.total)
print(summary.count)
print(summary.total)

let totalsSeed: Totals = { total: 0, count: 0 }
let totals: Totals = values().reduce(totalStruct, totalsSeed)
print(totalsSeed.total)
print(totals.total)
print(totals.count)

let managedSeed: ManagedBucket = {
    details: {
        scores: [5],
        label: "seed"
    },
    tags: ["base"],
    audit: {
        count: 0
    }
}
let managed: ManagedBucket = values().reduce(collectManaged, managedSeed)
managed.details.scores[0] = 77
print(managedSeed.details.scores[0])
print(managed.details.scores[0])
print(managedSeed.details.label)
print(managed.details.label)
print(managedSeed.tags.length)
print(managed.tags.length)
print(managedSeed.audit.count)
print(managed.audit.count)

let inlineManagedSeed: ManagedBucket = {
    details: {
        scores: [8],
        label: "inline"
    },
    tags: [],
    audit: {
        count: 0
    }
}
let inlineManaged: ManagedBucket = values().reduce((accumulator: ManagedBucket, value: number): ManagedBucket => {
    accumulator.details.scores.push(value * 10)
    accumulator.audit.count = accumulator.audit.count + value
    return accumulator
}, inlineManagedSeed)
print(inlineManagedSeed.details.scores.length)
print(inlineManaged.details.scores.length)
print(inlineManaged.audit.count)

let localSeed: ManagedBucket = {
    details: {
        scores: [9],
        label: "local"
    },
    tags: ["seed"],
    audit: {
        count: 0
    }
}
let localManaged: ManagedBucket = values().reduce((accumulator: ManagedBucket, value: number): ManagedBucket => {
    let next: ManagedBucket = accumulator
    next.details.scores.push(value)
    next.details.label = next.details.label + "!"
    next.audit.count = next.audit.count + value
    return next
}, localSeed)
localManaged.details.scores[0] = 90
print(localSeed.details.scores[0])
print(localManaged.details.scores[0])
print(localSeed.details.label)
print(localManaged.details.label)
print(localManaged.audit.count)

let branchSeed: ManagedBucket = {
    details: {
        scores: [11],
        label: "branch"
    },
    tags: ["seed"],
    audit: {
        count: 0
    }
}
let branchManaged: ManagedBucket = values().reduce((accumulator: ManagedBucket, value: number): ManagedBucket => {
    accumulator.audit.count = accumulator.audit.count + value
    return value == 2
        ? {
            details: {
                scores: [20],
                label: "fresh"
            },
            tags: ["replacement"],
            audit: {
                count: 20
            }
        }
        : accumulator
}, branchSeed)
branchManaged.details.scores[0] = 200
print(branchSeed.details.scores[0])
print(branchManaged.details.scores[0])
print(branchSeed.details.label)
print(branchManaged.details.label)
print(branchSeed.audit.count)
print(branchManaged.audit.count)

let flowSeed: ManagedBucket = {
    details: {
        scores: [7],
        label: "flow"
    },
    tags: ["seed"],
    audit: {
        count: 0
    }
}
let flowManaged: ManagedBucket = [1, -1, 2, 0, 3].reduce((accumulator: ManagedBucket, value: number): ManagedBucket => {
    let next: ManagedBucket = accumulator
    next.details.scores.push(value)
    next.details.label = next.details.label + "+"
    next.audit.count = next.audit.count + value

    if (value < 0) {
        let negative: ManagedBucket = {
            details: {
                scores: [-1],
                label: "negative"
            },
            tags: ["reset"],
            audit: {
                count: 0
            }
        }
        return negative
    }

    if (value == 0) {
        {
            let zero: ManagedBucket = {
                details: {
                    scores: [0],
                    label: "zero"
                },
                tags: ["zero"],
                audit: {
                    count: 10
                }
            }
            return zero
        }
    }

    return next
}, flowSeed)
flowManaged.details.scores[0] = 70
print(flowSeed.details.scores[0])
print(flowManaged.details.scores[0])
print(flowSeed.details.label)
print(flowManaged.details.label)
print(flowSeed.audit.count)
print(flowManaged.audit.count)

let bothSeed: ManagedBucket = {
    details: {
        scores: [30],
        label: "both"
    },
    tags: [],
    audit: {
        count: 0
    }
}
let bothManaged: ManagedBucket = [1, 2].reduce((accumulator: ManagedBucket, value: number): ManagedBucket => {
    if (value == 1) {
        return accumulator
    } else {
        return {
            details: {
                scores: [value],
                label: "else"
            },
            tags: ["else"],
            audit: {
                count: value
            }
        }
    }
}, bothSeed)
print(bothSeed.details.scores[0])
print(bothManaged.details.scores[0])
print(bothManaged.details.label)
print(bothManaged.audit.count)

let framedSeed: ManagedBucket = {
    details: {
        scores: [40],
        label: "framed"
    },
    tags: [],
    audit: {
        count: 0
    }
}
let framedManaged: ManagedBucket = [1, 2, 3].reduce((accumulator: ManagedBucket, value: number): ManagedBucket => {
    let next: ManagedBucket = accumulator
    let cursor: number = 0

    while (cursor < 3) {
        cursor = cursor + 1
        let loopLocal: ManagedBucket = {
            details: {
                scores: [cursor],
                label: "while"
            },
            tags: ["temporary"],
            audit: {
                count: cursor
            }
        }

        if (cursor == 1) {
            continue
        }

        break
    }

    for (let index: number = 0; index < 2; index = index + 1) {
        let forLocal: ManagedBucket = {
            details: {
                scores: [index],
                label: "for"
            },
            tags: ["temporary"],
            audit: {
                count: index
            }
        }

        if (index == 0) {
            continue
        }

        break
    }

    switch (value) {
        case 1:
            let caseOne: ManagedBucket = {
                details: {
                    scores: [1],
                    label: "case-one"
                },
                tags: ["temporary"],
                audit: {
                    count: 1
                }
            }
            break

        case 2:
            {
                let caseTwo: ManagedBucket = {
                    details: {
                        scores: [2],
                        label: "case-two"
                    },
                    tags: ["temporary"],
                    audit: {
                        count: 2
                    }
                }
            }
            break

        default:
            break
    }

    next.details.scores.push(value)
    next.details.label = next.details.label + "*"
    next.audit.count = next.audit.count + value
    return next
}, framedSeed)
print(framedSeed.details.scores.length)
print(framedManaged.details.scores.length)
print(framedSeed.details.label)
print(framedManaged.details.label)
print(framedSeed.audit.count)
print(framedManaged.audit.count)

let replaced: ManagedBucket = values().reduce(replaceManaged, managedSeed)
print(managedSeed.details.scores[0])
print(replaced.details.scores[0])
print(replaced.details.label)
print(replaced.audit.count)

let groups: number[][] = [[1], [2], [3]]
let selected: number[] = groups.reduce(chooseRight)
selected[0] = 9
print(groups[2][0])
print(selected[0])
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "aggregate reduce ownership compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected aggregate reduce ownership artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS
	yogi_array_clone
	yogi_array_destroy
	yogi_string_from_native_owned
	yogi_string_destroy
	yogi_object_clone
	yogi_object_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected aggregate reduce ownership IR to contain ${symbol}")
	endif()
endforeach()

foreach(block IN ITEMS
	callback.if.then
	callback.if.else
	callback.if.end
	callback.return
	callback.cleanup
	callback.cleanup.active
	callback.owner.active
	callback.while.condition
	callback.for.condition
	callback.switch.check)
	if(NOT ir MATCHES "${block}")
		message(FATAL_ERROR "expected aggregate reduce ownership IR to contain ${block}")
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
	message(FATAL_ERROR "aggregate reduce ownership executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "10\n99\n4\n20\n88\n4\n0\n3\n1\nv\nvxxx\n0\n3\n99\n0\n6\n3\n5\n77\nseed\nseedxxx\n1\n4\n0\n6\n1\n4\n6\n9\n90\nlocal\nlocal!!!\n6\n11\n200\nbranch\nfresh\n0\n23\n7\n70\nflow\nzero+\n0\n13\n30\n2\nelse\n2\n1\n4\nframed\nframed***\n0\n6\n5\n3\nfresh\n3\n3\n9\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "aggregate reduce ownership executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

function(expect_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
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
		message(FATAL_ERROR "${case_name} did not report ${expected}:\nstdout:\n${invalid_stdout}\nstderr:\n${invalid_stderr}")
	endif()
endfunction()

expect_invalid(
	inline_borrowed_element_accumulator
	"let groups: number[][] = [[1], [2]]\nlet seed: number[] = []\nlet result: number[] = groups.reduce((accumulator: number[], value: number[]): number[] => {\n    return value\n}, seed)\n"
	"cannot return a borrowed aggregate"
)

expect_invalid(
	pointer_struct_accumulator
	"struct Bucket {\n    values: ptr<number[]>\n}\nfunction collect(accumulator: Bucket, value: number): Bucket {\n    return accumulator\n}\nlet values: number[] = [1, 2]\nlet seedValues: number[] = []\nlet seed: Bucket = { values: &seedValues }\nlet bucket: Bucket = values.reduce(collect, seed)\n"
	"cannot use a pointer-bearing struct accumulator"
)

expect_invalid(
	inline_conditional_borrow
	"struct Bucket {\n    values: number[]\n}\nlet values: Bucket[] = [{ values: [1] }, { values: [2] }]\nlet seed: Bucket = { values: [] }\nlet bucket: Bucket = values.reduce((accumulator: Bucket, value: Bucket): Bucket => {\n    return value.values.length > 0 ? value : value\n}, seed)\n"
	"cannot return a borrowed aggregate"
)

expect_invalid(
	inline_if_borrow
	"struct Bucket {\n    values: number[]\n}\nlet values: Bucket[] = [{ values: [1] }, { values: [2] }]\nlet seed: Bucket = { values: [] }\nlet bucket: Bucket = values.reduce((accumulator: Bucket, value: Bucket): Bucket => {\n    if (value.values.length > 0) {\n        return value\n    }\n    return accumulator\n}, seed)\n"
	"cannot return a borrowed aggregate"
)
