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
struct Point {
    x: number
    y: number
}

struct Packet {
    id: number
    label: string

    layout(): Layout<Packet> {
        return { packed: true, align: 8, storage: "stack" }
    }
}

struct BasePacket {
    version: number

    validate(): boolean {
        return this.version == 1
    }
}

struct ChildPacket extends BasePacket {
    checksum: number

    layout(): Layout<ChildPacket> {
        return { packed: this.hasParent, align: this.fieldCount }
    }

    validate(): boolean {
        return this.checksum == 7
    }
}

struct UserId extends number {
}

interface Labeled {
    label: string
}

interface Named {
    name: string
    aliases: string[]
}

type Tagged = {
    tag: string
    tags: string[]
}

interface Profile {
    name: string
    scores: number[]
}

type Report = {
    label: string
    total: number
}

type ScoreList = number[]
type Count = number

interface Box<T> {
    value: T
}

type Pair<T, U = number> = {
    first: T
    second: U
}

type NamedList<T> = {
    name: string
    items: T[]
}

interface TextLabel<T extends string> {
    label: T
}

type Metric<T extends number = number> = {
    value: T
}

type AuditRecord = {
    readonly id: number
    note?: string
}

type NamedPart = {
    name: string
}

type ValuePart = {
    value: number
}

type NamedMetric = NamedPart & ValuePart

interface ConfigShape {
    readonly id: number
    label?: string
}

interface Dimensions {
    width: number
    height: number
}

type Bounds = {
    width: number
    height: number
}

struct ScoreBoard extends Labeled {
    scores: number[]

    validate(): boolean {
        return this.scores.length == 3
    }
}

struct Playlist extends Named {
    songs: string[]

    validate(): boolean {
        return this.aliases.length == 1 && this.songs.length == 2
    }
}

struct TaggedScore extends Tagged {
    points: number[]

    validate(): boolean {
        return this.tags.length == 2 && this.points.length == 3
    }
}

struct PointBox {
    point: Point

    validate(): boolean {
        return this.point.x == 2
    }
}

struct Size extends Dimensions {
}

struct LabelledScore extends TextLabel<string> {
    score: number
}

struct Config extends ConfigShape {
}

function makePoint(): Point {
    return { x: 2, y: 3 }
}

function sumPoint(value: Point): number {
    return value.x + value.y
}

function boardTotal(value: ScoreBoard): number {
    return (value.scores.at(0) as number) + (value.scores.at(1) as number) + (value.scores.at(2) as number)
}

function localBoardLast(): number {
    let local: ScoreBoard = { label: "local", scores: [7, 8, 9] }
    return local.scores.at(2) as number
}

function profileScore(value: Profile): number {
    return value.scores.length
}

function makeReport(): Report {
    return { label: "daily", total: 42 }
}

function area(value: Dimensions): number {
    return value.width * value.height
}

function boundsArea(value: Bounds): number {
    return value.width * value.height
}

function readNumberBox(value: Box<number>): number {
    return value.value
}

function makePair(): Pair<string> {
    return { first: "left", second: 5 }
}

let point: Point = { x: 4, y: 5 }
let packet: Packet = { id: 9, label: "ok" }
let child: ChildPacket = { version: 1, checksum: 7 }
let fromFunction: Point = makePoint()
let board: ScoreBoard = { label: "scores", scores: [1, 2, 3] }
let playlist: Playlist = { name: "mix", aliases: ["daily"], songs: ["intro", "outro"] }
let tagged: TaggedScore = { tag: "level", tags: ["fast", "safe"], points: [8, 9, 10] }
let profile: Profile = { name: "ana", scores: [2, 4, 6] }
let report: Report = makeReport()
let scoreList: ScoreList = [5, 6, 7, 8]
let count: Count = 12
let size: Size = { width: 3, height: 4 }
let dimensions: Dimensions = { width: size.width, height: size.height }
let bounds: Bounds = { width: size.width, height: size.height }
let stringBox: Box<string> = { value: "boxed" }
let numberBox: Box<number> = { value: 14 }
let pair: Pair<string> = makePair()
let list: NamedList<number> = { name: "nums", items: [1, 2, 3] }
let metric: Metric = { value: 21 }
let labelled: LabelledScore = { label: "score", score: 30 }
let audit: AuditRecord = { id: 44 }
let namedMetric: NamedMetric = { name: "nm", value: 55 }
let config: Config = { id: 66 }
let box: PointBox = { point: fromFunction }
let id: UserId = 10

