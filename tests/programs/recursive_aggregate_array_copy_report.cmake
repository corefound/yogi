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
struct Point {
    x: number
    y: number
}

struct Team {
    id: number
    scores: number[]
}

struct Position {
    x: number
    y: number
}

struct Entity {
    id: number
    position: Position
}

struct ArrayReference {
    values: ptr<number[]>
}

function snapshot(values: ptr<Point[]>): Point[] {
    return values
}

function mutateValueParameter(values: Point[]): number {
    values[0].x = 70
    return values[0].x
}

function replacementStress(source: ptr<Team[]>): number {
    let stage: Team[] = [{ id: 0, scores: [0] }]
    let total: number = 0
    let round: number = 0

    while (round < 4) {
        let view: Team[] = source
        stage = view
        stage[0].scores[0] = stage[0].scores[0] + round
        total = total + stage[0].scores[0]

        if (round == 1) {
            round = round + 1
            continue
        }

        if (round == 3) {
            break
        }

        round = round + 1
    }

    return total
}

function run(): void {
    let points: Point[] = [{ x: 1, y: 2 }, { x: 3, y: 4 }]
    let copiedPoints: Point[] = points
    copiedPoints[0].x = 99
    print(points[0].x)
    print(copiedPoints[0].x)

    let matrix: number[][] = [[1, 2], [3, 4]]
    let copiedMatrix: number[][] = matrix
    copiedMatrix[0][0] = 88
    copiedMatrix[1].push(5)
    print(matrix[0][0])
    print(copiedMatrix[0][0])
    print(matrix[1].length)
    print(copiedMatrix[1].length)

    let teams: Team[] = [{ id: 1, scores: [10, 20, 30] }]
    let copiedTeams: Team[] = teams
    copiedTeams[0].id = 2
    copiedTeams[0].scores[1] = 77
    copiedTeams[0].scores.push(40)
    print(teams[0].id)
    print(copiedTeams[0].id)
    print(teams[0].scores[1])
    print(copiedTeams[0].scores[1])
    print(teams[0].scores.length)
    print(copiedTeams[0].scores.length)

    let namedScores: number[] = [8, 9]
    let namedTeams: Team[] = [{ id: 3, scores: namedScores }]
    namedTeams[0].scores[0] = 80
    print(namedScores[0])
    print(namedTeams[0].scores[0])

    let entities: Entity[] = [{ id: 1, position: { x: 10, y: 20 } }]
    let copiedEntities: Entity[] = entities
    copiedEntities[0].position.x = 66
    print(entities[0].position.x)
    print(copiedEntities[0].position.x)

    let pointPointer: ptr<Point[]> = &points
    let view: Point[] = pointPointer
    view[0].x = 11
    let copiedView: Point[] = view
    copiedView[0].x = 22
    print(points[0].x)
    print(copiedView[0].x)

    let returned: Point[] = snapshot(pointPointer)
    returned[0].x = 33
    print(points[0].x)
    print(returned[0].x)
    print(mutateValueParameter(points))
    print(points[0].x)

    points = points
    print(points[0].x)

    let aliasView: Point[] = pointPointer
    points = aliasView
    aliasView[0].x = 44
    print(points[0].x)

    let referenced: number[] = [5, 6]
    let references: ArrayReference[] = [{ values: &referenced }]
    let copiedReferences: ArrayReference[] = references
    let sharedView: number[] = copiedReferences[0].values
    sharedView[0] = 55
    print(referenced[0])

    print(replacementStress(&teams))
    print(teams[0].scores[0])
}

run()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "recursive aggregate array-copy program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected recursive aggregate array-copy artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS
		yogi_array_clone
		yogi_array_move_replace_from
		yogi_object_set_unboxed)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected recursive aggregate array-copy IR to contain ${symbol}")
	endif()
endforeach()

if(NOT ir MATCHES "yogi_object_set_unboxed\\([^\\n]*%referenced\\.ptr\\.load\\)")
	message(FATAL_ERROR "expected pointer-valued object fields to store their raw borrowed pointer")
endif()

if(ir MATCHES "yogi_object_set_unboxed\\([^\\n]*%yogi_any_from_pointer")
	message(FATAL_ERROR "unboxed object fields must not receive an AnyValue pointer box")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "recursive aggregate array-copy executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(run_stderr MATCHES "AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|runtime error:|ownership error")
	message(FATAL_ERROR "recursive aggregate array-copy memory tooling reported a failure:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1\n99\n1\n88\n2\n3\n1\n2\n20\n77\n3\n4\n8\n80\n10\n66\n11\n22\n11\n33\n70\n11\n11\n44\n55\n46\n10\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "recursive aggregate array-copy program printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
