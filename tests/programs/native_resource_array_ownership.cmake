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
	message(FATAL_ERROR "native resource array ownership program requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/native_jobs.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/native_jobs.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libnative_jobs.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdlib.h>

typedef struct NativeJob {
	double id;
	double weight;
} NativeJob;

static int destroyed_jobs = 0;
static int order_count = 0;
static int order[64];

NativeJob *createJob(double id, double weight) {
	NativeJob *job = (NativeJob *)malloc(sizeof(NativeJob));
	if (!job) {
		return NULL;
	}

	job->id = id;
	job->weight = weight;
	return job;
}

double scoreJob(double id, double weight) {
	return id * 10.0 + weight;
}

void destructor(void *pointer) {
	NativeJob *job = (NativeJob *)pointer;
	if (!job) {
		return;
	}

	order[order_count++] = (int)job->id;
	destroyed_jobs += 1;
	free(job);
}

double destroyedJobCount(void) {
	return (double)destroyed_jobs;
}

double orderAt(double index) {
	const int offset = (int)index;
	if (offset < 0 || offset >= order_count) {
		return -1.0;
	}

	return (double)order[offset];
}
]=])

execute_process(
	COMMAND "${YOGI_NATIVE_CC}" -c "${NATIVE_SOURCE}" -o "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_compile_result
	OUTPUT_VARIABLE native_compile_stdout
	ERROR_VARIABLE native_compile_stderr
)

