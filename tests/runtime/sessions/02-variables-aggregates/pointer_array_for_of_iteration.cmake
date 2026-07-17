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
struct User {
    id: number
    name: string
    score: number
    active: boolean
}

let users: User[] = [
    {
        id: 1,
        name: "Ana",
        score: 80,
        active: true
    },
    {
        id: 2,
        name: "Luis",
        score: 65,
        active: false
    },
    {
        id: 3,
        name: "Maria",
        score: 90,
        active: true
    }
]

function increaseActiveScores(users: ptr<User[]>, bonus: number): void {
    for (let user: ptr<User> of users) {
        if (user.active) {
            user.score = user.score + bonus
        }
    }
}

function removeFirstInactive(users: ptr<User[]>): void {
    let removeIndex: number = -1
    let index: number = 0

    for (let user: User of users) {
        if (!user.active && removeIndex == -1) {
            removeIndex = index
        }

        index = index + 1
    }

    if (removeIndex >= 0) {
        users.splice(removeIndex, 1)
    }
}

function countUsers(users: ptr<User[]>): number {
    return users.length
}

print(countUsers(&users))
increaseActiveScores(&users, 5)
removeFirstInactive(&users)
print(countUsers(&users))
print(users[0].id)
print(users[0].score)
print(users[1].id)
print(users[1].score)
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "pointer array for-of iteration compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS ptr.array.length yogi_array_length yogi_array_iteration_plan yogi_array_iteration_plan_pointer)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected pointer array for-of IR to contain ${symbol}:\n${ir}")
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
	message(FATAL_ERROR "pointer array for-of executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "3\n2\n1\n85\n3\n95\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "pointer array for-of executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
