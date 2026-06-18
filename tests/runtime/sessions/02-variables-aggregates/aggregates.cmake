if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(SOURCE "${TEST_WORK_DIR}/main.io")
file(WRITE "${SOURCE}" "function localAggregateScore(): number {\n    let localUser: { name: string, score: number } = { name: \"Ana\", score: 1 }\n    let localScores: number[] = [1, 2, 3]\n    localUser.score = localUser.score + localScores[1]\n    return localUser.score\n}\n\nlet user: { name: string, score: number, label?: string } = { name: \"Ana\", score: 1 }\nuser.name = \"Bray\"\nuser.score = user.score + 9\nlet label: string = user.label ?? \"fallback\"\nlet finalName: string = user.name\nlet finalScore: number = user.score\n\nlet scores: number[] = [1, 2, 3]\nscores[1] = 10\nlet middle: number = scores[1]\n\nlet pair: [number, string] = [7, \"ready\"]\npair[0] = 8\nlet first: number = pair[0]\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "aggregate pipeline compile failed:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.io/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.io/main.o")

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
		yogi_object_create
		yogi_object_set
		yogi_object_get
		yogi_array_create
		yogi_array_set
		yogi_array_get
		yogi_object_init
		yogi_object_drop
		yogi_array_init
		yogi_array_drop)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected aggregate IR to call ${symbol}")
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
	message(FATAL_ERROR "aggregate generated executable failed:\n${run_stderr}")
endif()
