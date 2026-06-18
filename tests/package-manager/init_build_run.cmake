if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(PROJECT_DIR "${TEST_WORK_DIR}/demo")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" init -y "${PROJECT_DIR}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE init_result
	OUTPUT_VARIABLE init_stdout
	ERROR_VARIABLE init_stderr
)

if(NOT init_result EQUAL 0)
	message(FATAL_ERROR "yogi init failed\nstdout:\n${init_stdout}\nstderr:\n${init_stderr}")
endif()

foreach(path
		"${PROJECT_DIR}/main.ts"
		"${PROJECT_DIR}/yogi.json"
		"${PROJECT_DIR}/yogi.lock"
		"${PROJECT_DIR}/packages/bin/yogi")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected yogi init to create ${path}")
	endif()
endforeach()

file(WRITE "${PROJECT_DIR}/main.ts" "function main(): number {\n    print(\"hello from yogi\")\n    print(42)\n    return 0\n}\n\nmain()\n")

file(READ "${PROJECT_DIR}/yogi.json" manifest)
if(NOT manifest MATCHES "\"entry\"[^\n]*\"main.ts\"")
	message(FATAL_ERROR "expected manifest build.entry to be main.ts\n${manifest}")
endif()

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" build
	WORKING_DIRECTORY "${PROJECT_DIR}"
	RESULT_VARIABLE build_result
	OUTPUT_VARIABLE build_stdout
	ERROR_VARIABLE build_stderr
)

if(NOT build_result EQUAL 0)
	message(FATAL_ERROR "yogi build failed\nstdout:\n${build_stdout}\nstderr:\n${build_stderr}")
endif()

if(NOT EXISTS "${PROJECT_DIR}/dist/demo")
	message(FATAL_ERROR "expected yogi build to create ${PROJECT_DIR}/dist/demo")
endif()

if(NOT EXISTS "${PROJECT_DIR}/packages/.cache/bin/main")
	message(FATAL_ERROR "expected yogi build to create ${PROJECT_DIR}/packages/.cache/bin/main")
endif()

if(NOT EXISTS "${PROJECT_DIR}/packages/.cache/modules/main.ts/main.ll")
	message(FATAL_ERROR "expected yogi build to lower main.ts to LLVM IR")
endif()

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" run
	WORKING_DIRECTORY "${PROJECT_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "yogi run failed\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(NOT run_stdout MATCHES "hello from yogi")
	message(FATAL_ERROR "expected yogi run to print string output\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(NOT run_stdout MATCHES "42")
	message(FATAL_ERROR "expected yogi run to print number output\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(DIRECT_DIR "${TEST_WORK_DIR}/direct")
file(MAKE_DIRECTORY "${DIRECT_DIR}")
file(WRITE "${DIRECT_DIR}/main.ts" "function main(): number {\n    print(\"direct source run\")\n    return 0\n}\n\nmain()\n")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" run main.ts
	WORKING_DIRECTORY "${DIRECT_DIR}"
	RESULT_VARIABLE direct_run_result
	OUTPUT_VARIABLE direct_run_stdout
	ERROR_VARIABLE direct_run_stderr
)

if(NOT direct_run_result EQUAL 0)
	message(FATAL_ERROR "yogi run main.ts failed\nstdout:\n${direct_run_stdout}\nstderr:\n${direct_run_stderr}")
endif()

foreach(path
		"${DIRECT_DIR}/packages/bin/yogi"
		"${DIRECT_DIR}/packages/.cache/bin/main")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected direct source run to create ${path}")
	endif()
endforeach()

if(NOT direct_run_stdout MATCHES "direct source run")
	message(FATAL_ERROR "expected direct source run to print output\nstdout:\n${direct_run_stdout}\nstderr:\n${direct_run_stderr}")
endif()
