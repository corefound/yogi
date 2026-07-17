cmake_minimum_required(VERSION 3.20)

# ============================================================
#                  MACOS SETUP
# ============================================================
# Must be set before project() for macOS builds.
if(APPLE)
        set(CMAKE_OSX_DEPLOYMENT_TARGET "14.0" CACHE STRING "Minimum macOS deployment target")
endif()

project(yogi VERSION 0.0.1 LANGUAGES C CXX)

# ============================================================
#                  GLOBAL CONFIG
# ============================================================
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

# When ON, compile Yogi with relative paths suitable for portable preview packages.
# For normal local development, leave OFF.
set(YOGI_PORTABLE_BUILD "OFF" CACHE STRING "Build Yogi with portable relative runtime paths: ON or OFF")
set_property(CACHE YOGI_PORTABLE_BUILD PROPERTY STRINGS ON OFF)

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

set(YOGI_LLD_FILENAME "")
set(YOGI_LD64_LLD_FILENAME "")
set(YOGI_MACOS_SDK_PATH "")

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
                        NAMES ld.lld lld lld.exe
                        PATHS "${LLVM_TOOLS_BINARY_DIR}" "${LLVM_ROOT}/bin"
                        NO_DEFAULT_PATH
                )

                find_program(YOGI_LD64_LLD_EXECUTABLE
                        NAMES ld64.lld ld64.lld.exe
                        PATHS "${LLVM_TOOLS_BINARY_DIR}" "${LLVM_ROOT}/bin"
                        NO_DEFAULT_PATH
                )

                if(YOGI_LLD_EXECUTABLE)
                        get_filename_component(YOGI_LLD_FILENAME "${YOGI_LLD_EXECUTABLE}" NAME)
                endif()

                if(YOGI_LD64_LLD_EXECUTABLE)
                        get_filename_component(YOGI_LD64_LLD_FILENAME "${YOGI_LD64_LLD_EXECUTABLE}" NAME)
                endif()

                if(APPLE)
                        execute_process(
                                COMMAND xcrun --show-sdk-path
                                OUTPUT_VARIABLE YOGI_MACOS_SDK_PATH
                                OUTPUT_STRIP_TRAILING_WHITESPACE
                                ERROR_QUIET
                        )
                endif()

                find_package(OpenSSL QUIET)

                find_library(YOGI_LLD_COMMON_LIB
                        NAMES lldCommon liblldCommon
                        PATHS ${LLVM_LIBRARY_DIRS} "${LLVM_ROOT}/lib"
                        NO_DEFAULT_PATH
                )

                find_library(YOGI_LLD_ELF_LIB
                        NAMES lldELF liblldELF
                        PATHS ${LLVM_LIBRARY_DIRS} "${LLVM_ROOT}/lib"
                        NO_DEFAULT_PATH
                )

                find_library(YOGI_LLD_MACHO_LIB
                        NAMES lldMachO liblldMachO
                        PATHS ${LLVM_LIBRARY_DIRS} "${LLVM_ROOT}/lib"
                        NO_DEFAULT_PATH
                )
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
file(GLOB_RECURSE PROD_SOURCES
        "${CMAKE_SOURCE_DIR}/src/core/*.cpp"
        "${CMAKE_SOURCE_DIR}/src/pack/src/*.cpp"
)

file(GLOB_RECURSE LLVM_SOURCE_FILES
        "${CMAKE_SOURCE_DIR}/src/core/llvm/*.cpp"
)

list(REMOVE_ITEM PROD_SOURCES
        "${CMAKE_SOURCE_DIR}/src/core/yogi.cpp"
        "${CMAKE_SOURCE_DIR}/src/pack/src/cli/main.cpp"
)

if(LLVM_SOURCE_FILES)
        if(MSVC)
                set_source_files_properties(
                        ${LLVM_SOURCE_FILES}
                        PROPERTIES COMPILE_OPTIONS "/std:c++20"
                )
        else()
                set_source_files_properties(
                        ${LLVM_SOURCE_FILES}
                        PROPERTIES COMPILE_OPTIONS "-std=gnu++20"
                )
        endif()
endif()

# ============================================================
#                       RUNTIME
# ============================================================
add_subdirectory(src/runtime)

# ============================================================
#                     EXECUTABLE
# ============================================================
add_executable(${PROJECT_NAME}
        ${CMAKE_SOURCE_DIR}/src/pack/src/cli/main.cpp
        ${CMAKE_SOURCE_DIR}/src/core/yogi.cpp
        ${PROD_SOURCES}
)

