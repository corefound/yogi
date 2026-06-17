if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(SOURCE "${TEST_WORK_DIR}/main.io")

file(WRITE "${SOURCE}" "function classify(x: number): number {\n    let result: number = 0\n\n    switch (x) {\n        case 1:\n            result = 10\n            break\n\n        case 2:\n            result = 20\n            break\n\n        default:\n            result = 99\n            break\n    }\n\n    return result\n}\n\nfunction noDefault(x: number): number {\n    let result: number = 0\n\n    switch (x) {\n        case 1:\n            result = 100\n            break\n\n        case 2:\n            result = 200\n            break\n    }\n\n    return result\n}\n\nfunction switchNoFallthrough(x: number): number {\n    let result: number = 0\n\n    switch (x) {\n        case 1:\n            result = 10\n            break\n\n        case 2:\n            result = 20\n            break\n    }\n\n    return result\n}\n\nlet a: number = classify(1)\nlet b: number = classify(2)\nlet c: number = classify(99)\nlet d: number = noDefault(1)\nlet e: number = noDefault(99)\nlet f: number = switchNoFallthrough(2)\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "switch pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/yogi")
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
		switch.check0
		switch.check1
		switch.case0.body
		switch.case1.body
		switch.default.body
		switch.end
		fcmp
		oeq)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected switch IR to contain ${symbol}")
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
	message(FATAL_ERROR "switch executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
