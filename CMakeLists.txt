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
set(LLVM_ROOT "${LIBS_DIR}/llvm-project/build/llvm-custom" CACHE PATH "Path to a custom LLVM installation")
set(YOGI_ENABLE_LLVM "AUTO" CACHE STRING "Enable LLVM support: AUTO, ON, or OFF")
set_property(CACHE YOGI_ENABLE_LLVM PROPERTY STRINGS AUTO ON OFF)

cmake_policy(SET CMP0075 NEW)
cmake_policy(SET CMP0074 NEW)

# ============================================================
#                       LLVM
# ============================================================
set(YOGI_LLVM_ENABLED OFF)
set(llvm_libs "")

if(NOT YOGI_ENABLE_LLVM STREQUAL "OFF")
        if(EXISTS "${LLVM_ROOT}/lib/cmake/llvm/LLVMConfig.cmake")
                list(APPEND CMAKE_PREFIX_PATH "${LLVM_ROOT}")

                find_package(LLVM QUIET CONFIG
                        PATHS "${LLVM_ROOT}/lib/cmake/llvm"
                        NO_DEFAULT_PATH
                )
        else()
                find_package(LLVM QUIET CONFIG)
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
        elseif(YOGI_ENABLE_LLVM STREQUAL "ON")
                message(FATAL_ERROR "YOGI_ENABLE_LLVM is ON, but LLVM was not found. Set LLVM_ROOT or CMAKE_PREFIX_PATH.")
        else()
                message(STATUS "LLVM not found; building without LLVM support")
        endif()
endif()

# ============================================================
#                  SOURCES
# ============================================================
file(GLOB_RECURSE PROD_SOURCES "${CMAKE_SOURCE_DIR}/src/*.cpp")
file(GLOB_RECURSE LLVM_SOURCE_FILES "${CMAKE_SOURCE_DIR}/src/core/llvm/*.cpp")

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

target_link_libraries(
    ${PROJECT_NAME}
)