target_include_directories(${PROJECT_NAME} PRIVATE
        ${CORE_DIR}
        ${CMAKE_SOURCE_DIR}
        ${CMAKE_SOURCE_DIR}/src/pack/include
        ${CMAKE_SOURCE_DIR}/src/pack/src
        ${CMAKE_SOURCE_DIR}/tools/flatbuffers/include
        ${LIBS_DIR}
)

# ============================================================
#                  PORTABLE PATH DEFINES
# ============================================================
set(YOGI_TS_PARSERS_DEFINE "${CMAKE_SOURCE_DIR}/src/compiler/bin")
set(YOGI_TEST_PATH_DEFINE "${CMAKE_SOURCE_DIR}/tests/main.io")
set(YOGI_RUNTIME_LIBRARY_PATH_DEFINE "$<TARGET_FILE:yogi_runtime>")
set(YOGI_RUNTIME_ALLOCATOR_LIBRARY_PATH_DEFINE "")
set(YOGI_LLD_PATH_DEFINE "${YOGI_LLD_EXECUTABLE}")
set(YOGI_LD64_LLD_PATH_DEFINE "${YOGI_LD64_LLD_EXECUTABLE}")

if(DEFINED YOGI_RUNTIME_ALLOCATOR_TARGET AND TARGET ${YOGI_RUNTIME_ALLOCATOR_TARGET})
        set(YOGI_RUNTIME_ALLOCATOR_LIBRARY_PATH_DEFINE "$<TARGET_FILE:${YOGI_RUNTIME_ALLOCATOR_TARGET}>")
endif()

if(YOGI_PORTABLE_BUILD STREQUAL "ON")
        # These are relative to the portable package root.
        # Expected usage:
        #   cd yogi-macos-arm64
        #   ./bin/yogi examples/hello.yogi
        #
        # For full portability from any working directory, the C++ side should resolve
        # these relative to the executable path or package root.
        set(YOGI_TS_PARSERS_DEFINE "parsers")
        set(YOGI_TEST_PATH_DEFINE "tests/main.io")
        set(YOGI_RUNTIME_LIBRARY_PATH_DEFINE "lib/$<TARGET_FILE_NAME:yogi_runtime>")

        if(DEFINED YOGI_RUNTIME_ALLOCATOR_TARGET AND TARGET ${YOGI_RUNTIME_ALLOCATOR_TARGET})
                set(YOGI_RUNTIME_ALLOCATOR_LIBRARY_PATH_DEFINE "lib/$<TARGET_FILE_NAME:${YOGI_RUNTIME_ALLOCATOR_TARGET}>")
        endif()

        if(YOGI_LLD_FILENAME)
                set(YOGI_LLD_PATH_DEFINE "bin/tools/${YOGI_LLD_FILENAME}")
        endif()

        if(YOGI_LD64_LLD_FILENAME)
                set(YOGI_LD64_LLD_PATH_DEFINE "bin/tools/${YOGI_LD64_LLD_FILENAME}")
        endif()
endif()

