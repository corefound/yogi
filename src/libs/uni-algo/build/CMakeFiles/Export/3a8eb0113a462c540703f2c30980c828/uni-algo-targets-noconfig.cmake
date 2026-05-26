#----------------------------------------------------------------
# Generated CMake target import file.
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "uni-algo::uni-algo" for configuration ""
set_property(TARGET uni-algo::uni-algo APPEND PROPERTY IMPORTED_CONFIGURATIONS NOCONFIG)
set_target_properties(uni-algo::uni-algo PROPERTIES
  IMPORTED_LINK_INTERFACE_LANGUAGES_NOCONFIG "CXX"
  IMPORTED_LOCATION_NOCONFIG "${_IMPORT_PREFIX}/lib/libuni-algo.a"
  )

list(APPEND _cmake_import_check_targets uni-algo::uni-algo )
list(APPEND _cmake_import_check_files_for_uni-algo::uni-algo "${_IMPORT_PREFIX}/lib/libuni-algo.a" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
