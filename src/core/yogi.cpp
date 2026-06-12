#include <iostream>
#include <string>
#include <json.hpp>
#include "core.h"
#include "libs/flatbuffers/flatbuffers.h"

int main(const int argc, const char *argv[]) {
	const yogi::core::Core core(argc, argv);

	// std::vector<std::uint8_t> storage;
	// const std::string path = "/Users/brayhandeaza/Documents/dev/projects/ts-bk/yogi/tests/packages/.cache/modules/main.io/sir.fb";
	// const auto *module = yogi::libs::fbs::FlatBuffers::read_sir_module_from_file(path, storage);
	//
	// for (const auto *node: *module->nodes()) {
	// 	switch (node->value_type()) {
	// 		case Yogi::Sir::SirNodeValue_Constant: {
	// 			const auto *constant = node->value_as_Constant();
	// 			std::cout << "raw: " << constant->raw()->str() << "\n";
	// 			std::cout << "source: " << constant->source()->str() << "\n";
	//
	// 			const auto *position = constant->position();
	// 			std::cout << "line: " << position->line() << "\n";
	// 			std::cout << "character: " << position->character() << "\n";
	//
	// 			break;
	// 		}
	//
	// 		default:
	// 			break;
	// 	}
	// }

	std::cout << core.ast.dump(1) << std::endl;
}