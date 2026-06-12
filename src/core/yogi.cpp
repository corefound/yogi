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
		std::cout << "sir_path: " << node->sir_path()->str() << "\n";
		std::cout << "ast_path: " << node->ast_path()->str() << "\n";
		std::cout << "object_path: " << node->object_path()->str() << "\n";
		std::cout << "source_path: " << node->source_path()->str() << "\n";
		std::cout << "source_hash: " << node->source_hash()->str() << "\n";
		std::cout << "ast_hash: " << node->ast_hash()->str() << "\n";
		std::cout << "sir_hash: " << node->sir_hash()->str() << "\n";
		std::cout << "is_entry: " << node->is_entry() << "\n";
		std::cout << "should_lower: " << node->should_lower() << "\n";
		std::cout << "root_path: " << node->root_path()->str() << "\n";
	}

	std::cout << core.ast.dump(1) << std::endl;
}