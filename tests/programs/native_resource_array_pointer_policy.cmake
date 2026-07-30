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
	message(FATAL_ERROR "native resource array pointer-policy program requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/native_jobs.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/native_jobs.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libnative_jobs.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdlib.h>

void yogi_observe_resource_create(void *address, const char *typeName);
void yogi_observe_resource_destroy(void *address, const char *typeName);

typedef struct NativeJob {
    double id;
} NativeJob;

typedef struct ResourceRecord {
    void *address;
    double id;
    int alive;
} ResourceRecord;

static ResourceRecord records[4096];
static int created_count = 0;
static int destroyed_count = 0;
static int duplicate_destroy_count = 0;
static int invalid_destroy_count = 0;
static int use_after_free_count = 0;

static int find_live_record(void *address) {
    for (int index = created_count - 1; index >= 0; --index) {
        if (records[index].address == address && records[index].alive) {
            return index;
        }
    }

    return -1;
}

static int find_stale_record(void *address) {
    for (int index = created_count - 1; index >= 0; --index) {
        if (records[index].address == address) {
            return index;
        }
    }

    return -1;
}

NativeJob *createJob(double id) {
    NativeJob *job = (NativeJob *)malloc(sizeof(NativeJob));
    if (!job || created_count >= 4096) {
        abort();
    }

    job->id = id;
    records[created_count].address = job;
    records[created_count].id = id;
    records[created_count].alive = 1;
    created_count += 1;
    yogi_observe_resource_create(job, "NativeJob");
    return job;
}

void destructor(void *address) {
    const int live_index = find_live_record(address);
    if (live_index >= 0) {
        records[live_index].alive = 0;
        destroyed_count += 1;
        yogi_observe_resource_destroy(address, "NativeJob");
        free(address);
        return;
    }

    if (find_stale_record(address) >= 0) {
        duplicate_destroy_count += 1;
        return;
    }

    invalid_destroy_count += 1;
}

double readJob(double id) {
    for (int index = created_count - 1; index >= 0; --index) {
        if (records[index].id == id && records[index].alive) {
            return id;
        }
    }

    use_after_free_count += 1;
    return -1.0;
}

double createdCount(void) {
    return (double)created_count;
}

double destroyedCount(void) {
    return (double)destroyed_count;
}

double liveCount(void) {
    return (double)(created_count - destroyed_count);
}

double duplicateDestroyCount(void) {
    return (double)duplicate_destroy_count;
}

double invalidDestroyCount(void) {
    return (double)invalid_destroy_count;
}

double useAfterFreeCount(void) {
    return (double)use_after_free_count;
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

set(MODELS_SOURCE "${TEST_WORK_DIR}/models.ts")
file(WRITE "${MODELS_SOURCE}" [=[
export struct NativeJob {
    id: number
}

export struct JobTicket {
    handle: ptr<NativeJob>
    score: number
}

export struct TicketQueue {
    items: JobTicket[]
}
]=])

set(ARRAY_OPS_SOURCE "${TEST_WORK_DIR}/array_ops.ts")
file(WRITE "${ARRAY_OPS_SOURCE}" [=[
import { JobTicket } from "./models"

export function discardLast(items: ptr<JobTicket[]>): void {
    items.pop()
}

export function discardFirst(items: ptr<JobTicket[]>): void {
    items.shift()
}

export function takeRange(items: ptr<JobTicket[]>, start: number, count: number): JobTicket[] {
    return items.splice(start, count)
}
]=])

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
import { NativeJob, JobTicket, TicketQueue } from "./models"
import { discardLast, discardFirst, takeRange } from "./array_ops"

extern jobs from "./libnative_jobs.a" {
    createJob(id: number): ptr<NativeJob>
    readJob(id: number): number
    createdCount(): number
    destroyedCount(): number
    liveCount(): number
    duplicateDestroyCount(): number
    invalidDestroyCount(): number
    useAfterFreeCount(): number
    destructor(resource: ptr<void>): void
}

function createTicket(id: number): JobTicket {
    const handle: ptr<NativeJob> = jobs.createJob(id)
    return { handle: handle, score: id * 10 }
}

function appendStress(items: ptr<JobTicket[]>, start: number): void {
    let index: number = 0

    while (index < 24) {
        index = index + 1

        if (index == 5) {
            continue
        }

        items.push(createTicket(start + index))

        if (index >= 20) {
            break
        }
    }
}

function addEdges(items: ptr<JobTicket[]>): void {
    {
        items.unshift(createTicket(1), createTicket(2))
        items.push(createTicket(3))
    }
}

function forwardMiddle(items: ptr<JobTicket[]>): JobTicket[] {
    return takeRange(items, 3, 4)
}

function discardPrefix(items: ptr<JobTicket[]>): void {
    items.splice(0, 2)
}

function insertPair(items: ptr<JobTicket[]>): void {
    items.splice(2, 0, createTicket(50), createTicket(51))
}

function takeAll(items: ptr<JobTicket[]>): JobTicket[] {
    {
        let removed: JobTicket[] = items.splice(0, 999)

        if (removed.length > 0) {
            return removed
        }
    }

    return []
}

function forwardAll(items: ptr<JobTicket[]>): JobTicket[] {
    return takeAll(items)
}

function scenario(): void {
    let tickets: JobTicket[] = []
    appendStress(&tickets, 100)
    print(jobs.createdCount())
    print(jobs.liveCount())

    addEdges(&tickets)
    print(jobs.createdCount())
    print(tickets.length)

    discardLast(&tickets)
    discardFirst(&tickets)
    print(jobs.destroyedCount())
    print(jobs.liveCount())

    let middle: JobTicket[] = forwardMiddle(&tickets)
    print(middle.length)
    print(jobs.destroyedCount())
    print(jobs.liveCount())

    middle.pop()
    print(jobs.destroyedCount())
    print(middle.length)

    discardPrefix(&tickets)
    print(jobs.destroyedCount())
    print(tickets.length)

    insertPair(&tickets)
    print(jobs.createdCount())
    print(jobs.liveCount())

    let all: JobTicket[] = forwardAll(&tickets)
    print(tickets.length)
    print(all.length)
    print(middle.length)
    print(jobs.readJob(all[0].score / 10))
    print(jobs.useAfterFreeCount())
    print(jobs.duplicateDestroyCount())
    print(jobs.invalidDestroyCount())
}

function replacementScenario(): void {
    let current: JobTicket[] = []
    current.push(createTicket(201))
    current.push(createTicket(202))

    let replacement: JobTicket[] = []
    replacement.push(createTicket(301))
    replacement.push(createTicket(302))
    replacement.push(createTicket(303))

    current = replacement.splice(0, replacement.length)
    print(jobs.createdCount())
    print(jobs.destroyedCount())
    print(jobs.liveCount())
    print(current.length)
    print(jobs.readJob(current[0].score / 10))
}

function nestedAggregateScenario(): void {
    let tickets: JobTicket[] = []
    tickets.push(createTicket(401))

    let queue: TicketQueue = { items: tickets }
    queue.items.push(createTicket(402))
    print(queue.items.length)
    print(jobs.liveCount())
}

function literalScenario(): void {
    let literal: JobTicket[] = [createTicket(501), createTicket(502)]
    print(literal.length)
    print(jobs.liveCount())
}

scenario()
print(jobs.createdCount())
print(jobs.destroyedCount())
print(jobs.liveCount())
print(jobs.useAfterFreeCount())
print(jobs.duplicateDestroyCount())
print(jobs.invalidDestroyCount())

replacementScenario()
print(jobs.destroyedCount())
print(jobs.liveCount())

nestedAggregateScenario()
print(jobs.createdCount())
print(jobs.destroyedCount())
print(jobs.liveCount())

literalScenario()
print(jobs.createdCount())
print(jobs.destroyedCount())
print(jobs.liveCount())
print(jobs.useAfterFreeCount())
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
	message(FATAL_ERROR "pointer-policy program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")
set(OPS_IR "${TEST_WORK_DIR}/packages/.cache/modules/array_ops.ts/array_ops.ll")
set(OPS_OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/array_ops.ts/array_ops.o")
set(MODELS_IR "${TEST_WORK_DIR}/packages/.cache/modules/models.ts/models.ll")
set(MODELS_OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/models.ts/models.o")

foreach(path IN ITEMS
	"${EXECUTABLE}"
	"${IR}"
	"${OBJECT}"
	"${OPS_IR}"
	"${OPS_OBJECT}"
	"${MODELS_IR}"
	"${MODELS_OBJECT}"
)
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected pointer-policy artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
file(READ "${OPS_IR}" ops_ir)
file(READ "${MODELS_IR}" models_ir)
string(CONCAT all_ir "${ir}\n" "${ops_ir}\n" "${models_ir}")
foreach(symbol IN ITEMS
	yogi_array_set_element_ownership_policy
	__yogi_array_element_destroy_
	yogi_array_push
	yogi_array_unshift
	yogi_array_pop_discard
	yogi_array_shift_discard
	yogi_array_splice
	yogi_array_destroy
)
	if(NOT all_ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected pointer-policy IR to contain ${symbol}")
	endif()
endforeach()

if(all_ir MATCHES "array.resource.cleanup")
	message(FATAL_ERROR "pointer-policy IR still contains the old caller-owned array cleanup loop")
endif()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "pointer-policy executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

if(run_stderr MATCHES "AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|runtime error:|ownership error")
	message(FATAL_ERROR "memory tooling reported a pointer-policy failure:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "19\n19\n22\n22\n2\n20\n4\n2\n20\n3\n3\n5\n14\n24\n19\n0\n16\n3\n102\n0\n0\n0\n24\n24\n0\n0\n0\n0\n29\n26\n3\n3\n301\n29\n0\n2\n2\n31\n31\n0\n2\n2\n33\n33\n0\n0\n0\n0\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "pointer-policy program printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
