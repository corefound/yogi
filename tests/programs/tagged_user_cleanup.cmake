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
    tag: string
    score: number
    active: boolean
}

function boostTag(users: ptr<User[]>, tag: string, bonus: number): void {
    for (let user: ptr<User> of users) {
        if (user.active && user.tag == tag) {
            user.score = user.score + bonus
        }
    }
}

function firstInactiveIndex(users: ptr<User[]>): number {
    let index: number = 0

    for (let user: User of users) {
        if (!user.active) {
            return index
        }

        index = index + 1
    }

    return -1
}

function removeFirstInactive(users: ptr<User[]>): boolean {
    let index: number = firstInactiveIndex(users)

    if (index >= 0) {
        users.splice(index, 1)
        return true
    }

    return false
}

function archiveInactive(users: ptr<User[]>): number {
    let removed: number = 0
    let changed: boolean = removeFirstInactive(users)

    while (changed) {
        removed = removed + 1
        changed = removeFirstInactive(users)
    }

    return removed
}

function countTag(users: ptr<User[]>, tag: string): number {
    let count: number = 0

    for (let user: User of users) {
        if (user.tag == tag) {
            count = count + 1
        }
    }

    return count
}

function scoreFor(users: ptr<User[]>, id: number): number {
    for (let user: User of users) {
        if (user.id == id) {
            return user.score
        }
    }

    return -1
}

function sizeOf(users: ptr<User[]>): number {
    return users.length
}

let users: User[] = [
    { id: 1, name: "Ana", tag: "core", score: 80, active: true },
    { id: 2, name: "Luis", tag: "support", score: 65, active: false },
    { id: 3, name: "Maria", tag: "core", score: 90, active: true },
    { id: 4, name: "Zoe", tag: "trial", score: 40, active: false }
]

print(sizeOf(&users))
boostTag(&users, "core", 5)
let removed: number = archiveInactive(&users)
print(removed)
print(sizeOf(&users))
print(countTag(&users, "core"))
print(scoreFor(&users, 1))
print(scoreFor(&users, 3))

users.push({ id: 5, name: "Nia", tag: "support", score: 70, active: true })
boostTag(&users, "support", 10)
print(countTag(&users, "support"))
print(scoreFor(&users, 5))
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "tagged user cleanup program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected tagged user cleanup program artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_iteration_plan_pointer
		yogi_array_length
		yogi_array_splice
		yogi_string_equals
		ptr.array.length
		_yogi_fn_main.ts_boostTag
		_yogi_fn_main.ts_archiveInactive)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected tagged user cleanup IR to contain ${symbol}")
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
	message(FATAL_ERROR "tagged user cleanup executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "4\n2\n2\n2\n85\n95\n1\n80\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "tagged user cleanup program printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
