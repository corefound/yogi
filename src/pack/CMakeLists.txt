cmake_minimum_required(VERSION 3.16)
project(yogi-pkg VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -Wpedantic")
set(CMAKE_BUILD_TYPE Release)

include_directories(include src)

file(GLOB_RECURSE SOURCES "src/*.cpp")

add_executable(yogi ${SOURCES})

target_include_directories(yogi PRIVATE include src)

install(TARGETS yogi DESTINATION bin)