# ============================================================
#                       LLVM LINKING
# ============================================================
if(YOGI_LLVM_ENABLED)
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
                YOGI_LLD_PATH="${YOGI_LLD_PATH_DEFINE}"
                YOGI_LD64_LLD_PATH="${YOGI_LD64_LLD_PATH_DEFINE}"
                YOGI_MACOS_SDK_PATH="${YOGI_MACOS_SDK_PATH}"
                YOGI_MACOS_DEPLOYMENT_TARGET="${CMAKE_OSX_DEPLOYMENT_TARGET}"
                YOGI_RUNTIME_LIBRARY_PATH="${YOGI_RUNTIME_LIBRARY_PATH_DEFINE}"
                YOGI_RUNTIME_ALLOCATOR_LIBRARY_PATH="${YOGI_RUNTIME_ALLOCATOR_LIBRARY_PATH_DEFINE}"
        )

        target_link_libraries(${PROJECT_NAME} PRIVATE
                ${llvm_libs}
        )

        if(YOGI_LLD_COMMON_LIB AND YOGI_LLD_ELF_LIB AND YOGI_LLD_MACHO_LIB)
                target_link_libraries(${PROJECT_NAME} PRIVATE
                        "${YOGI_LLD_COMMON_LIB}"
                        "${YOGI_LLD_ELF_LIB}"
                        "${YOGI_LLD_MACHO_LIB}"
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

target_compile_definitions(${PROJECT_NAME} PUBLIC
        TS_PARSERS="${YOGI_TS_PARSERS_DEFINE}"
        TEST_PATH="${YOGI_TEST_PATH_DEFINE}"
)

target_link_libraries(${PROJECT_NAME} PRIVATE yogi_runtime)

# ============================================================
#                       TESTS
# ============================================================
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

        add_executable(yogi_runtime_range_negative_test
                ${CMAKE_SOURCE_DIR}/tests/runtime/unit/runtime_range_negative_test.cpp
        )

        target_link_libraries(yogi_runtime_range_negative_test PRIVATE yogi_runtime)

        add_test(
                NAME yogi_runtime_range_negative_test
                COMMAND yogi_runtime_range_negative_test
        )

        add_executable(yogi_runtime_string_test
                ${CMAKE_SOURCE_DIR}/tests/runtime/unit/runtime_string_test.cpp
        )

        target_link_libraries(yogi_runtime_string_test PRIVATE yogi_runtime)

        add_test(
                NAME yogi_runtime_string_test
                COMMAND yogi_runtime_string_test
        )

        add_executable(yogi_runtime_array_storage_test
                ${CMAKE_SOURCE_DIR}/tests/runtime/unit/runtime_array_storage_test.cpp
        )

        target_link_libraries(yogi_runtime_array_storage_test PRIVATE yogi_runtime)

        add_test(
                NAME yogi_runtime_array_storage_test
                COMMAND yogi_runtime_array_storage_test
        )

        function(add_yogi_pipeline_test TEST_NAME TEST_WORK_DIR TEST_SCRIPT)
                add_test(
                        NAME ${TEST_NAME}
                        COMMAND ${CMAKE_COMMAND}
                                -DYOGI_EXECUTABLE=$<TARGET_FILE:${PROJECT_NAME}>
                                -DTEST_WORK_DIR=${CMAKE_BINARY_DIR}/tests/${TEST_WORK_DIR}
                                -P ${CMAKE_SOURCE_DIR}/${TEST_SCRIPT}
                )
        endfunction()

        function(add_yogi_program_test TEST_NAME TEST_WORK_DIR TEST_SCRIPT)
                add_yogi_pipeline_test(${TEST_NAME} ${TEST_WORK_DIR} ${TEST_SCRIPT})
        endfunction()

        if(YOGI_LLVM_ENABLED)
                add_yogi_pipeline_test(
                        yogi_pipeline_runtime_any
                        pipeline-runtime-any
                        tests/runtime/sessions/01-runtime/runtime_any.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_dynamic_expressions
                        pipeline-dynamic-expressions
                        tests/runtime/sessions/02-variables-aggregates/dynamic_expressions.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_strict_operators
                        pipeline-strict-operators
                        tests/runtime/sessions/02-variables-aggregates/strict_operators.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_aggregates
                        pipeline-aggregates
                        tests/runtime/sessions/02-variables-aggregates/aggregates.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_struct_declarations
                        pipeline-struct-declarations
                        tests/runtime/sessions/02-variables-aggregates/struct_declarations.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_data_type_lowering_ir
                        pipeline-data-type-lowering-ir
                        tests/runtime/sessions/02-variables-aggregates/data_type_lowering_ir.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_methods
                        pipeline-array-methods
                        tests/runtime/sessions/02-variables-aggregates/array_methods.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_struct_string_at
                        pipeline-array-struct-string-at
                        tests/runtime/sessions/02-variables-aggregates/array_struct_string_at.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_flat_depth_semantics
                        pipeline-array-flat-depth-semantics
                        tests/runtime/sessions/02-variables-aggregates/array_flat_depth_semantics.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_method_policy
                        pipeline-array-method-policy
                        tests/runtime/sessions/02-variables-aggregates/array_method_policy.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_indexing_semantics
                        pipeline-array-indexing-semantics
                        tests/runtime/sessions/02-variables-aggregates/array_indexing_semantics.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_fixed_shape_array_assignment
                        pipeline-fixed-shape-array-assignment
                        tests/runtime/sessions/02-variables-aggregates/fixed_shape_array_assignment.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_borrow_summaries
                        pipeline-array-borrow-summaries
                        tests/runtime/sessions/02-variables-aggregates/array_borrow_summaries.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_view_lifetime_analysis
                        pipeline-array-view-lifetime-analysis
                        tests/runtime/sessions/02-variables-aggregates/array_view_lifetime_analysis.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_pointer_core
                        pipeline-pointer-core
                        tests/runtime/sessions/02-variables-aggregates/pointer_core.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_pointer_array_indexing
                        pipeline-pointer-array-indexing
                        tests/runtime/sessions/02-variables-aggregates/pointer_array_indexing.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_pointer_array_for_of_iteration
                        pipeline-pointer-array-for-of-iteration
                        tests/runtime/sessions/02-variables-aggregates/pointer_array_for_of_iteration.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_pointer_addressable_projections
                        pipeline-pointer-addressable-projections
                        tests/runtime/sessions/02-variables-aggregates/pointer_addressable_projections.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_pointer_invalidation_diagnostics
                        pipeline-pointer-invalidation-diagnostics
                        tests/runtime/sessions/02-variables-aggregates/pointer_invalidation_diagnostics.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_dynamic_array_storage_analysis
                        pipeline-dynamic-array-storage-analysis
                        tests/runtime/sessions/02-variables-aggregates/dynamic_array_storage_analysis.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_dynamic_array_pointer_validity_tracking
                        pipeline-dynamic-array-pointer-validity-tracking
                        tests/runtime/sessions/02-variables-aggregates/dynamic_array_pointer_validity_tracking.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_spread
                        pipeline-array-spread
                        tests/runtime/sessions/02-variables-aggregates/array_spread.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_destructuring
                        pipeline-array-destructuring
                        tests/runtime/sessions/02-variables-aggregates/array_destructuring.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_native_abi_policy
                        pipeline-array-native-abi-policy
                        tests/runtime/sessions/02-variables-aggregates/array_native_abi_policy.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_print_collections
                        pipeline-print-collections
                        tests/runtime/sessions/02-variables-aggregates/print_collections.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_copy_splice_methods
                        pipeline-array-copy-splice-methods
                        tests/runtime/sessions/02-variables-aggregates/array_copy_splice_methods.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_with_range
                        pipeline-array-with-range
                        tests/runtime/sessions/02-variables-aggregates/array_with_range.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_named_callbacks
                        pipeline-array-named-callbacks
                        tests/runtime/sessions/02-variables-aggregates/array_named_callbacks.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_inline_callbacks
                        pipeline-array-inline-callbacks
                        tests/runtime/sessions/02-variables-aggregates/array_inline_callbacks.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_callback_captures
                        pipeline-array-callback-captures
                        tests/runtime/sessions/02-variables-aggregates/array_callback_captures.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_callback_ownership_borrow
                        pipeline-array-callback-ownership-borrow
                        tests/runtime/sessions/02-variables-aggregates/array_callback_ownership_borrow.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_nested_dynamic_array_pointer_chains
                        pipeline-nested-dynamic-array-pointer-chains
                        tests/runtime/sessions/02-variables-aggregates/nested_dynamic_array_pointer_chains.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_array_persistent_closure_captures
                        pipeline-array-persistent-closure-captures
                        tests/runtime/sessions/02-variables-aggregates/array_persistent_closure_captures.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_string_operators
                        pipeline-string-operators
                        tests/runtime/sessions/02-variables-aggregates/string_operators.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_string_methods
                        pipeline-string-methods
                        tests/runtime/sessions/02-variables-aggregates/string_methods.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_string_extended_methods
                        pipeline-string-extended-methods
                        tests/runtime/sessions/02-variables-aggregates/string_extended_methods.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_string_lifetime
                        pipeline-string-lifetime
                        tests/runtime/sessions/03-memory-management/string_lifetime.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_escape_analysis
                        pipeline-escape-analysis
                        tests/runtime/sessions/03-memory-management/escape_analysis.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_function_ownership
                        pipeline-function-ownership
                        tests/runtime/sessions/03-memory-management/function_ownership.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_aggregate_assignment_ownership
                        pipeline-aggregate-assignment-ownership
                        tests/runtime/sessions/03-memory-management/aggregate_assignment_ownership.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_destructor_scheduling
                        pipeline-destructor-scheduling
                        tests/runtime/sessions/03-memory-management/destructor_scheduling.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_move_state_validation
                        pipeline-move-state-validation
                        tests/runtime/sessions/03-memory-management/move_state_validation.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_loops_and_methods
                        pipeline-loops-and-methods
                        tests/runtime/sessions/04-control-flow/loops_and_methods.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_iterator_protocol
                        pipeline-iterator-protocol
                        tests/runtime/sessions/04-control-flow/iterator_protocol.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_dynamic_array_iteration_mutation
                        pipeline-dynamic-array-iteration-mutation
                        tests/runtime/sessions/04-control-flow/dynamic_array_iteration_mutation.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_switch
                        pipeline-switch
                        tests/runtime/sessions/04-control-flow/switch.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_switch_ownership
                        pipeline-switch-ownership
                        tests/runtime/sessions/04-control-flow/switch_ownership.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_switch_definite_assignment
                        pipeline-switch-definite-assignment
                        tests/runtime/sessions/04-control-flow/switch_definite_assignment.cmake
                )

                add_yogi_pipeline_test(
                        yogi_pipeline_break
                        pipeline-break
                        tests/runtime/sessions/04-control-flow/break.cmake
                )

                add_yogi_pipeline_test(
                        yogi_package_manager_init_build_run
                        package-manager-init-build-run
                        tests/package-manager/init_build_run.cmake
                )

                add_yogi_program_test(
                        yogi_program_inventory_manager
                        program-inventory-manager
                        tests/programs/inventory_manager.cmake
                )

                add_yogi_program_test(
                        yogi_program_tagged_user_cleanup
                        program-tagged-user-cleanup
                        tests/programs/tagged_user_cleanup.cmake
                )

                add_yogi_program_test(
                        yogi_program_player_scoreboard
                        program-player-scoreboard
                        tests/programs/player_scoreboard.cmake
                )

                add_yogi_program_test(
                        yogi_program_matrix_report
                        program-matrix-report
                        tests/programs/matrix_report.cmake
                )

                add_yogi_program_test(
                        yogi_program_sales_destructuring_report
                        program-sales-destructuring-report
                        tests/programs/sales_destructuring_report.cmake
                )

                add_yogi_program_test(
                        yogi_program_array_storage_policy_report
                        program-array-storage-policy-report
                        tests/programs/array_storage_policy_report.cmake
                )

                add_yogi_program_test(
                        yogi_program_native_signal_processor
                        program-native-signal-processor
                        tests/programs/native_signal_processor.cmake
                )
        endif()
endif()

# ============================================================
#                  PORTABLE PREVIEW INSTALL
# ============================================================
install(TARGETS ${PROJECT_NAME}
        RUNTIME DESTINATION bin
)

if(TARGET yogi_runtime)
        install(TARGETS yogi_runtime
                RUNTIME DESTINATION bin
                LIBRARY DESTINATION lib
                ARCHIVE DESTINATION lib
        )
endif()

if(DEFINED YOGI_RUNTIME_ALLOCATOR_TARGET AND TARGET ${YOGI_RUNTIME_ALLOCATOR_TARGET})
        install(TARGETS ${YOGI_RUNTIME_ALLOCATOR_TARGET}
                RUNTIME DESTINATION bin
                LIBRARY DESTINATION lib
                ARCHIVE DESTINATION lib
        )
endif()

if(EXISTS "${CMAKE_SOURCE_DIR}/src/compiler/bin")
        install(DIRECTORY "${CMAKE_SOURCE_DIR}/src/compiler/bin/"
                DESTINATION parsers
                USE_SOURCE_PERMISSIONS
        )
endif()

if(YOGI_LLD_EXECUTABLE)
        install(PROGRAMS "${YOGI_LLD_EXECUTABLE}"
                DESTINATION bin/tools
        )
endif()

if(YOGI_LD64_LLD_EXECUTABLE)
        install(PROGRAMS "${YOGI_LD64_LLD_EXECUTABLE}"
                DESTINATION bin/tools
        )
endif()

if(EXISTS "${CMAKE_SOURCE_DIR}/examples")
        install(DIRECTORY "${CMAKE_SOURCE_DIR}/examples/"
                DESTINATION examples
                FILES_MATCHING
                        PATTERN "*.yogi"
                        PATTERN "*.io"
        )
endif()

if(EXISTS "${CMAKE_SOURCE_DIR}/docs")
        install(DIRECTORY "${CMAKE_SOURCE_DIR}/docs/"
                DESTINATION docs
        )
endif()

if(EXISTS "${CMAKE_SOURCE_DIR}/README.md")
        install(FILES "${CMAKE_SOURCE_DIR}/README.md"
                DESTINATION .
        )
endif()

if(EXISTS "${CMAKE_SOURCE_DIR}/yogi.json")
        install(FILES "${CMAKE_SOURCE_DIR}/yogi.json"
                DESTINATION .
        )
endif()

if(EXISTS "${CMAKE_SOURCE_DIR}/yogi.lock")
        install(FILES "${CMAKE_SOURCE_DIR}/yogi.lock"
                DESTINATION .
        )
endif()
