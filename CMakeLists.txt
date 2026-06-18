cmake_minimum_required(VERSION 3.10)
project(yogi VERSION 0.0.1 LANGUAGES C CXX)

# ============================================================
#                  MACOS & LLVM SETUP
# ============================================================
set(CMAKE_OSX_DEPLOYMENT_TARGET "26.0")
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)

set(LIBS_DIR "${CMAKE_SOURCE_DIR}/libs")
set(CORE_DIR "${CMAKE_SOURCE_DIR}/src/core")
set(TS_PARSER_DIR "${CMAKE_SOURCE_DIR}/src/core")
set(LLVM_ROOT "${LIBS_DIR}/llvm-project/build/llvm-custom" CACHE PATH "Path to the vendored LLVM installation")
set(YOGI_ENABLE_LLVM "ON" CACHE STRING "Enable LLVM support: ON or OFF")
set_property(CACHE YOGI_ENABLE_LLVM PROPERTY STRINGS ON OFF)
set(YOGI_ALLOCATOR "mimalloc" CACHE STRING "Runtime allocator: mimalloc, jemalloc, or system")
set_property(CACHE YOGI_ALLOCATOR PROPERTY STRINGS mimalloc jemalloc system)

unset(ENV{LLVM_CONFIG})
unset(ENV{LLVM_DIR})

cmake_policy(SET CMP0075 NEW)
cmake_policy(SET CMP0074 NEW)

foreach(_YOGI_LINKER_FLAGS_VAR
                CMAKE_EXE_LINKER_FLAGS
                CMAKE_SHARED_LINKER_FLAGS
                CMAKE_MODULE_LINKER_FLAGS)
        if(DEFINED ${_YOGI_LINKER_FLAGS_VAR} AND NOT "${${_YOGI_LINKER_FLAGS_VAR}}" STREQUAL "")
                string(REGEX REPLACE "(^| )-L/[^ ]*/llvm(@[^ /]+)?/lib" " " ${_YOGI_LINKER_FLAGS_VAR} "${${_YOGI_LINKER_FLAGS_VAR}}")
                string(STRIP "${${_YOGI_LINKER_FLAGS_VAR}}" ${_YOGI_LINKER_FLAGS_VAR})
                set(${_YOGI_LINKER_FLAGS_VAR} "${${_YOGI_LINKER_FLAGS_VAR}}" CACHE STRING "" FORCE)
        endif()
endforeach()

# ============================================================
#                       LLVM
# ============================================================
set(YOGI_LLVM_ENABLED OFF)
set(llvm_libs "")

if(NOT YOGI_ENABLE_LLVM STREQUAL "OFF")
        if(EXISTS "${LLVM_ROOT}/lib/cmake/llvm/LLVMConfig.cmake")
                find_package(LLVM QUIET CONFIG
                        PATHS "${LLVM_ROOT}/lib/cmake/llvm"
                        NO_DEFAULT_PATH
                )
        endif()

        if(LLVM_FOUND)
                message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION} at ${LLVM_DIR}")

                set(YOGI_LLVM_ENABLED ON)
                set(LLVM_ENABLE_RTTI ON)

                list(APPEND CMAKE_MODULE_PATH "${LLVM_CMAKE_DIR}")
                add_definitions(${LLVM_DEFINITIONS})

                find_library(LLVM_TARGET_PARSER_LIB
                        NAMES LLVMTargetParser
                        PATHS ${LLVM_LIBRARY_DIRS} "${LLVM_ROOT}/lib"
                        NO_DEFAULT_PATH
                )

                set(LLVM_COMPONENTS
                        Core
                        Support
                        IRReader
                        Linker

                        Analysis
                        InstCombine
                        ScalarOpts
                        TransformUtils
                        IPO
                        Object
                        Passes

                        BitReader
                        BitWriter

                        Target

                        MC
                        MCParser

                        X86CodeGen
                        X86AsmParser
                        X86Desc
                        X86Info

                        AArch64CodeGen
                        AArch64AsmParser
                        AArch64Desc
                        AArch64Info
                        AArch64Utils

                        OrcJIT
                        OrcShared
                        OrcTargetProcess
                        JITLink
                        ExecutionEngine
                )

                if(LLVM_TARGET_PARSER_LIB)
                        list(APPEND LLVM_COMPONENTS TargetParser)
                endif()

                llvm_map_components_to_libnames(llvm_libs ${LLVM_COMPONENTS})
                list(REMOVE_DUPLICATES llvm_libs)

                find_program(YOGI_LLD_EXECUTABLE
                        NAMES ld.lld lld
                        PATHS "${LLVM_TOOLS_BINARY_DIR}" "${LLVM_ROOT}/bin"
                        NO_DEFAULT_PATH
                )

                find_program(YOGI_LD64_LLD_EXECUTABLE
                        NAMES ld64.lld
                        PATHS "${LLVM_TOOLS_BINARY_DIR}" "${LLVM_ROOT}/bin"
                        NO_DEFAULT_PATH
                )

                if(NOT YOGI_LLD_EXECUTABLE)
                        set(YOGI_LLD_EXECUTABLE "")
                endif()

                if(NOT YOGI_LD64_LLD_EXECUTABLE)
                        set(YOGI_LD64_LLD_EXECUTABLE "")
                endif()

                set(YOGI_MACOS_SDK_PATH "")
                if(APPLE)
                        execute_process(
                                COMMAND xcrun --show-sdk-path
                                OUTPUT_VARIABLE YOGI_MACOS_SDK_PATH
                                OUTPUT_STRIP_TRAILING_WHITESPACE
                                ERROR_QUIET
                        )
                endif()

                find_package(OpenSSL QUIET)
        else()
                message(FATAL_ERROR
                        "YOGI_ENABLE_LLVM is ON, but vendored LLVM was not found at ${LLVM_ROOT}. "
                        "Build it from tools/llvm-project and install it into libs/llvm-project/build/llvm-custom."
                )
        endif()
