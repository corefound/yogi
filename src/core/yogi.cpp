#include <iostream>
#include <filesystem>
#include <string>
#include <vector>
#include <json.hpp>
#include "core.h"
#include "libs/flatbuffers/flatbuffers.h"

int main(const int argc, const char *argv[]) {
	const yogi::core::Core core(argc, argv);
	std::vector<std::uint8_t> storage;
	const std::string path = "/Users/brayhandeaza/Documents/dev/projects/ts-bk/yogi/tests/packages/.cache/meta.fb";
	const auto *build_meta = yogi::libs::fbs::FlatBuffers::read_build_meta_from_file(path, storage);

	for (const auto *node: *build_meta->modules()) {
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

		std::vector<std::uint8_t> sir_storage;
		const auto sir_path = (
			std::filesystem::path(node->root_path()->str()) /
			std::filesystem::path(node->sir_path()->str())
		).string();
		const auto *sir_module = yogi::libs::fbs::FlatBuffers::read_sir_module_from_file(sir_path, sir_storage);

		if (sir_module->nodes()) {
			for (const auto *sir_node: *sir_module->nodes()) {
				if (const auto *extern_declaration = sir_node->value_as_ExternDeclaration()) {
					std::cout << "extern: " << extern_declaration->name()->str()
						<< " from " << extern_declaration->path()->str() << "\n";

					if (extern_declaration->functions()) {
						for (const auto *function: *extern_declaration->functions()) {
							std::cout << "  fn " << function->name()->str() << "(";

							if (function->parameters()) {
								bool first = true;

								for (const auto *parameter: *function->parameters()) {
									if (!first) {
										std::cout << ", ";
									}

									first = false;
									std::cout << parameter->name()->str()
										<< ": " << parameter->type()->raw()->str();
								}
							}

							std::cout << "): " << function->return_type()->raw()->str() << "\n";
						}
					}

					if (extern_declaration->variables()) {
						for (const auto *variable: *extern_declaration->variables()) {
							std::cout << "  var " << variable->name()->str()
								<< ": " << variable->type()->raw()->str() << "\n";
						}
					}
				}
			}
		}
	}

	std::cout << core.ast.dump(1) << std::endl;
}
