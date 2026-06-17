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
// Scenario 1: break inside while\n\
function breakWithinWhile(): number {\n\
    let i: number = 0\n\
    while (i < 10) {\n\
        break\n\
        i = i + 1\n\
    }\n\
    return i\n\
}\n\
\n\
// Scenario 2: break inside for\n\
function breakWithinFor(): number {\n\
    let i: number = 0\n\
    for (let x: number = 0; x < 10; x = x + 1) {\n\
        i = i + 1\n\
        break\n\
    }\n\
    return i\n\
}\n\
\n\
// Scenario 3: break inside switch\n\
function breakWithinSwitch(x: number): number {\n\
    let result: number = 0\n\
    switch (x) {\n\
        case 1:\n\
            result = 10\n\
            break\n\
        default:\n\
            result = 20\n\
            break\n\
    }\n\
    return result\n\
}\n\
\n\
// Scenario 4: switch inside while — break exits switch, not while\n\
function switchWithinWhile(x: number): number {\n\
    let i: number = 0\n\
    while (i < 3) {\n\
        switch (x) {\n\
            case 1:\n\
                break\n\
            default:\n\
                break\n\
        }\n\
        i = i + 1\n\
    }\n\
    return i\n\
}\n\
\n\
// Scenario 5: while inside switch — break exits while, not switch\n\
function whileWithinSwitch(x: number): number {\n\
    let i: number = 0\n\
    switch (x) {\n\
        case 1:\n\
            while (i < 3) {\n\
                i = i + 1\n\
                break\n\
            }\n\
            i = i + 10\n\
            break\n\
        default:\n\
            i = 100\n\
            break\n\
    }\n\
    return i\n\
}\n\
\n\
// Scenario 6: nested switch inside loop inside switch\n\
function nestedSwitchInLoopInSwitch(x: number): number {\n\
    let i: number = 0\n\
    switch (x) {\n\
        case 1:\n\
            while (i < 3) {\n\
                switch (i) {\n\
                    case 1:\n\
                        break\n\
                    default:\n\
                        break\n\
                }\n\
                i = i + 1\n\
            }\n\
            i = i + 10\n\
            break\n\
        default:\n\
            i = 100\n\
            break\n\
    }\n\
    return i\n\
}\n\
\n\
// Scenario 7: break outside switch/loop — must produce error\n\
// (tested separately below)\n\
\n\
// Scenario 8: break exits loop and cleans loop-local aggregate\n\
function breakCleansLoopAggregate(): void {\n\
    while (true) {\n\
        let arr: number[] = [1, 2, 3]\n\
        break\n\
    }\n\
}\n\
\n\
// Scenario 9: break exits switch and cleans case-local aggregate\n\
function breakCleansSwitchAggregate(x: number): void {\n\
    switch (x) {\n\
        case 1:\n\
            let arr: number[] = [1, 2, 3]\n\
            break\n\
    }\n\
}\n\
\n\
// Scenario 10: break exits inner loop, not outer switch, cleans only loop-local aggregate\n\
function breakCleansOnlyInnerScope(x: number): void {\n\
    switch (x) {\n\
        case 1:\n\
            let caseArr: number[] = [1]\n\
            while (true) {\n\
                let loopArr: number[] = [2]\n\
                break\n\
            }\n\
            break\n\
    }\n\
}\n\
\n\
// ---- Call all functions to trigger execution ----\n\
\n\
let s1: number = breakWithinWhile()\n\
let s2: number = breakWithinFor()\n\
let s3a: number = breakWithinSwitch(1)\n\
let s3b: number = breakWithinSwitch(99)\n\
let s4a: number = switchWithinWhile(1)\n\
let s4b: number = switchWithinWhile(99)\n\
let s5a: number = whileWithinSwitch(1)\n\
let s5b: number = whileWithinSwitch(99)\n\
let s6a: number = nestedSwitchInLoopInSwitch(1)\n\
let s6b: number = nestedSwitchInLoopInSwitch(99)\n\
\n\
breakCleansLoopAggregate()\n\
breakCleansSwitchAggregate(1)\n\
breakCleansOnlyInnerScope(1)\n\
\n\
// ---- Verify break outside loop/switch produces error ----\n\
// (compile-time test using a separate invalid file)\n\
")

# Main test: compile and run
execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "break pipeline compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
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

# IR structure verification — labels are per-function, not unique module-wide
foreach(symbol
		switch.case0.body
		switch.default.body
		switch.end
		while.cond
		while.body
		while.end
		for.cond
		for.body
		for.end)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected IR to contain ${symbol}")
	endif()
endforeach()



# Run the executable
execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "break executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

# ---- Negative test: break outside switch/loop should produce compile error ----
set(INVALID_SOURCE "${TEST_WORK_DIR}/invalid.io")
file(WRITE "${INVALID_SOURCE}" "\
function test(): void {\n\
    break\n\
}\n\
")

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${INVALID_SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE invalid_compile_result
	OUTPUT_VARIABLE invalid_compile_stdout
	ERROR_VARIABLE invalid_compile_stderr
)

if(invalid_compile_result EQUAL 0)
	message(FATAL_ERROR "expected break-outside-switch/loop to fail but it succeeded")
endif()

string(TOLOWER "${invalid_compile_stdout}${invalid_compile_stderr}" invalid_output_lower)
if(NOT invalid_output_lower MATCHES "break")
	message(FATAL_ERROR "expected compile error to mention 'break' but got:\n${invalid_compile_stdout}${invalid_compile_stderr}")
endif()
