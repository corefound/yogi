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
	message(FATAL_ERROR "native job ticket ownership program requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/native_jobs.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/native_jobs.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libnative_jobs.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct NativeJob {
	double id;
	double weight;
} NativeJob;

static int destroyed_jobs = 0;
static int destroyed_labels = 0;
static int order_count = 0;
static int order[32];

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

char *makeLabel(double id) {
	char buffer[64];
	const int length = snprintf(buffer, sizeof(buffer), "job-%.0f", id);
	if (length < 0) {
		return NULL;
	}

	char *label = (char *)malloc((size_t)length + 1);
	if (!label) {
		return NULL;
	}

	memcpy(label, buffer, (size_t)length + 1);
	return label;
}

void destroyLabel(const char *value) {
	if (!value) {
		return;
	}

	destroyed_labels += 1;
	free((void *)value);
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

double destroyedLabelCount(void) {
	return (double)destroyed_labels;
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
	message(FATAL_ERROR "native job ticket fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native job ticket fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
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

    /** @abi return native-owned free=destroyLabel */
    makeLabel(id: number): string

    destroyLabel(value: string): void
    destroyedJobCount(): number
    destroyedLabelCount(): number
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

function replaceTicket(): JobTicket {
    let current: JobTicket = createTicket(1, 5)
    let next: JobTicket = createTicket(2, 7)

    current = next

    print(jobs.destroyedJobCount())
    print(jobs.orderAt(0))

    return current
}

function consume(ticket: JobTicket): void {
    print(ticket.score)
}

function run(): void {
    let ticket: JobTicket = replaceTicket()
    let label: string = jobs.makeLabel(2)

    print(ticket.score)
    print(label)
    print(jobs.destroyedLabelCount())

    consume(ticket)

    print(jobs.destroyedJobCount())
    print(jobs.orderAt(1))
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
	message(FATAL_ERROR "native job ticket ownership program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected native job ticket ownership artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS createJob scoreJob makeLabel destroyLabel destructor yogi_string_from_native_owned)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected native job ticket ownership IR to contain ${symbol}")
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
	message(FATAL_ERROR "native job ticket ownership executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1\n1\n27\njob-2\n1\n27\n2\n2\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "native job ticket ownership printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
