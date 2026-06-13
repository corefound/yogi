#include <filesystem>
#include <iostream>
#include <string>
#include <vector>

#include <json.hpp>

#include "core.h"
#include "libs/flatbuffers/flatbuffers.h"
#include "llvm/linker.h"
#include "llvm/lowerer.h"

int main(const int argc, const char *argv[]) {
	const yogi::core::Core core(argc, argv);
	std::vector<std::uint8_t> storage;
	const std::string path = core.ast.value("globalMetaPath", "");

	if (path.empty()) {
		std::cerr << "Error: TypeScript compiler did not return a globalMetaPath." << std::endl;
		return 1;
	}

	const auto *build_meta = yogi::libs::fbs::FlatBuffers::read_build_meta_from_file(path, storage);
	std::vector<std::string> module_initializers;

	for (const auto *module_meta: *build_meta->modules()) {
		if (module_meta->should_lower()) {
			module_initializers.push_back(
				yogi::core::llvm::Lowerer::module_initializer_name(module_meta)
			);
		}
	}

	for (const auto *module_meta: *build_meta->modules()) {
		if (!module_meta->should_lower()) {
			continue;
		}

		std::vector<std::uint8_t> sir_storage;
		const auto sir_path = (
			std::filesystem::path(module_meta->root_path()->str()) /
			std::filesystem::path(module_meta->sir_path()->str())
		).string();
		const auto *sir_module = yogi::libs::fbs::FlatBuffers::read_sir_module_from_file(sir_path, sir_storage);

		if (!yogi::core::llvm::Lowerer::lower_module_to_object(module_meta, sir_module, module_initializers)) {
			std::cerr << "Error: failed to lower module " << module_meta->name()->str() << std::endl;
			return 1;
		}
	}

	if (!yogi::core::llvm::Linker::link_build_output(build_meta)) {
		std::cerr << "Error: failed to link final executable." << std::endl;
		return 1;
	}

	return 0;
}
