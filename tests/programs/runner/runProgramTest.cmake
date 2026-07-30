if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED YOGI_PROGRAM_TRACE_ANALYZER OR YOGI_PROGRAM_TRACE_ANALYZER STREQUAL "")
	message(FATAL_ERROR "YOGI_PROGRAM_TRACE_ANALYZER is required")
endif()

if(NOT DEFINED PROGRAM_TEST_NAME OR PROGRAM_TEST_NAME STREQUAL "")
	message(FATAL_ERROR "PROGRAM_TEST_NAME is required")
endif()

if(NOT DEFINED PROGRAM_TEST_SCRIPT OR PROGRAM_TEST_SCRIPT STREQUAL "")
	message(FATAL_ERROR "PROGRAM_TEST_SCRIPT is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

if(NOT DEFINED PROGRAM_TEST_PROFILE OR PROGRAM_TEST_PROFILE STREQUAL "")
	set(PROGRAM_TEST_PROFILE "runtime-strict")
endif()

if(NOT DEFINED YOGI_PROGRAM_OBSERVABILITY_ENABLED)
	set(YOGI_PROGRAM_OBSERVABILITY_ENABLED "0")
endif()

function(escape_json INPUT OUTPUT)
	string(REPLACE "\\" "\\\\" escaped "${INPUT}")
	string(REPLACE "\"" "\\\"" escaped "${escaped}")
	string(REPLACE "\n" "\\n" escaped "${escaped}")
	string(REPLACE "\r" "\\r" escaped "${escaped}")
	set(${OUTPUT} "${escaped}" PARENT_SCOPE)
endfunction()

set(TRACE_DIR "${TEST_WORK_DIR}.observability")
set(MANIFEST "${TRACE_DIR}/manifest.json")
set(HARNESS_EVENTS "${TRACE_DIR}/harness.events.jsonl")

file(REMOVE_RECURSE "${TRACE_DIR}")
file(MAKE_DIRECTORY "${TRACE_DIR}")

if(DEFINED PROGRAM_TEST_MANIFEST AND EXISTS "${PROGRAM_TEST_MANIFEST}")
	configure_file("${PROGRAM_TEST_MANIFEST}" "${MANIFEST}" COPYONLY)
else()
	file(WRITE "${MANIFEST}" [=[
{
  "schemaVersion": 1,
  "name": "@PROGRAM_TEST_NAME@",
  "profile": "@PROGRAM_TEST_PROFILE@",
  "legacyScript": "@PROGRAM_TEST_SCRIPT@",
  "trace": {
    "categories": ["session", "semantic", "function", "memory", "aggregate", "resource", "anomaly"]
  },
  "invariants": [
    "event.envelope",
    "event.sequence",
    "memory.lifetime",
    "aggregate.lifetime",
    "resource.lifetime",
    "function.frame_balance",
    "sanitizer.clean"
  ],
  "allowLive": [
    {
      "category": "memory",
      "typeName": "any value",
      "reason": "transitional: AnyValue cleanup is not implemented yet"
    },
    {
      "category": "memory",
      "typeName": "runtime string",
      "reason": "transitional: process-owned runtime strings are not fully classified yet"
    },
    {
      "category": "memory",
      "typeName": "object value",
      "reason": "transitional: boxed struct/object storage cleanup is not complete"
    },
    {
      "category": "memory",
      "typeName": "object properties",
      "reason": "transitional: boxed struct/object storage cleanup is not complete"
    },
    {
      "category": "memory",
      "typeName": "object property key",
      "reason": "transitional: boxed struct/object storage cleanup is not complete"
    },
    {
      "category": "memory",
      "typeName": "array value",
      "reason": "transitional: temporary heap array descriptor cleanup is not complete"
    },
    {
      "category": "memory",
      "typeName": "array view",
      "reason": "transitional: retained/materialized view cleanup is not complete"
    },
    {
      "category": "memory",
      "typeName": "array elements",
      "reason": "transitional: selected temporary array storage cleanup is not complete"
    },
    {
      "category": "memory",
      "typeName": "array contiguous elements",
      "reason": "transitional: selected temporary array storage cleanup is not complete"
    },
    {
      "category": "memory",
      "typeName": "projected pointer cell",
      "reason": "transitional: projected pointer cell lifetime cleanup is not complete"
    },
    {
      "category": "aggregate",
      "typeName": "object value",
      "reason": "transitional: boxed struct/object aggregate cleanup is not complete"
    },
    {
      "category": "aggregate",
      "typeName": "array value",
      "reason": "transitional: temporary heap array descriptor cleanup is not complete"
    }
  ],
  "expectations": []
}
]=])
endif()

# configure_file only performs @VAR@ substitution when a template file exists,
# so generated legacy manifests are written explicitly with escaped paths.
if(NOT DEFINED PROGRAM_TEST_MANIFEST OR NOT EXISTS "${PROGRAM_TEST_MANIFEST}")
	string(REPLACE "\\" "\\\\" escaped_script "${PROGRAM_TEST_SCRIPT}")
	string(REPLACE "\"" "\\\"" escaped_script "${escaped_script}")
	file(READ "${MANIFEST}" manifest_contents)
	string(REPLACE "@PROGRAM_TEST_NAME@" "${PROGRAM_TEST_NAME}" manifest_contents "${manifest_contents}")
	string(REPLACE "@PROGRAM_TEST_PROFILE@" "${PROGRAM_TEST_PROFILE}" manifest_contents "${manifest_contents}")
	string(REPLACE "@PROGRAM_TEST_SCRIPT@" "${escaped_script}" manifest_contents "${manifest_contents}")
	file(WRITE "${MANIFEST}" "${manifest_contents}")
endif()

escape_json("${PROGRAM_TEST_NAME}" escaped_test_name)
escape_json("${PROGRAM_TEST_SCRIPT}" escaped_test_script)

file(WRITE "${HARNESS_EVENTS}"
	"{\"schemaVersion\":1,\"sessionId\":\"${escaped_test_name}\","
	"\"eventId\":\"event:harness:1\",\"sequence\":1,\"phase\":\"harness\","
	"\"category\":\"session\",\"eventKind\":\"program_test.begin\","
	"\"producer\":\"program-test-runner\",\"entityId\":\"test:${escaped_test_name}\","
	"\"source\":{\"path\":\"${escaped_test_script}\",\"line\":0,\"column\":0}}\n"
)

set(ENV{YOGI_TRACE_SESSION} "${PROGRAM_TEST_NAME}")
set(ENV{YOGI_TRACE_DIRECTORY} "${TRACE_DIR}")
set(ENV{YOGI_TRACE_CATEGORIES} "session,semantic,cleanup,function,memory,aggregate,resource,anomaly")
set(ENV{YOGI_TRACE_STRICT} "${YOGI_PROGRAM_OBSERVABILITY_ENABLED}")
set(ENV{YOGI_TRACE_PROCESS_ROLE} "program-test-child")

execute_process(
	COMMAND "${CMAKE_COMMAND}"
		"-DYOGI_EXECUTABLE=${YOGI_EXECUTABLE}"
		"-DTEST_WORK_DIR=${TEST_WORK_DIR}"
		"-DYOGI_PROGRAM_SANITIZER_C_FLAGS=${YOGI_PROGRAM_SANITIZER_C_FLAGS}"
		-P "${PROGRAM_TEST_SCRIPT}"
	RESULT_VARIABLE program_test_result
	OUTPUT_VARIABLE program_test_stdout
	ERROR_VARIABLE program_test_stderr
)

file(APPEND "${HARNESS_EVENTS}"
	"{\"schemaVersion\":1,\"sessionId\":\"${escaped_test_name}\","
	"\"eventId\":\"event:harness:2\",\"sequence\":2,\"phase\":\"harness\","
	"\"category\":\"session\",\"eventKind\":\"program_test.script_complete\","
	"\"producer\":\"program-test-runner\",\"entityId\":\"test:${escaped_test_name}\","
	"\"source\":{\"path\":\"${escaped_test_script}\",\"line\":0,\"column\":0},"
	"\"details\":{\"exitCode\":${program_test_result}}}\n"
)

set(sanitizer_pattern "AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|runtime error:|ownership error")
if(program_test_stdout MATCHES "${sanitizer_pattern}" OR program_test_stderr MATCHES "${sanitizer_pattern}")
	file(APPEND "${HARNESS_EVENTS}"
		"{\"schemaVersion\":1,\"sessionId\":\"${escaped_test_name}\","
		"\"eventId\":\"event:harness:3\",\"sequence\":3,\"phase\":\"sanitizer\","
		"\"category\":\"anomaly\",\"eventKind\":\"anomaly.sanitizer\","
		"\"producer\":\"program-test-runner\",\"entityId\":\"test:${escaped_test_name}\","
		"\"source\":{\"path\":\"${escaped_test_script}\",\"line\":0,\"column\":0},"
		"\"details\":{\"reason\":\"sanitizer or runtime ownership diagnostic detected\"}}\n"
	)
endif()

execute_process(
	COMMAND "${YOGI_PROGRAM_TRACE_ANALYZER}"
		--trace-dir "${TRACE_DIR}"
		--manifest "${MANIFEST}"
		--test "${PROGRAM_TEST_NAME}"
		--observability-enabled "${YOGI_PROGRAM_OBSERVABILITY_ENABLED}"
		--artifact-root "${TEST_WORK_DIR}"
	RESULT_VARIABLE analyzer_result
	OUTPUT_VARIABLE analyzer_stdout
	ERROR_VARIABLE analyzer_stderr
)

if(NOT program_test_result EQUAL 0)
	message(FATAL_ERROR
		"Program Test '${PROGRAM_TEST_NAME}' failed.\n"
		"stdout:\n${program_test_stdout}\n"
		"stderr:\n${program_test_stderr}\n"
		"observability:\n${analyzer_stderr}"
	)
endif()

if(NOT analyzer_result EQUAL 0)
	message(FATAL_ERROR
		"Program Test '${PROGRAM_TEST_NAME}' violated an observability invariant.\n"
		"${analyzer_stderr}\n"
		"trace directory: ${TRACE_DIR}"
	)
endif()
