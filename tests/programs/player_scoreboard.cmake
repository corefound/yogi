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
struct Player {
    name: string
    score: number
    active: boolean
}

function firstScore(players: ptr<Player[]>): ptr<number> {
    return &players[0].score
}

function secondScore(players: ptr<Player[]>): ptr<number> {
    return &players[1].score
}

function boost(score: ptr<number>, amount: number): void {
    let current: number = score
    score = current + amount
}

function activeTotal(players: ptr<Player[]>): number {
    let total: number = 0

    for (let player: Player of players) {
        if (player.active) {
            total = total + player.score
        }
    }

    return total
}

let players: Player[] = [
    { name: "Ana", score: 10, active: true },
    { name: "Luis", score: 20, active: true }
]

let captain: ptr<number> = firstScore(&players)
let support: ptr<number> = secondScore(&players)

boost(captain, 5)
boost(support, 7)
players.push({ name: "Mia", score: 30, active: false })

print(captain)
print(support)
print(activeTotal(&players))

players[2].active = true
boost(&players[2].score, 3)

print(players[2].score)
print(activeTotal(&players))
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "player scoreboard program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected player scoreboard program artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_pointer_cell
		yogi_pointer_cell_get
		yogi_pointer_cell_set
		yogi_array_length
		_yogi_fn_main.ts_firstScore
		_yogi_fn_main.ts_activeTotal)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected player scoreboard IR to contain ${symbol}")
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
	message(FATAL_ERROR "player scoreboard executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "15\n27\n42\n33\n75\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "player scoreboard program printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