print(point.x)
print(point.y)
point.x = 6
print(point.x)
print(packet.id)
print(packet.label)
print(child.version)
print(child.checksum)
print(sumPoint(fromFunction))
print(board.label)
print(board.scores.at(1) as number)
board.scores = [4, 5, 6]
print(board.scores.at(0) as number)
print(boardTotal(board))
print(localBoardLast())
print(playlist.name)
print(playlist.aliases.length)
print(playlist.songs.length)
print(tagged.tag)
print(tagged.tags.length)
print(tagged.points.at(2) as number)
print(profile.name)
print(profileScore(profile))
print(report.label)
print(report.total)
print(scoreList.length)
print(count)
print(area(dimensions))
print(boundsArea(bounds))
print(stringBox.value)
print(readNumberBox(numberBox))
print(pair.first)
print(pair.second)
print(list.name)
print(list.items.length)
print(metric.value)
print(labelled.label)
print(labelled.score)
print(audit.id)
print(audit.note ?? "none")
print(namedMetric.name)
print(namedMetric.value)
print(config.id)
print(config.label ?? "default")
print(box.point.y)
print(id)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "struct declarations pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(AST "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/ast.fb")
set(SIR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/sir.fb")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path "${EXECUTABLE}" "${AST}" "${SIR}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected struct pipeline artifact was not generated: ${path}")
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
	message(FATAL_ERROR "struct declarations executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "4\n5\n6\n9\nok\n1\n7\n5\nscores\n2\n4\n15\n9\nmix\n1\n2\nlevel\n2\n10\nana\n3\ndaily\n42\n4\n12\n12\n12\nboxed\n14\nleft\n5\nnums\n3\n21\nscore\n30\n44\nnone\nnm\n55\n66\ndefault\n3\n10\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "struct declarations executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

file(READ "${IR}" ir_text)

if(NOT ir_text MATCHES "%Point = type \\{ double, double \\}")
	message(FATAL_ERROR "Point was not lowered as a real LLVM struct:\n${ir_text}")
endif()

if(NOT ir_text MATCHES "%Packet = type <\\{ double, ptr \\}>")
	message(FATAL_ERROR "Packet packed layout was not lowered as a packed LLVM struct:\n${ir_text}")
endif()

if(NOT ir_text MATCHES "%ChildPacket = type <\\{ double, double \\}>")
	message(FATAL_ERROR "layout() compile-time this metadata did not lower ChildPacket as packed:\n${ir_text}")
endif()

if(NOT ir_text MATCHES "%Playlist = type \\{")
	message(FATAL_ERROR "interface-inherited string[] fields were not lowered as a real LLVM struct:\n${ir_text}")
endif()

if(NOT ir_text MATCHES "%TaggedScore = type \\{")
	message(FATAL_ERROR "type-alias-inherited fields were not lowered as a real LLVM struct:\n${ir_text}")
endif()

if(NOT ir_text MATCHES "BasePacket_validate")
	message(FATAL_ERROR "inherited BasePacket validate hook was not lowered:\n${ir_text}")
endif()

if(NOT ir_text MATCHES "ChildPacket_validate")
	message(FATAL_ERROR "ChildPacket validate hook was not lowered:\n${ir_text}")
endif()

if(NOT ir_text MATCHES "yogi_struct_validate_failed")
	message(FATAL_ERROR "struct validate failure runtime hook was not emitted:\n${ir_text}")
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
		message(FATAL_ERROR "${case_name} did not report ${expected}:\n${invalid_stderr}")
	endif()
endfunction()

function(expect_runtime_failure case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source_file "${case_dir}/main.ts")
	file(WRITE "${source_file}" "${source}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source_file}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE compile_result
		OUTPUT_VARIABLE compile_stdout
		ERROR_VARIABLE compile_stderr
	)

	if(NOT compile_result EQUAL 0)
		message(FATAL_ERROR "${case_name} failed to compile:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
	endif()

	execute_process(
		COMMAND "${case_dir}/packages/.cache/bin/main"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE run_result
		OUTPUT_VARIABLE run_stdout
		ERROR_VARIABLE run_stderr
	)

	if(run_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly ran successfully:\nstdout:\n${run_stdout}")
	endif()

	if(NOT run_stderr MATCHES "${expected}")
		message(FATAL_ERROR "${case_name} did not report ${expected}:\n${run_stderr}")
	endif()
endfunction()

expect_invalid(
	duplicate_field
	"struct Point {\n    x: number\n    x: string\n}\n"
	"duplicate field"
)

expect_invalid(
	unknown_member
	"struct Point {\n    x: number\n    reset(): void {}\n}\n"
	"can only contain fields"
)

expect_invalid(
	missing_property
	"struct Point {\n    x: number\n    y: number\n}\nlet point: Point = { x: 1 }\n"
	"missing required property"
)

expect_invalid(
	wrong_property_type
	"struct Point {\n    x: number\n    y: number\n}\nlet point: Point = { x: \"bad\", y: 2 }\n"
	"property .*x.* must be"
)

expect_invalid(
	unknown_extends
	"struct UserId extends MissingType {\n}\n"
	"cannot find type"
)

expect_invalid(
	non_object_type_extends
	"type Numeric = number\nstruct Bad extends Numeric {\n    value: number\n}\n"
	"can only extend an object-like"
)

expect_invalid(
	interface_missing_property
	"interface Profile {\n    name: string\n    scores: number[]\n}\nlet profile: Profile = { name: \"ana\" }\n"
	"missing required property"
)

expect_invalid(
	type_alias_wrong_property
	"type Report = {\n    label: string\n    total: number\n}\nlet report: Report = { label: \"daily\", total: \"bad\" }\n"
	"property .*total.* must be"
)

expect_invalid(
	interface_argument_mismatch
	"interface Profile {\n    name: string\n    scores: number[]\n}\nfunction score(value: Profile): number {\n    return value.scores.length\n}\nscore({ name: \"ana\" })\n"
	"argument .* must be"
)

expect_invalid(
	struct_to_interface_variable
	"interface Dimensions {\n    width: number\n    height: number\n}\nstruct Size extends Dimensions {\n}\nlet size: Size = { width: 3, height: 4 }\nlet dimensions: Dimensions = size\n"
	"cannot implicitly convert"
)

expect_invalid(
	struct_to_interface_argument
	"interface Dimensions {\n    width: number\n    height: number\n}\nstruct Size extends Dimensions {\n}\nfunction area(value: Dimensions): number {\n    return value.width * value.height\n}\nlet size: Size = { width: 3, height: 4 }\narea(size)\n"
	"cannot implicitly convert"
)

expect_invalid(
	struct_to_type_return
	"type Bounds = {\n    width: number\n    height: number\n}\nstruct Size extends Bounds {\n}\nfunction makeBounds(): Bounds {\n    let size: Size = { width: 3, height: 4 }\n    return size\n}\n"
	"cannot implicitly convert"
)

expect_invalid(
	generic_missing_argument
	"interface Box<T> {\n    value: T\n}\nlet box: Box = { value: 1 }\n"
	"expects 1 type argument"
)

expect_invalid(
	generic_too_many_arguments
	"type Pair<T, U = number> = {\n    first: T\n    second: U\n}\nlet pair: Pair<string, number, boolean> = { first: \"x\", second: 1 }\n"
	"expects 2 type argument"
)

expect_invalid(
	generic_constraint_violation
	"interface TextLabel<T extends string> {\n    label: T\n}\nlet label: TextLabel<number> = { label: 1 }\n"
	"does not satisfy constraint"
)

expect_invalid(
	generic_substituted_wrong_property
	"interface Box<T> {\n    value: T\n}\nlet box: Box<number> = { value: \"bad\" }\n"
	"property .*value.* must be"
)

expect_invalid(
	readonly_type_property_assignment
	"type AuditRecord = {\n    readonly id: number\n    note?: string\n}\nlet audit: AuditRecord = { id: 1 }\naudit.id = 2\n"
	"readonly"
)

expect_invalid(
	readonly_struct_field_assignment
	"interface ConfigShape {\n    readonly id: number\n    label?: string\n}\nstruct Config extends ConfigShape {\n}\nlet config: Config = { id: 1 }\nconfig.id = 2\n"
	"readonly"
)

expect_invalid(
	intersection_missing_property
	"type NamedPart = {\n    name: string\n}\ntype ValuePart = {\n    value: number\n}\ntype NamedMetric = NamedPart & ValuePart\nlet metric: NamedMetric = { name: \"nm\" }\n"
	"missing required property"
)

expect_invalid(
	intersection_wrong_property
	"type NamedPart = {\n    name: string\n}\ntype ValuePart = {\n    value: number\n}\ntype NamedMetric = NamedPart & ValuePart\nlet metric: NamedMetric = { name: \"nm\", value: \"bad\" }\n"
	"property .*value.* must be"
)

expect_invalid(
	validate_wrong_return
	"struct Point {\n    x: number\n    validate(): number {\n        return 1\n    }\n}\n"
	"validate\\(\\).*must return .*boolean"
)

expect_invalid(
	layout_any_return
	"struct Packet {\n    id: number\n    layout(): any {\n        return { packed: true }\n    }\n}\n"
	"layout\\(\\).*must return .*Layout"
)

expect_invalid(
	layout_any_generic
	"struct Packet {\n    id: number\n    layout(): Layout<any> {\n        return { packed: true }\n    }\n}\n"
	"layout\\(\\).*must return .*Layout"
)

expect_invalid(
	layout_runtime_this_field
	"struct Packet {\n    id: number\n    layout(): Layout<Packet> {\n        return { storage: this.id }\n    }\n}\n"
	"layout\\(\\).*cannot access runtime field"
)

expect_invalid(
	validate_mutates_this
	"struct Packet {\n    id: number\n    validate(): boolean {\n        this.id = 2\n        return true\n    }\n}\nlet packet: Packet = { id: 1 }\n"
	"cannot mutate .*this"
)

expect_runtime_failure(
	validate_runtime_failure
	"struct BadPacket {\n    id: number\n    validate(): boolean {\n        return this.id == 2\n    }\n}\nlet packet: BadPacket = { id: 1 }\nprint(packet.id)\n"
	"struct validation error"
)
