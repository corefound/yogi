// Created by Brayhan De Aza on 6/15/26.
//

#include <filesystem>
#include <iostream>
#include <string>
#include <vector>

#include <json.hpp>

#include "compilerDriver.h"
#include "core.h"
#include "libs/flatbuffers/flatbuffers.h"
#include "llvm/driver/lowerer.h"
#include "llvm/linking/linker.h"

namespace yogi::core {

int runCompiler(const std::vector<std::string> &args) {
	if (args.empty()) {
		std::cerr << "Usage: yogi <input-file>" << std::endl;
		return 1;
	}

	return runCompiler(args.front());
}

int runCompiler(const std::string &inputFile) {
	if (inputFile.empty()) {
		std::cerr << "Usage: yogi <input-file>" << std::endl;
		return 1;
	}

	const auto inputPath = std::filesystem::path(inputFile);

	if (!std::filesystem::exists(inputPath)) {
		std::cerr << "Error: Could not open file " << inputFile << std::endl;
		return 1;
	}

	const std::string program = "yogi";
	const std::string source = inputPath.string();
	const char *argv[] = {
		program.c_str(),
		source.c_str(),
	};
	const yogi::core::Core core(2, argv);
	std::vector<std::uint8_t> storage;
	const std::string path = core.ast.value("globalMetaPath", "");

	if (path.empty()) {
		std::cerr << "Error: TypeScript compiler did not return a globalMetaPath." << std::endl;
		return 1;
	}

	const auto *buildMeta = yogi::libs::fbs::FlatBuffers::read_build_meta_from_file(path, storage);
	std::vector<std::string> moduleInitializers;
	std::vector<std::string> moduleCleanups;

	for (const auto *moduleMeta: *buildMeta->modules()) {
		if (moduleMeta->should_lower()) {
			moduleInitializers.push_back(
				yogi::core::llvm::Lowerer::moduleInitializerName(moduleMeta)
			);
			moduleCleanups.push_back(
				yogi::core::llvm::Lowerer::moduleCleanupName(moduleMeta)
			);
		}
	}

	for (const auto *moduleMeta: *buildMeta->modules()) {
		if (!moduleMeta->should_lower()) {
			continue;
		}

		std::vector<std::uint8_t> sirStorage;
		const auto sirPath = (
			std::filesystem::path(moduleMeta->root_path()->str()) /
			std::filesystem::path(moduleMeta->sir_path()->str())
		).string();
		const auto *sirModule = yogi::libs::fbs::FlatBuffers::read_sir_module_from_file(sirPath, sirStorage);

		if (!yogi::core::llvm::Lowerer::lowerModuleToObject(
			moduleMeta,
			sirModule,
			moduleInitializers,
			moduleCleanups
		)) {
			std::cerr << "Error: failed to lower module " << moduleMeta->name()->str() << std::endl;
			return 1;
		}
	}

	if (!yogi::core::llvm::Linker::linkBuildOutput(buildMeta)) {
		std::cerr << "Error: failed to link final executable." << std::endl;
		return 1;
	}

	return 0;
}

} // namespace yogi::core
