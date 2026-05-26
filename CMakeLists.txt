cmake_minimum_required(VERSION 3.10)
project(yogi VERSION 0.0.1 LANGUAGES C CXX)

# ============================================================
#                  MACOS & LLVM SETUP
# ============================================================
set(CMAKE_OSX_DEPLOYMENT_TARGET "26.0")
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)



cmake_policy(SET CMP0075 NEW)
cmake_policy(SET CMP0074 NEW)

# ============================================================
#                  SOURCES
# ============================================================
file(GLOB_RECURSE PROD_SOURCES "${CMAKE_SOURCE_DIR}/src/*.cpp")

# ============================================================
#                       RUNTIME
# ============================================================
# add_subdirectory(runtime)

# ============================================================
#                     EXECUTABLE
# ============================================================
add_executable(${PROJECT_NAME}
        ${CMAKE_SOURCE_DIR}/src/yogi.cpp
        ${PROD_SOURCES}
)

# target_* calls must come AFTER add_executable
target_include_directories(
    ${PROJECT_NAME}
    PRIVATE
        ${CMAKE_SOURCE_DIR}
        ${SOURCES_COMPILER}
        ${LIBS_DIR}/uni-algo/include
        ${LIBS_DIR}
)

target_compile_definitions(yogi PUBLIC
        TS_PARSER="${CMAKE_SOURCE_DIR}/src/ts/ts-parser"
        TS_TESTS="${CMAKE_SOURCE_DIR}/src/ts/tests"
)


target_link_libraries(
    ${PROJECT_NAME}
    PRIVATE "${LIBS_DIR}/uni-algo/build/libuni-algo.a"
    # yogi_runtime
)