endif()

# ============================================================
#                  SOURCES
# ============================================================
file(GLOB_RECURSE PROD_SOURCES "${CMAKE_SOURCE_DIR}/src/*.cpp")
file(GLOB_RECURSE LLVM_SOURCE_FILES "${CMAKE_SOURCE_DIR}/src/core/llvm/*.cpp")
list(FILTER PROD_SOURCES EXCLUDE REGEX "^${CMAKE_SOURCE_DIR}/src/runtime/.*")

set_source_files_properties(
        ${LLVM_SOURCE_FILES}
        PROPERTIES COMPILE_OPTIONS "-std=gnu++20"
)

# ============================================================
#                       RUNTIME
# ============================================================
add_subdirectory(src/runtime)

# ============================================================
#                     EXECUTABLE
# ============================================================
add_executable(${PROJECT_NAME}
        ${CMAKE_SOURCE_DIR}/src/core/yogi.cpp
        ${PROD_SOURCES}
)

# target_* calls must come AFTER add_executable
target_include_directories(${PROJECT_NAME} PRIVATE
        ${CORE_DIR}
        ${CMAKE_SOURCE_DIR}
        ${CMAKE_SOURCE_DIR}/tools/flatbuffers/include
        ${LIBS_DIR}
)

if(YOGI_LLVM_ENABLED)
        set(YOGI_RUNTIME_ALLOCATOR_LIBRARY_PATH "")

        if(DEFINED YOGI_RUNTIME_ALLOCATOR_TARGET AND TARGET ${YOGI_RUNTIME_ALLOCATOR_TARGET})
                set(YOGI_RUNTIME_ALLOCATOR_LIBRARY_PATH "$<TARGET_FILE:${YOGI_RUNTIME_ALLOCATOR_TARGET}>")
        endif()

        target_include_directories(${PROJECT_NAME} PRIVATE
                ${LLVM_ROOT}/include
                ${LLVM_INCLUDE_DIRS}
        )

        if(LLVM_LIBRARY_DIRS)
                target_link_directories(${PROJECT_NAME} PRIVATE ${LLVM_LIBRARY_DIRS})
        elseif(EXISTS "${LLVM_ROOT}/lib")
                target_link_directories(${PROJECT_NAME} PRIVATE "${LLVM_ROOT}/lib")
        endif()

        target_compile_definitions(${PROJECT_NAME} PUBLIC
                YOGI_HAS_LLVM=1
                YOGI_LLD_PATH="${YOGI_LLD_EXECUTABLE}"
                YOGI_LD64_LLD_PATH="${YOGI_LD64_LLD_EXECUTABLE}"
                YOGI_MACOS_SDK_PATH="${YOGI_MACOS_SDK_PATH}"
                YOGI_MACOS_DEPLOYMENT_TARGET="${CMAKE_OSX_DEPLOYMENT_TARGET}"
                YOGI_RUNTIME_LIBRARY_PATH="$<TARGET_FILE:yogi_runtime>"
                YOGI_RUNTIME_ALLOCATOR_LIBRARY_PATH="${YOGI_RUNTIME_ALLOCATOR_LIBRARY_PATH}"
        )

        target_link_libraries(${PROJECT_NAME} PRIVATE
                ${llvm_libs}
        )

        if(EXISTS "${LLVM_LIBRARY_DIRS}/liblldCommon.a")
                target_link_libraries(${PROJECT_NAME} PRIVATE
                        "${LLVM_LIBRARY_DIRS}/liblldCommon.a"
                        "${LLVM_LIBRARY_DIRS}/liblldELF.a"
                        "${LLVM_LIBRARY_DIRS}/liblldMachO.a"
                )
        elseif(EXISTS "${LLVM_ROOT}/lib/liblldCommon.a")
                target_link_libraries(${PROJECT_NAME} PRIVATE
                        "${LLVM_ROOT}/lib/liblldCommon.a"
                        "${LLVM_ROOT}/lib/liblldELF.a"
                        "${LLVM_ROOT}/lib/liblldMachO.a"
                )
        endif()

        if(OpenSSL_FOUND)
                target_link_libraries(${PROJECT_NAME} PRIVATE OpenSSL::Crypto)
        endif()
