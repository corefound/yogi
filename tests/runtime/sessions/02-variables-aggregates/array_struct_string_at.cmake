if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
interface Named {
    name: string
}

struct Playlist extends Named {
    aliases: string[]
    songs: string[]
}

struct Shelf {
    playlist: Playlist
}

function directStructFieldAt(): string {
    let playlist: Playlist = {
        name: "mix",
        aliases: ["daily"],
        songs: ["intro", "middle", "outro"]
    }

    let first: string = playlist.songs.at(0)
    let last: string = playlist.songs.at(-1)
    return first + ":" + last
}

function inheritedStructFieldAt(): string {
    let playlist: Playlist = {
        name: "mix",
        aliases: ["daily"],
        songs: ["intro", "outro"]
    }

    let alias: string = playlist.aliases.at(0)
    return playlist.name + ":" + alias
}

function nestedStructFieldAt(): string {
    let shelf: Shelf = {
        playlist: {
            name: "night",
            aliases: ["deep"],
            songs: ["first", "second", "third"]
        }
    }

    let song: string = shelf.playlist.songs.at(1)
    return song
}

function parameterStructFieldAt(value: Playlist): string {
    return value.songs.at(1) as string
}

let rootPlaylist: Playlist = {
    name: "param",
    aliases: ["root"],
    songs: ["hello", "world"]
}

print(directStructFieldAt())
print(inheritedStructFieldAt())
print(nestedStructFieldAt())
print(parameterStructFieldAt(rootPlaylist))
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "array struct string at compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected array struct string at artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		"%Playlist = type"
		"%Shelf = type"
		"yogi_array_at_index"
		"yogi_any_to_string")
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected array struct string at IR to contain ${symbol}")
	endif()
endforeach()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "array struct string at executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "intro:outro\nmix:daily\nsecond\nworld\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "array struct string at executable printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

function(expect_invalid case_name source expected)
	set(case_dir "${TEST_WORK_DIR}/${case_name}")
	file(MAKE_DIRECTORY "${case_dir}")
	set(source_file "${case_dir}/main.ts")
	file(WRITE "${source_file}" "${source}")

	execute_process(
		COMMAND "${YOGI_EXECUTABLE}" "${source_file}"
		WORKING_DIRECTORY "${case_dir}"
		RESULT_VARIABLE invalid_result
		OUTPUT_VARIABLE invalid_stdout
		ERROR_VARIABLE invalid_stderr
	)

	if(invalid_result EQUAL 0)
		message(FATAL_ERROR "${case_name} unexpectedly compiled\nstdout:\n${invalid_stdout}")
	endif()

	if(NOT invalid_stderr MATCHES "${expected}")
		message(FATAL_ERROR "${case_name} did not report ${expected}:\nstdout:\n${invalid_stdout}\nstderr:\n${invalid_stderr}")
	endif()
endfunction()

expect_invalid(
	out_of_range_struct_string_at
	"struct Playlist {\n    songs: string[]\n}\nlet playlist: Playlist = { songs: [\"only\"] }\nlet song: string = playlist.songs.at(2)\n"
	"can only initialize values of type"
)

expect_invalid(
	dynamic_index_struct_string_at
	"struct Playlist {\n    songs: string[]\n}\nlet playlist: Playlist = { songs: [\"only\"] }\nlet index: number = 0\nlet song: string = playlist.songs.at(index)\n"
	"can only initialize values of type"
)
