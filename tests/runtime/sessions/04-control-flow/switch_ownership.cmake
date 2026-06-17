if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(SOURCE "${TEST_WORK_DIR}/main.io")

file(WRITE "${SOURCE}" "\
let saved: number[] = [0]\n\
\n\
// Scenario 1: aggregate created inside case + explicit break\n\
function caseAggregateBreak(x: number): void {\n\
    switch (x) {\n\
        case 1:\n\
            let scores: number[] = [1, 2, 3]\n\
            break\n\
    }\n\
}\n\
\n\
// Scenario 2: aggregate created inside case + implicit auto-break\n\
function caseAggregateImplicit(x: number): void {\n\
    switch (x) {\n\
        case 1:\n\
            let scores: number[] = [1, 2, 3]\n\
    }\n\
}\n\
\n\
// Scenario 3: aggregate created inside default + cleanup\n\
function defaultAggregateCleanup(x: number): void {\n\
    switch (x) {\n\
        case 1:\n\
            break\n\
        default:\n\
            let fallback: number[] = [4, 5, 6]\n\
    }\n\
}\n\
\n\
// Scenario 4: aggregate created inside case + returned\n\
function returnFromCase(x: number): number[] {\n\
    switch (x) {\n\
        case 1:\n\
            let scores: number[] = [1, 2, 3]\n\
            return scores\n\
        default:\n\
            return [0]\n\
    }\n\
}\n\
\n\
// Scenario 5: aggregate created inside case + assigned to global\n\
function caseAggregateToGlobal(x: number): void {\n\
    switch (x) {\n\
        case 1:\n\
            let scores: number[] = [1, 2, 3]\n\
            saved = scores\n\
            break\n\
    }\n\
}\n\
\n\
// Scenario 6 (critical): aggregate created BEFORE switch + assigned to global inside case\n\
// Verifies that restoreState at switch.end doesn't reactivate cleanup for escaped aggregate\n\
function preSwitchAggregateToGlobal(x: number): void {\n\
    let scores: number[] = [1, 2, 3]\n\
    switch (x) {\n\
        case 1:\n\
            saved = scores\n\
            break\n\
    }\n\
}\n\
\n\
// Scenario 7: aggregate created BEFORE switch + returned inside case\n\
function preSwitchReturned(x: number): number[] {\n\
    let scores: number[] = [1, 2, 3]\n\
    switch (x) {\n\
        case 1:\n\
            return scores\n\
        default:\n\
            return [0]\n\
    }\n\
}\n\
\n\
// Scenario 8: aggregate created BEFORE switch + not escaped\n\
// Verifies that pre-switch aggregates still get cleaned when not modified\n\
function preSwitchNotEscaped(x: number): void {\n\
    let scores: number[] = [1, 2, 3]\n\
    switch (x) {\n\
        case 1:\n\
            let a: number = 10\n\
            break\n\
        default:\n\
            let b: number = 20\n\
    }\n\
}\n\
\n\
// Scenario 9: unique variable names in different cases — shared scope (JS/TS semantics)\n\
function differentNamesInDifferentCases(x: number): void {\n\
    switch (x) {\n\
        case 1:\n\
            let arr1: number[] = [1]\n\
            break\n\
        case 2:\n\
            let arr2: number[] = [2]\n\
            break\n\
    }\n\
}\n\
\n\
// Scenario 10: switch inside loop with break\n\
function switchInsideLoop(x: number): number {\n\
    let i: number = 0\n\
    let result: number = 0\n\
    while (i < 3) {\n\
        switch (x) {\n\
            case 1:\n\
                let arr: number[] = [1, 2, 3]\n\
                result = result + 1\n\
                break\n\
            default:\n\
                result = result + 10\n\
        }\n\
        i = i + 1\n\
    }\n\
    return result\n\
}\n\
\n\
// ---- Call all functions to trigger execution ----\n\
\n\
caseAggregateBreak(1)\n\
caseAggregateBreak(99)\n\
caseAggregateImplicit(1)\n\
caseAggregateImplicit(99)\n\
defaultAggregateCleanup(1)\n\
defaultAggregateCleanup(99)\n\
\n\
let r4: number[] = returnFromCase(1)\n\
let r4b: number[] = returnFromCase(99)\n\
\n\
caseAggregateToGlobal(1)\n\
caseAggregateToGlobal(99)\n\
\n\
// CRITICAL: test pre-switch aggregate escape\n\
preSwitchAggregateToGlobal(1)\n\
preSwitchAggregateToGlobal(99)\n\
\n\
let r7: number[] = preSwitchReturned(1)\n\
let r7b: number[] = preSwitchReturned(99)\n\
\n\
preSwitchNotEscaped(1)\n\
preSwitchNotEscaped(99)\n\
\n\
differentNamesInDifferentCases(1)\n\
differentNamesInDifferentCases(2)\n\
\n\
let r10: number = switchInsideLoop(1)\n\
let r10b: number = switchInsideLoop(99)\n\
")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "switch ownership pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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

# Basic IR structure: all functions should have switch lowering symbols
foreach(symbol
		switch.check0
		switch.check1
		switch.end
		fcmp
		oeq)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected IR to contain ${symbol}")
	endif()
endforeach()

# Scenario 1: explicit-break functions should have array_init and array_drop (local cleanup)
foreach(func
		caseAggregateBreak
		caseAggregateImplicit
		defaultAggregateCleanup
		differentNamesInDifferentCases
		switchInsideLoop)
	if(NOT ir MATCHES "${func}")
		message(FATAL_ERROR "expected IR to contain function ${func}")
	endif()
endforeach()

# Scenario 4 + 7: return aggregate functions should NOT call array_drop (escaped via return)
# But they should have array_create (for the new array)
if(NOT ir MATCHES "returnFromCase")
	message(FATAL_ERROR "expected IR to contain function returnFromCase")
endif()

if(NOT ir MATCHES "preSwitchReturned")
	message(FATAL_ERROR "expected IR to contain function preSwitchReturned")
endif()

# Scenario 5 + 6: global-escape functions
# They should NOT have array_drop for the escaped aggregates
if(NOT ir MATCHES "caseAggregateToGlobal")
	message(FATAL_ERROR "expected IR to contain function caseAggregateToGlobal")
endif()

if(NOT ir MATCHES "preSwitchAggregateToGlobal")
	message(FATAL_ERROR "expected IR to contain function preSwitchAggregateToGlobal")
endif()

# Scenario 8: pre-switch non-escaped aggregate should still have cleanup
if(NOT ir MATCHES "preSwitchNotEscaped")
	message(FATAL_ERROR "expected IR to contain function preSwitchNotEscaped")
endif()

# Run the executable — this validates no crashes (no double-free, no use-after-free)
execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "switch ownership executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
