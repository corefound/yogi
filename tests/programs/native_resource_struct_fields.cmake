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
	message(FATAL_ERROR "native resource struct field program requires a C compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/native_resource.c")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/native_resource.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libnative_resource.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <stdlib.h>

typedef struct NativeResource {
	double id;
} NativeResource;

static int destroyed_count = 0;
static int order_count = 0;
static int order[32];

NativeResource *create(double id) {
	NativeResource *resource = (NativeResource *)malloc(sizeof(NativeResource));
	if (!resource) {
		return NULL;
	}

	resource->id = id;
	return resource;
}

void destructor(void *pointer) {
	NativeResource *resource = (NativeResource *)pointer;
	if (!resource) {
		return;
	}

	order[order_count++] = (int)resource->id;
	destroyed_count += 1;
	free(resource);
}

double destroyedCount(void) {
	return (double)destroyed_count;
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
	message(FATAL_ERROR "native resource struct field C fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native resource struct field C fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
endif()

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
struct NativeResource {
    id: number
}

struct Holder {
    resource: ptr<NativeResource>
}

struct Nested {
    holder: Holder
}

extern algorithm from "./libnative_resource.a" {
    create(id: number): ptr<NativeResource>
    destroyedCount(): number
    orderAt(index: number): number
    destructor(resource: ptr<void>): void
}

function fromLocal(): void {
    const resource: ptr<NativeResource> = algorithm.create(1)
    let holder: Holder = { resource: resource }
}

function fromInline(): void {
    let holder: Holder = { resource: algorithm.create(2) }
}

function replaceField(): void {
    let holder: Holder = { resource: algorithm.create(3) }
    holder.resource = algorithm.create(4)
}

function nestedMove(): void {
    const resource: ptr<NativeResource> = algorithm.create(5)
    let nested: Nested = {
        holder: {
            resource: resource
        }
    }
}

function replaceNestedField(): void {
    let nested: Nested = {
        holder: {
            resource: algorithm.create(6)
        }
    }
    nested.holder.resource = algorithm.create(7)
}

function localMove(): void {
    let first: Holder = { resource: algorithm.create(8) }
    let second: Holder = first
}

function makeMoved(): Holder {
    let holder: Holder = { resource: algorithm.create(9) }
    return holder
}

function returnedMove(): void {
    let holder: Holder = makeMoved()
}

function replaceWithMove(): void {
    let target: Holder = { resource: algorithm.create(10) }
    let source: Holder = { resource: algorithm.create(11) }
    target = source
}

function makeMovedWithId(id: number): Holder {
    let holder: Holder = { resource: algorithm.create(id) }
    return holder
}

function replaceWithReturnedMove(): void {
    let target: Holder = { resource: algorithm.create(12) }
    target = makeMovedWithId(13)
}

function consume(holder: Holder): void {
}

function consumeByValue(): void {
    let holder: Holder = { resource: algorithm.create(14) }
    consume(holder)
}

fromLocal()
print(algorithm.destroyedCount())
print(algorithm.orderAt(0))

fromInline()
print(algorithm.destroyedCount())
print(algorithm.orderAt(1))

replaceField()
print(algorithm.orderAt(2))
print(algorithm.orderAt(3))
print(algorithm.destroyedCount())

nestedMove()
print(algorithm.orderAt(4))
print(algorithm.destroyedCount())

replaceNestedField()
print(algorithm.orderAt(5))
print(algorithm.orderAt(6))
print(algorithm.destroyedCount())

localMove()
print(algorithm.orderAt(7))
print(algorithm.destroyedCount())

returnedMove()
print(algorithm.orderAt(8))
print(algorithm.destroyedCount())

replaceWithMove()
print(algorithm.orderAt(9))
print(algorithm.orderAt(10))
print(algorithm.destroyedCount())

replaceWithReturnedMove()
print(algorithm.orderAt(11))
print(algorithm.orderAt(12))
print(algorithm.destroyedCount())

consumeByValue()
print(algorithm.orderAt(13))
print(algorithm.destroyedCount())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "native resource struct field program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected native resource struct field artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS create destructor)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected native resource struct field IR to contain ${symbol}")
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
	message(FATAL_ERROR "native resource struct field executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1\n1\n2\n2\n3\n4\n4\n5\n5\n6\n7\n7\n8\n8\n9\n9\n10\n11\n11\n12\n13\n13\n14\n14\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "native resource struct field printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
