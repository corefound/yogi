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

cmake_policy(SET CMP0075 NEW)
cmake_policy(SET CMP0074 NEW)

# ============================================================
#                  SOURCES
# ============================================================
file(GLOB_RECURSE PROD_SOURCES "${CMAKE_SOURCE_DIR}/src/*.cpp")

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
        ${SOURCES_COMPILER}
        ${LIBS_DIR}
)

#src/compiler/bin/ts-parser-macos-arm64
target_compile_definitions(yogi PUBLIC
        TS_PARSERS="${CMAKE_SOURCE_DIR}/src/compiler/bin"
        TEST_PATH="${CMAKE_SOURCE_DIR}/tests/main.io"
)

target_link_libraries(
    ${PROJECT_NAME}
)
