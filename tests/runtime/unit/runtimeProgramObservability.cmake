if(NOT DEFINED YOGI_RUNTIME_OBSERVABILITY_TEST OR YOGI_RUNTIME_OBSERVABILITY_TEST STREQUAL "")
	message(FATAL_ERROR "YOGI_RUNTIME_OBSERVABILITY_TEST is required")
endif()

if(NOT DEFINED YOGI_PROGRAM_TRACE_ANALYZER OR YOGI_PROGRAM_TRACE_ANALYZER STREQUAL "")
	message(FATAL_ERROR "YOGI_PROGRAM_TRACE_ANALYZER is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(MANIFEST "${TEST_WORK_DIR}/manifest.json")
file(WRITE "${MANIFEST}" [=[
{
  "schemaVersion": 1,
  "name": "runtime-program-observability",
  "profile": "runtime-strict",
  "allowLive": [],
  "expectations": [
    {"kind": "count", "eventKind": "memory.allocate", "equals": 1},
    {"kind": "count", "eventKind": "memory.reallocate", "equals": 1},
    {"kind": "count", "eventKind": "memory.free", "equals": 1},
    {"kind": "count", "eventKind": "resource.create", "equals": 1},
    {"kind": "count", "eventKind": "resource.destroy", "equals": 1},
    {"kind": "count", "eventKind": "function.frame.enter", "equals": 1},
    {"kind": "count", "eventKind": "function.frame.exit", "equals": 1},
    {"kind": "count", "eventKind": "cleanup.activate", "equals": 1},
    {"kind": "count", "eventKind": "cleanup.execute", "equals": 1},
    {
      "kind": "cleanup",
      "owner": "value",
      "cleanupKind": "string",
      "destroyFunction": "yogi_string_destroy",
      "scheduledAtLeast": 1,
      "emittedAtLeast": 1,
      "runtimeAtLeast": 1
    }
  ]
}
]=])

execute_process(
	COMMAND "${CMAKE_COMMAND}" -E env
		"YOGI_TRACE_SESSION=runtime-program-observability"
		"YOGI_TRACE_DIRECTORY=${TEST_WORK_DIR}"
		"YOGI_TRACE_CATEGORIES=session,cleanup,function,memory,aggregate,resource,anomaly"
		"YOGI_TRACE_STRICT=1"
		"YOGI_TRACE_PROCESS_ROLE=runtime-unit-test"
		"${YOGI_RUNTIME_OBSERVABILITY_TEST}"
	RESULT_VARIABLE runtime_result
	OUTPUT_VARIABLE runtime_stdout
	ERROR_VARIABLE runtime_stderr
)

if(NOT runtime_result EQUAL 0)
	message(FATAL_ERROR
		"runtime observability fixture failed:\n"
		"stdout:\n${runtime_stdout}\n"
		"stderr:\n${runtime_stderr}"
	)
endif()

execute_process(
	COMMAND "${YOGI_PROGRAM_TRACE_ANALYZER}"
		--trace-dir "${TEST_WORK_DIR}"
		--manifest "${MANIFEST}"
		--test runtime-program-observability
		--observability-enabled 1
	RESULT_VARIABLE analyzer_result
	ERROR_VARIABLE analyzer_stderr
)

if(NOT analyzer_result EQUAL 0)
	message(FATAL_ERROR "runtime observability trace failed validation:\n${analyzer_stderr}")
endif()
