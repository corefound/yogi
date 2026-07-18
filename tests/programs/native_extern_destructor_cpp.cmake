if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

find_program(YOGI_NATIVE_CXX NAMES c++ clang++ g++)
find_program(YOGI_NATIVE_AR NAMES ar llvm-ar)

if(NOT YOGI_NATIVE_CXX OR NOT YOGI_NATIVE_AR)
	message(FATAL_ERROR "native extern destructor C++ program requires a C++ compiler and ar/llvm-ar")
endif()

set(NATIVE_SOURCE "${TEST_WORK_DIR}/cpp_resource.cpp")
set(NATIVE_OBJECT "${TEST_WORK_DIR}/cpp_resource.o")
set(NATIVE_LIBRARY "${TEST_WORK_DIR}/libcpp_resource.a")

file(WRITE "${NATIVE_SOURCE}" [=[
#include <cstdlib>

void *operator new(unsigned long size) {
	return std::malloc(size);
}

void operator delete(void *pointer) noexcept {
	std::free(pointer);
}

struct CppResource {
	double id;
};

static int destroyed_count = 0;

extern "C" CppResource *createCpp(double id) {
	return new CppResource{id};
}

extern "C" void destructor(void *pointer) {
	auto *resource = static_cast<CppResource *>(pointer);
	if (!resource) {
		return;
	}

	destroyed_count += 1;
	delete resource;
}

extern "C" double destroyedCount(void) {
	return static_cast<double>(destroyed_count);
}
]=])

execute_process(
	COMMAND "${YOGI_NATIVE_CXX}" -std=c++17 -fno-exceptions -fno-rtti -fno-unwind-tables -fno-asynchronous-unwind-tables -c "${NATIVE_SOURCE}" -o "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_compile_result
	OUTPUT_VARIABLE native_compile_stdout
	ERROR_VARIABLE native_compile_stderr
)

if(NOT native_compile_result EQUAL 0)
	message(FATAL_ERROR "native extern destructor C++ fixture compile failed:\nstdout:\n${native_compile_stdout}\nstderr:\n${native_compile_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_NATIVE_AR}" rcs "${NATIVE_LIBRARY}" "${NATIVE_OBJECT}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE native_archive_result
	OUTPUT_VARIABLE native_archive_stdout
	ERROR_VARIABLE native_archive_stderr
)

if(NOT native_archive_result EQUAL 0)
	message(FATAL_ERROR "native extern destructor C++ fixture archive failed:\nstdout:\n${native_archive_stdout}\nstderr:\n${native_archive_stderr}")
endif()

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
struct CppResource {
    id: number
}

extern cppResource from "./libcpp_resource.a" {
    createCpp(id: number): ptr<CppResource>
    destroyedCount(): number
    destructor(resource: ptr<void>): void
}

function run(): void {
    const resource: ptr<CppResource> = cppResource.createCpp(10)
}

run()
print(cppResource.destroyedCount())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "native extern destructor C++ program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected native extern destructor C++ artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol IN ITEMS createCpp destructor)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected native extern destructor C++ IR to contain ${symbol}")
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
	message(FATAL_ERROR "native extern destructor C++ executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "native extern destructor C++ printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
