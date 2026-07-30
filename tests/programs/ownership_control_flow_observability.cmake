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
	message(FATAL_ERROR "ownership control-flow program requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/native_resources.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/native_resources.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libnative_resources.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct NativeResource {
	double id;
} NativeResource;

static int created_resources = 0;
static int destroyed_resources = 0;
static int destroyed_labels = 0;

NativeResource *createResource(double id) {
	NativeResource *resource = (NativeResource *)malloc(sizeof(NativeResource));
	if (!resource) {
		abort();
	}

	resource->id = id;
	created_resources += 1;
	return resource;
}

char *makeLabel(double id) {
	char buffer[32];
	const int length = snprintf(buffer, sizeof(buffer), "ticket-%.0f", id);
	if (length < 0) {
		abort();
	}

	char *label = (char *)malloc((size_t)length + 1);
	if (!label) {
		abort();
	}

	memcpy(label, buffer, (size_t)length + 1);
	return label;
}

void destroyLabel(const char *label) {
	if (!label) {
		return;
	}

	destroyed_labels += 1;
	free((void *)label);
}

void destructor(void *pointer) {
	if (!pointer) {
		return;
	}

	destroyed_resources += 1;
	free(pointer);
}

double createdCount(void) {
	return (double)created_resources;
}

double destroyedCount(void) {
	return (double)destroyed_resources;
}

double destroyedLabelCount(void) {
	return (double)destroyed_labels;
}

double liveCount(void) {
	return (double)(created_resources - destroyed_resources);
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
	message(FATAL_ERROR "native control-flow fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native control-flow fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
endif()

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
struct NativeResource {
    id: number
}

struct Ticket {
    handle: ptr<NativeResource>
    id: number
}

extern resources from "./libnative_resources.a" {
    createResource(id: number): ptr<NativeResource>

    /** @abi return native-owned free=destroyLabel */
    makeLabel(id: number): string

    destroyLabel(label: string): void
    createdCount(): number
    destroyedCount(): number
    destroyedLabelCount(): number
    liveCount(): number
    destructor(resource: ptr<void>): void
}

function createTicket(id: number): Ticket {
    const handle: ptr<NativeResource> = resources.createResource(id)
    let ticket: Ticket = { handle: handle, id: id }
    return ticket
}

function borrowedId(ticket: ptr<Ticket>): number {
    return ticket.id
}

function normalPath(): void {
    let ticket: Ticket = createTicket(1)
    print(borrowedId(&ticket))
}

function earlyReturnPath(enabled: boolean): number {
    let ticket: Ticket = createTicket(2)

    if (enabled) {
        return borrowedId(&ticket)
    }

    return 0
}

function loopPaths(): number {
    let total: number = 0
    let index: number = 0

    while (index < 4) {
        let ticket: Ticket = createTicket(10 + index)
        let label: string = resources.makeLabel(10 + index)
        index = index + 1

        if (index == 1) {
            total = total + borrowedId(&ticket)
            continue
        }

        if (index == 3) {
            total = total + borrowedId(&ticket)
            break
        }

        total = total + borrowedId(&ticket)
    }

    return total
}

normalPath()
print(earlyReturnPath(true))
print(loopPaths())
print(resources.createdCount())
print(resources.destroyedCount())
print(resources.destroyedLabelCount())
print(resources.liveCount())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "ownership control-flow program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected ownership control-flow artifact was not generated: ${path}")
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
	message(FATAL_ERROR "ownership control-flow executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1\n2\n33\n5\n5\n3\n0\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "ownership control-flow program printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
