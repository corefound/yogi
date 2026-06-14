cmake_minimum_required(VERSION 3.10)
project(yogi_runtime LANGUAGES C CXX)

file(GLOB_RECURSE YOGI_RUNTIME_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp")

add_library(${PROJECT_NAME} STATIC ${YOGI_RUNTIME_SOURCES})

target_include_directories(${PROJECT_NAME} PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/includes
)

message(STATUS "Runtime include: ${CMAKE_CURRENT_SOURCE_DIR}/includes")