if(NOT native_compile_result EQUAL 0)
	message(FATAL_ERROR "native resource array fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native resource array fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
endif()

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
struct NativeJob {
    id: number
    weight: number
}

struct JobTicket {
    handle: ptr<NativeJob>
    score: number
}

extern jobs from "./libnative_jobs.a" {
    createJob(id: number, weight: number): ptr<NativeJob>
    scoreJob(id: number, weight: number): number
    destroyedJobCount(): number
    orderAt(index: number): number
    destructor(resource: ptr<void>): void
}

function createTicket(id: number, weight: number): JobTicket {
    const handle: ptr<NativeJob> = jobs.createJob(id, weight)
    let ticket: JobTicket = {
        handle: handle,
        score: jobs.scoreJob(id, weight)
    }

    return ticket
}

function pushReturnedTickets(): void {
    let tickets: JobTicket[] = []

    tickets.push(createTicket(1, 5))
    tickets.push(createTicket(2, 7))

    print(jobs.destroyedJobCount())
}

function pushMovedLocalTicket(): void {
    let tickets: JobTicket[] = []
    let ticket: JobTicket = createTicket(3, 9)

    tickets.push(ticket)

    print(jobs.destroyedJobCount())
}

function popExtractedTicket(): void {
    let tickets: JobTicket[] = []

    tickets.push(createTicket(4, 1))
    tickets.push(createTicket(5, 2))

    let ticket: JobTicket = tickets.pop()

    print(ticket.score)
    print(jobs.destroyedJobCount())
}

function shiftExtractedTicket(): void {
    let tickets: JobTicket[] = []

    tickets.push(createTicket(6, 3))
    tickets.push(createTicket(7, 4))

    let ticket: JobTicket = tickets.shift()

    print(ticket.score)
    print(jobs.destroyedJobCount())
}

function spliceExtractedTickets(): void {
    let tickets: JobTicket[] = []

    tickets.push(createTicket(8, 1))
    tickets.push(createTicket(9, 2))
    tickets.push(createTicket(10, 3))
    tickets.push(createTicket(11, 4))

    const removed: JobTicket[] = tickets.splice(1, 2)

    print(removed[0].score)
    print(removed[1].score)
    print(tickets.length)
    print(jobs.destroyedJobCount())
}

function spliceDiscardedTickets(): void {
    let tickets: JobTicket[] = []

    tickets.push(createTicket(12, 1))
    tickets.push(createTicket(13, 2))
    tickets.push(createTicket(14, 3))

    tickets.splice(0, 2)

    print(jobs.destroyedJobCount())
}

function spliceZeroDeleteTickets(): void {
    let tickets: JobTicket[] = []

    tickets.push(createTicket(15, 1))
    tickets.push(createTicket(16, 2))

    const removed: JobTicket[] = tickets.splice(1, 0)

    print(removed.length)
    print(jobs.destroyedJobCount())
}

function splicePastEndTickets(): void {
    let tickets: JobTicket[] = []

    tickets.push(createTicket(17, 1))
    tickets.push(createTicket(18, 2))
    tickets.push(createTicket(19, 3))

    const removed: JobTicket[] = tickets.splice(1, 99)

    print(removed[0].score)
    print(removed[1].score)
    print(jobs.destroyedJobCount())
}

pushReturnedTickets()
print(jobs.destroyedJobCount())
print(jobs.orderAt(0))
print(jobs.orderAt(1))

pushMovedLocalTicket()
print(jobs.destroyedJobCount())
print(jobs.orderAt(2))

popExtractedTicket()
print(jobs.destroyedJobCount())
print(jobs.orderAt(3))
print(jobs.orderAt(4))

shiftExtractedTicket()
print(jobs.destroyedJobCount())
print(jobs.orderAt(5))
print(jobs.orderAt(6))

spliceExtractedTickets()
print(jobs.destroyedJobCount())
print(jobs.orderAt(7))
print(jobs.orderAt(8))
print(jobs.orderAt(9))
print(jobs.orderAt(10))

spliceDiscardedTickets()
print(jobs.destroyedJobCount())
print(jobs.orderAt(11))
print(jobs.orderAt(12))
print(jobs.orderAt(13))

spliceZeroDeleteTickets()
print(jobs.destroyedJobCount())
print(jobs.orderAt(14))
print(jobs.orderAt(15))

splicePastEndTickets()
print(jobs.destroyedJobCount())
print(jobs.orderAt(16))
print(jobs.orderAt(17))
print(jobs.orderAt(18))
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "native resource array ownership program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected native resource array ownership artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS createJob scoreJob destructor yogi_array_push yogi_array_pop yogi_array_shift yogi_array_splice yogi_array_get)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected native resource array ownership IR to contain ${symbol}")
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
	message(FATAL_ERROR "native resource array ownership executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "0\n2\n1\n2\n2\n3\n3\n52\n3\n5\n5\n4\n63\n5\n7\n6\n7\n92\n103\n2\n7\n11\n9\n10\n8\n11\n13\n14\n12\n13\n14\n0\n14\n16\n15\n16\n182\n193\n16\n19\n18\n19\n17\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "native resource array ownership printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(NEGATIVE_POP_SOURCE "${TEST_WORK_DIR}/bad_pop.ts")
file(WRITE "${NEGATIVE_POP_SOURCE}" [=[
struct JobTicket {
    score: number
}

let tickets: JobTicket[] = []
let ticket: JobTicket = tickets.pop()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${NEGATIVE_POP_SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE negative_pop_result
	OUTPUT_VARIABLE negative_pop_stdout
	ERROR_VARIABLE negative_pop_stderr
)

if(negative_pop_result EQUAL 0)
	message(FATAL_ERROR "empty-array pop into concrete JobTicket unexpectedly compiled:\nstdout:\n${negative_pop_stdout}\nstderr:\n${negative_pop_stderr}")
endif()

if(NOT negative_pop_stderr MATCHES "can only initialize values of type")
	message(FATAL_ERROR "empty-array pop emitted unexpected diagnostic:\nstdout:\n${negative_pop_stdout}\nstderr:\n${negative_pop_stderr}")
endif()

set(NEGATIVE_SHIFT_SOURCE "${TEST_WORK_DIR}/bad_shift.ts")
file(WRITE "${NEGATIVE_SHIFT_SOURCE}" [=[
struct JobTicket {
    score: number
}

let tickets: JobTicket[] = []
let ticket: JobTicket = tickets.shift()
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${NEGATIVE_SHIFT_SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE negative_shift_result
	OUTPUT_VARIABLE negative_shift_stdout
	ERROR_VARIABLE negative_shift_stderr
)

if(negative_shift_result EQUAL 0)
	message(FATAL_ERROR "empty-array shift into concrete JobTicket unexpectedly compiled:\nstdout:\n${negative_shift_stdout}\nstderr:\n${negative_shift_stderr}")
endif()

if(NOT negative_shift_stderr MATCHES "can only initialize values of type")
	message(FATAL_ERROR "empty-array shift emitted unexpected diagnostic:\nstdout:\n${negative_shift_stdout}\nstderr:\n${negative_shift_stderr}")
endif()