else()
        target_compile_definitions(${PROJECT_NAME} PUBLIC
                YOGI_HAS_LLVM=0
        )
endif()

#src/compiler/bin/ts-parser-macos-arm64
target_compile_definitions(yogi PUBLIC
        TS_PARSERS="${CMAKE_SOURCE_DIR}/src/compiler/bin"
        TEST_PATH="${CMAKE_SOURCE_DIR}/tests/main.io"
)

target_link_libraries(${PROJECT_NAME} PRIVATE yogi_runtime)

include(CTest)

if(BUILD_TESTING)
        add_executable(yogi_runtime_cast_test
                ${CMAKE_SOURCE_DIR}/tests/runtime/unit/runtime_cast_test.cpp
        )

        target_link_libraries(yogi_runtime_cast_test PRIVATE yogi_runtime)
        target_compile_definitions(yogi_runtime_cast_test PRIVATE
                YOGI_EXPECTED_ALLOCATOR="${YOGI_ALLOCATOR}"
        )

        add_test(
                NAME yogi_runtime_cast_test
                COMMAND yogi_runtime_cast_test
        )

        add_executable(yogi_runtime_ownership_negative_test
                ${CMAKE_SOURCE_DIR}/tests/runtime/unit/runtime_ownership_negative_test.cpp
        )

        target_link_libraries(yogi_runtime_ownership_negative_test PRIVATE yogi_runtime)

        add_test(
                NAME yogi_runtime_ownership_debug_test
                COMMAND yogi_runtime_ownership_negative_test
        )

        if(YOGI_LLVM_ENABLED)
                add_test(
                        NAME yogi_pipeline_runtime_any
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-runtime-any
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/01-runtime/runtime_any.cmake
                )

                add_test(
                        NAME yogi_pipeline_dynamic_expressions
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-dynamic-expressions
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/02-variables-aggregates/dynamic_expressions.cmake
                )

                add_test(
                        NAME yogi_pipeline_aggregates
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-aggregates
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/02-variables-aggregates/aggregates.cmake
                )

                add_test(
                        NAME yogi_pipeline_escape_analysis
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-escape-analysis
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/03-memory-management/escape_analysis.cmake
                )

                add_test(
                        NAME yogi_pipeline_function_ownership
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-function-ownership
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/03-memory-management/function_ownership.cmake
                )

                add_test(
                        NAME yogi_pipeline_aggregate_assignment_ownership
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-aggregate-assignment-ownership
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/03-memory-management/aggregate_assignment_ownership.cmake
                )

                add_test(
                        NAME yogi_pipeline_destructor_scheduling
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-destructor-scheduling
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/03-memory-management/destructor_scheduling.cmake
                )

                add_test(
                        NAME yogi_pipeline_move_state_validation
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-move-state-validation
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/03-memory-management/move_state_validation.cmake
                )

                add_test(
                        NAME yogi_pipeline_loops_and_methods
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-loops-and-methods
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/04-control-flow/loops_and_methods.cmake
                )

                add_test(
                        NAME yogi_pipeline_switch
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-switch
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/04-control-flow/switch.cmake
                )

                add_test(
                        NAME yogi_pipeline_switch_ownership
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-switch-ownership
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/04-control-flow/switch_ownership.cmake
                )

                add_test(
                        NAME yogi_pipeline_switch_definite_assignment
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-switch-definite-assignment
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/04-control-flow/switch_definite_assignment.cmake
                )

                add_test(
                        NAME yogi_pipeline_break
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/pipeline-break
                                -P ${CMAKE_SOURCE_DIR}/tests/runtime/sessions/04-control-flow/break.cmake
                )
        endif()
endif()
