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
type User = {
    name: string
    age: number
    active: boolean
    scores: number[]
}

struct Point {
    x: number
    y: number
}

let scores: number[] = [1, 2, 3]
let user: User = { name: "Ana", age: 30, active: true, scores: scores }
let point: Point = { x: 4, y: 5 }

print(scores)
print(user)
print(point)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "print collections pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

if(NOT EXISTS "${EXECUTABLE}")
	message(FATAL_ERROR "expected executable was not generated: ${EXECUTABLE}")
endif()

if(NOT EXISTS "${IR}")
	message(FATAL_ERROR "expected LLVM IR was not generated: ${IR}")
endif()

if(NOT EXISTS "${OBJECT}")
	message(FATAL_ERROR "expected object file was not generated: ${OBJECT}")
endif()

file(READ "${IR}" ir)

foreach(symbol
		yogi_print_array
		yogi_print_object
		yogi_object_create
		yogi_object_set
		yogi_object_destroy
		yogi_array_create)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected print collections IR to contain ${symbol}")
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
	message(FATAL_ERROR "print collections executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(run_stdout MATCHES "aggregate")
	message(FATAL_ERROR "print collections should not print aggregate placeholder:\n${run_stdout}")
endif()

string(ASCII 27 ESC)
set(RESET "${ESC}[0m")
set(CYAN "${ESC}[96m")
set(MAGENTA "${ESC}[95m")
set(GREEN "${ESC}[92m")
set(YELLOW "${ESC}[93m")
set(BLUE "${ESC}[94m")

set(scores_print "${CYAN}[${RESET}${YELLOW}1${RESET}, ${YELLOW}2${RESET}, ${YELLOW}3${RESET}${CYAN}]${RESET}")
set(user_print "${CYAN}{${RESET}\n  ${MAGENTA}name${RESET}: ${GREEN}\"Ana\"${RESET},\n  ${MAGENTA}age${RESET}: ${YELLOW}30${RESET},\n  ${MAGENTA}active${RESET}: ${BLUE}true${RESET},\n  ${MAGENTA}scores${RESET}: ${scores_print}\n${CYAN}}${RESET}")
set(point_print "${CYAN}{${RESET}\n  ${MAGENTA}x${RESET}: ${YELLOW}4${RESET},\n  ${MAGENTA}y${RESET}: ${YELLOW}5${RESET}\n${CYAN}}${RESET}")
set(expected_stdout "${scores_print}\n${user_print}\n${point_print}\n")

if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "print collections executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
