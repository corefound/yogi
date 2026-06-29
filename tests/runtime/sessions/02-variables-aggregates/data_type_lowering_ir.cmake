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
        return { packed: true }
    }
}

interface Dimensions {
    width: number
    height: number
}

struct Size extends Dimensions {
}

type Named = {
    name: string
}

struct NamedPoint extends Named {
    point: Point
}

type Count = number
type ScoreList = number[]

struct MyNumber extends number {
}

struct Int8 extends number {
    layout(): IntegerLayout {
        return { size: 8, signed: true }
    }
}

struct UInt16 extends number {
    layout(): IntegerLayout {
        return { size: 16, signed: false }
    }
}

let num: number = 42
let flag: boolean = true
let message: string = "hello"
let scores: ScoreList = [1, 2, 3]
let count: Count = 7
let point: Point = { x: 1, y: 2 }
let packet: Packet = { id: 9, label: "pkt" }
let size: Size = { width: 3, height: 4 }
let namedPoint: NamedPoint = { name: "np", point: point }
let myNumber: MyNumber = 5
let signedByte: Int8 = -5
let unsignedWord: UInt16 = 65535

print(num)
print(flag)
print(message)
print(scores.length)
print(count)
print(point.x)
print(packet.label)
print(size.width)
print(namedPoint.name)
print(namedPoint.point.y)
print(myNumber)
print(signedByte)
print(unsignedWord)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "data type lowering compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(AST "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/ast.fb")
set(SIR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/sir.fb")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path "${EXECUTABLE}" "${AST}" "${SIR}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected data type lowering artifact was not generated: ${path}")
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
	message(FATAL_ERROR "data type lowering executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "42\ntrue\nhello\n3\n7\n1\npkt\n3\nnp\n2\n5\n-5\n65535\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "data type lowering executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

file(READ "${IR}" ir_text)

function(expect_ir pattern description)
	if(NOT ir_text MATCHES "${pattern}")
		message(FATAL_ERROR "${description}:\n${ir_text}")
	endif()
endfunction()

expect_ir("@_yogi_main_ts_num = internal global double" "number did not lower as double")
expect_ir("@_yogi_main_ts_flag = internal global i1" "boolean did not lower as i1")
expect_ir("@_yogi_main_ts_message = internal global ptr" "string did not lower as ptr")
expect_ir("@_yogi_main_ts_scores = internal global ptr" "array/type alias did not lower as aggregate ptr")
expect_ir("@_yogi_main_ts_count = internal global double" "primitive type alias Count did not lower as double")
expect_ir("%Point = type \\{ double, double \\}" "Point did not lower as a real LLVM struct")
expect_ir("%Packet = type <\\{ double, ptr \\}>" "packed Packet did not lower as packed LLVM struct")
expect_ir("%Size = type \\{ double, double \\}" "interface-inherited Size did not materialize fields as an LLVM struct")
expect_ir("%NamedPoint = type \\{ ptr, %Point \\}" "type-alias-inherited NamedPoint did not lower nested struct fields")
expect_ir("@_yogi_main_ts_point = internal global %Point" "Point global storage did not use %Point")
expect_ir("@_yogi_main_ts_packet = internal global %Packet" "Packet global storage did not use %Packet")
expect_ir("@_yogi_main_ts_size = internal global %Size" "Size global storage did not use %Size")
expect_ir("@_yogi_main_ts_namedPoint = internal global %NamedPoint" "NamedPoint global storage did not use %NamedPoint")
expect_ir("@_yogi_main_ts_myNumber = internal global double" "scalar number struct without IntegerLayout did not lower as double")
expect_ir("@_yogi_main_ts_signedByte = internal global i8 0" "signed Int8 did not lower as i8")
expect_ir("@_yogi_main_ts_unsignedWord = internal global i16 0" "unsigned UInt16 did not lower as i16")
expect_ir("store i8 -5, ptr @_yogi_main_ts_signedByte" "signed Int8 literal was not stored as i8")
expect_ir("store i16 -1, ptr @_yogi_main_ts_unsignedWord" "unsigned UInt16 literal did not store the 16-bit bit pattern")
expect_ir("sitofp i8 .* to double" "signed Int8 print/numeric interop did not use sitofp")
expect_ir("uitofp i16 .* to double" "unsigned UInt16 print/numeric interop did not use uitofp")
