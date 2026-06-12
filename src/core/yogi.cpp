#include <iostream>
#include <string>
#include <json.hpp>
#include "core.h"
#include "libs/flatbuffers/flatbuffers.h"

int main(const int argc, const char *argv[]) {
	const yogi::core::Core core(argc, argv);
	std::vector<std::uint8_t> storage;
	const std::string path = "/Users/brayhandeaza/Documents/dev/projects/ts-bk/yogi/tests/packages/.cache/meta.fb";
	const auto *module = yogi::libs::fbs::FlatBuffers::read_build_meta_from_file(path, storage);

	for (const auto *node: *module->modules()) {
		std::cout << "raw: " << node->name()->str() << "\n";
	}

	std::cout << core.ast.dump(1) << std::endl;
}