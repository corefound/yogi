cmake_minimum_required(VERSION 3.10)
project(yogi_runtime LANGUAGES C CXX)

set(YOGI_ALLOCATOR "mimalloc" CACHE STRING "Runtime allocator: mimalloc, jemalloc, or system")
set_property(CACHE YOGI_ALLOCATOR PROPERTY STRINGS mimalloc jemalloc system)
option(YOGI_RUNTIME_DEBUG_OWNERSHIP "Enable runtime ownership debug checks" ON)

if(NOT YOGI_ALLOCATOR MATCHES "^(mimalloc|jemalloc|system)$")
        message(FATAL_ERROR
                "Unsupported YOGI_ALLOCATOR='${YOGI_ALLOCATOR}'. "
                "Use mimalloc, jemalloc, or system."
        )
endif()

file(GLOB_RECURSE YOGI_RUNTIME_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp")

add_library(${PROJECT_NAME} STATIC ${YOGI_RUNTIME_SOURCES})

target_include_directories(${PROJECT_NAME} PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/includes
)

set(YOGI_RUNTIME_ALLOCATOR_TARGET "" PARENT_SCOPE)

if(YOGI_ALLOCATOR STREQUAL "mimalloc")
        if(CMAKE_VERSION VERSION_LESS "3.18")
                message(FATAL_ERROR
                        "YOGI_ALLOCATOR=mimalloc requires CMake 3.18 or newer because "
                        "tools/mimalloc declares that minimum version."
                )
        endif()

        set(YOGI_MIMALLOC_SOURCE_DIR "${CMAKE_SOURCE_DIR}/tools/mimalloc")

        if(NOT EXISTS "${YOGI_MIMALLOC_SOURCE_DIR}/CMakeLists.txt")
                message(FATAL_ERROR
                        "YOGI_ALLOCATOR=mimalloc was selected, but tools/mimalloc was not found. "
                        "Initialize the tools/mimalloc submodule or choose -DYOGI_ALLOCATOR=system."
                )
        endif()

        set(MI_OVERRIDE OFF CACHE BOOL "" FORCE)
        set(MI_OSX_INTERPOSE OFF CACHE BOOL "" FORCE)
        set(MI_OSX_ZONE OFF CACHE BOOL "" FORCE)
        set(MI_BUILD_SHARED OFF CACHE BOOL "" FORCE)
        set(MI_BUILD_STATIC ON CACHE BOOL "" FORCE)
        set(MI_BUILD_OBJECT OFF CACHE BOOL "" FORCE)
        set(MI_BUILD_TESTS OFF CACHE BOOL "" FORCE)

        add_subdirectory("${YOGI_MIMALLOC_SOURCE_DIR}" "${CMAKE_BINARY_DIR}/tools/mimalloc")

        if(NOT TARGET mimalloc-static)
                message(FATAL_ERROR
                        "YOGI_ALLOCATOR=mimalloc was selected, but tools/mimalloc did not "
                        "create the expected mimalloc-static target."
                )
        endif()

        target_compile_definitions(${PROJECT_NAME} PRIVATE YOGI_USE_MIMALLOC=1)
        target_link_libraries(${PROJECT_NAME} PUBLIC mimalloc-static)
        set(YOGI_RUNTIME_ALLOCATOR_TARGET "mimalloc-static" PARENT_SCOPE)
elseif(YOGI_ALLOCATOR STREQUAL "jemalloc")
        include(ExternalProject)

        set(YOGI_JEMALLOC_SOURCE_DIR "${CMAKE_SOURCE_DIR}/tools/jemalloc")
        set(YOGI_JEMALLOC_BUILD_ROOT "${CMAKE_BINARY_DIR}/tools/jemalloc")
        set(YOGI_JEMALLOC_WORK_SOURCE_DIR "${YOGI_JEMALLOC_BUILD_ROOT}/src")
        set(YOGI_JEMALLOC_INSTALL_DIR "${YOGI_JEMALLOC_BUILD_ROOT}/install")
        set(YOGI_JEMALLOC_LIBRARY "${YOGI_JEMALLOC_INSTALL_DIR}/lib/libjemalloc.a")

        if(NOT EXISTS "${YOGI_JEMALLOC_SOURCE_DIR}/autogen.sh")
                message(FATAL_ERROR
                        "YOGI_ALLOCATOR=jemalloc was selected, but tools/jemalloc was not found. "
                        "Initialize the tools/jemalloc submodule or choose -DYOGI_ALLOCATOR=system."
                )
        endif()

        find_program(YOGI_JEMALLOC_AUTOCONF_EXECUTABLE autoconf)
        if(NOT YOGI_JEMALLOC_AUTOCONF_EXECUTABLE)
                message(FATAL_ERROR
                        "YOGI_ALLOCATOR=jemalloc requires autoconf to build tools/jemalloc."
                )
        endif()

        find_program(YOGI_JEMALLOC_MAKE_EXECUTABLE NAMES gmake make)
        if(NOT YOGI_JEMALLOC_MAKE_EXECUTABLE)
                message(FATAL_ERROR
                        "YOGI_ALLOCATOR=jemalloc requires make or gmake to build tools/jemalloc."
                )
        endif()

        file(MAKE_DIRECTORY "${YOGI_JEMALLOC_INSTALL_DIR}/include")
        file(MAKE_DIRECTORY "${YOGI_JEMALLOC_WORK_SOURCE_DIR}")

        ExternalProject_Add(yogi_jemalloc_project
                PREFIX "${YOGI_JEMALLOC_BUILD_ROOT}"
                SOURCE_DIR "${YOGI_JEMALLOC_WORK_SOURCE_DIR}"
                DOWNLOAD_COMMAND
                        "${CMAKE_COMMAND}" -E copy_directory
                                "${YOGI_JEMALLOC_SOURCE_DIR}"
                                "${YOGI_JEMALLOC_WORK_SOURCE_DIR}"
                CONFIGURE_COMMAND
                        "${CMAKE_COMMAND}" -E chdir "${YOGI_JEMALLOC_WORK_SOURCE_DIR}"
                                ./autogen.sh
                                --prefix=${YOGI_JEMALLOC_INSTALL_DIR}
                                --disable-shared
                                --enable-static
                BUILD_COMMAND
                        "${CMAKE_COMMAND}" -E chdir "${YOGI_JEMALLOC_WORK_SOURCE_DIR}"
                                "${YOGI_JEMALLOC_MAKE_EXECUTABLE}"
                INSTALL_COMMAND
                        "${CMAKE_COMMAND}" -E chdir "${YOGI_JEMALLOC_WORK_SOURCE_DIR}"
                                "${YOGI_JEMALLOC_MAKE_EXECUTABLE}" install
                BUILD_BYPRODUCTS "${YOGI_JEMALLOC_LIBRARY}"
        )

        add_library(yogi_jemalloc STATIC IMPORTED GLOBAL)
        set_target_properties(yogi_jemalloc PROPERTIES
                IMPORTED_LOCATION "${YOGI_JEMALLOC_LIBRARY}"
                INTERFACE_INCLUDE_DIRECTORIES "${YOGI_JEMALLOC_INSTALL_DIR}/include"
        )
        add_dependencies(yogi_jemalloc yogi_jemalloc_project)

        target_compile_definitions(${PROJECT_NAME} PRIVATE YOGI_USE_JEMALLOC=1)
        target_link_libraries(${PROJECT_NAME} PUBLIC yogi_jemalloc)
        set(YOGI_RUNTIME_ALLOCATOR_TARGET "yogi_jemalloc" PARENT_SCOPE)
else()
        target_compile_definitions(${PROJECT_NAME} PRIVATE YOGI_USE_SYSTEM_ALLOCATOR=1)
endif()

if(YOGI_RUNTIME_DEBUG_OWNERSHIP)
        target_compile_definitions(${PROJECT_NAME} PUBLIC YOGI_RUNTIME_DEBUG_OWNERSHIP=1)
endif()

message(STATUS "Runtime include: ${CMAKE_CURRENT_SOURCE_DIR}/includes")
message(STATUS "Runtime allocator: ${YOGI_ALLOCATOR}")
