if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

find_program(YOGI_NATIVE_CC NAMES cc clang gcc)
find_program(YOGI_NATIVE_AR NAMES ar llvm-ar)

if(NOT YOGI_NATIVE_CC OR NOT YOGI_NATIVE_AR)
	message(FATAL_ERROR "native resource function-boundary test requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/native_jobs.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/native_jobs.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libnative_jobs.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdlib.h>

typedef struct NativeJob {
    double id;
} NativeJob;

static void *resources[512];
static int alive[512];
static int resource_count = 0;
static int destroyed_count = 0;
static int duplicate_destroy_count = 0;
static int invalid_destroy_count = 0;

NativeJob *createJob(double id) {
    NativeJob *job = (NativeJob *)malloc(sizeof(NativeJob));
    if (!job || resource_count >= 512) {
        abort();
    }

    job->id = id;
    resources[resource_count] = job;
    alive[resource_count] = 1;
    resource_count += 1;
    return job;
}

void destructor(void *pointer) {
    int index = -1;
	int stale_index = -1;

    for (int current = resource_count - 1; current >= 0; --current) {
        if (resources[current] == pointer) {
			if (alive[current]) {
				index = current;
				break;
			}

			if (stale_index < 0) {
				stale_index = current;
			}
        }
    }

	if (index < 0) {
		index = stale_index;
	}

    if (index < 0) {
        invalid_destroy_count += 1;
        return;
    }

    if (!alive[index]) {
        duplicate_destroy_count += 1;
        return;
    }

    alive[index] = 0;
    destroyed_count += 1;
    free(pointer);
}

double createdCount(void) {
    return (double)resource_count;
}

double destroyedCount(void) {
    return (double)destroyed_count;
}

double liveCount(void) {
    return (double)(resource_count - destroyed_count);
}

double duplicateDestroyCount(void) {
    return (double)duplicate_destroy_count;
}

double invalidDestroyCount(void) {
    return (double)invalid_destroy_count;
}
]=])

set(native_compile_command "${YOGI_NATIVE_CC}" -c "${NATIVE_SOURCE}" -o "${NATIVE_OBJECT}")
if(DEFINED YOGI_PROGRAM_SANITIZER_C_FLAGS AND NOT YOGI_PROGRAM_SANITIZER_C_FLAGS STREQUAL "")
	separate_arguments(native_sanitizer_flags NATIVE_COMMAND "${YOGI_PROGRAM_SANITIZER_C_FLAGS}")
	list(APPEND native_compile_command ${native_sanitizer_flags})
endif()

execute_process(
	COMMAND ${native_compile_command}
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_compile_result
	OUTPUT_VARIABLE native_compile_stdout
	ERROR_VARIABLE native_compile_stderr
)

if(NOT native_compile_result EQUAL 0)
	message(FATAL_ERROR "native fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
endif()

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
struct NativeJob {
    id: number
}

struct JobTicket {
    handle: ptr<NativeJob>
    score: number
}

extern jobs from "./libnative_jobs.a" {
    createJob(id: number): ptr<NativeJob>
    createdCount(): number
    destroyedCount(): number
    liveCount(): number
    duplicateDestroyCount(): number
    invalidDestroyCount(): number
    destructor(resource: ptr<void>): void
}

function createTicket(id: number): JobTicket {
    const handle: ptr<NativeJob> = jobs.createJob(id)
    return { handle: handle, score: id * 10 }
}

function makeBatch(start: number, count: number): JobTicket[] {
    let tickets: JobTicket[] = []
    let index: number = 0

    while (index < count) {
        tickets.push(createTicket(start + index))
        index = index + 1
    }

    return tickets
}

function forwardBatch(start: number, count: number): JobTicket[] {
    return makeBatch(start, count)
}

function totalScore(tickets: ptr<JobTicket[]>): number {
    let total: number = 0

    for (let ticket: JobTicket of tickets) {
        total = total + ticket.score
    }

    return total
}

function boostScores(tickets: ptr<JobTicket[]>, bonus: number): void {
    for (let ticket: ptr<JobTicket> of tickets) {
        ticket.score = ticket.score + bonus
    }
}

function conditionalBatch(enabled: boolean): JobTicket[] {
    if (enabled) {
        return makeBatch(30, 2)
    }

    return []
}

function earlyReturnCleanup(enabled: boolean): number {
    let temporary: JobTicket[] = makeBatch(100, 3)

    if (enabled) {
        return totalScore(&temporary)
    }

    return 0
}

function stressControlFlow(): void {
    let index: number = 0

    while (index < 6) {
        let temporary: JobTicket[] = makeBatch(200 + index * 10, 2)

        if (index == 1) {
            index = index + 1
            continue
        }

        if (index == 4) {
            break
        }

        index = index + 1
    }
}

function scenario(): void {
    let primary: JobTicket[] = forwardBatch(1, 3)
    print(jobs.createdCount())
    print(jobs.destroyedCount())
    print(jobs.liveCount())
    print(totalScore(&primary))

    boostScores(&primary, 5)
    print(totalScore(&primary))

    makeBatch(10, 2)
    print(jobs.destroyedCount())
    print(jobs.liveCount())

    print(earlyReturnCleanup(true))
    print(jobs.destroyedCount())
    print(jobs.liveCount())

    let empty: JobTicket[] = conditionalBatch(false)
    let conditional: JobTicket[] = conditionalBatch(true)
    print(empty.length)
    print(conditional.length)

    stressControlFlow()
    print(jobs.createdCount())
    print(jobs.destroyedCount())
    print(jobs.liveCount())
}

scenario()
print(jobs.createdCount())
print(jobs.destroyedCount())
print(jobs.liveCount())
print(jobs.duplicateDestroyCount())
print(jobs.invalidDestroyCount())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "function-boundary program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected function-boundary artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS createJob destructor yogi_array_push yogi_array_destroy)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected function-boundary IR to contain ${symbol}")
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
	message(FATAL_ERROR "function-boundary executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(run_stderr MATCHES "AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|runtime error:|ownership error")
	message(FATAL_ERROR "memory tooling reported a failure:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "3\n0\n3\n60\n75\n2\n3\n3030\n5\n3\n0\n2\n20\n15\n5\n20\n20\n0\n0\n0\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "function-boundary program printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
