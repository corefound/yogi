cmake_minimum_required(VERSION 3.10)
project(yogi_runtime LANGUAGES C CXX)

set(YOGI_RUNTIME_ALLOCATOR "mimalloc" CACHE STRING "Runtime allocator: mimalloc, jemalloc, or system")
set_property(CACHE YOGI_RUNTIME_ALLOCATOR PROPERTY STRINGS mimalloc jemalloc system)

file(GLOB_RECURSE YOGI_RUNTIME_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp")

add_library(${PROJECT_NAME} STATIC ${YOGI_RUNTIME_SOURCES})

target_include_directories(${PROJECT_NAME} PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/includes
)

if(YOGI_RUNTIME_ALLOCATOR STREQUAL "mimalloc")
        target_compile_definitions(${PROJECT_NAME} PRIVATE YOGI_USE_MIMALLOC=1)
elseif(YOGI_RUNTIME_ALLOCATOR STREQUAL "jemalloc")
        target_compile_definitions(${PROJECT_NAME} PRIVATE YOGI_USE_JEMALLOC=1)
endif()

message(STATUS "Runtime include: ${CMAKE_CURRENT_SOURCE_DIR}/includes")
