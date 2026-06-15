// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/linking/linker.h"

#include <filesystem>
#include <iostream>
#include <sstream>
#include <string>
#include <unordered_set>
#include <vector>

#include "llvm/context/loweringContext.h"

#ifndef YOGI_LLD_PATH
#define YOGI_LLD_PATH ""
#endif

#ifndef YOGI_LD64_LLD_PATH
#define YOGI_LD64_LLD_PATH ""
#endif

#ifndef YOGI_MACOS_SDK_PATH
#define YOGI_MACOS_SDK_PATH ""
#endif

#ifndef YOGI_MACOS_DEPLOYMENT_TARGET
#define YOGI_MACOS_DEPLOYMENT_TARGET "11.0"
#endif

#ifndef YOGI_RUNTIME_LIBRARY_PATH
#define YOGI_RUNTIME_LIBRARY_PATH ""
#endif

namespace {
	std::string quoteArg(const std::string &value) {
		std::string quoted = "'";

		for (const char ch: value) {
			if (ch == '\'') {
				quoted += "'\\''";
			} else {
				quoted += ch;
			}
		}

		quoted += "'";
		return quoted;
	}

	std::string hostArch() {
		#if defined(__APPLE__) && (defined(__aarch64__) || defined(_M_ARM64))
		return "arm64";
		#elif defined(__APPLE__)
		return "x86_64";
		#else
		return "";
		#endif
	}

	bool runLldCommand(const std::string &command, const std::filesystem::path &outputPath) {
		const int exitCode = std::system(command.c_str());

		if (exitCode != 0) {
			std::cerr << "failed to link executable with LLD: " << outputPath << "\n";
			return false;
		}

		return true;
	}

	std::filesystem::path resolveLinkPath(
		const std::filesystem::path &rootPath,
		const flatbuffers::String *path
	) {
		const auto rawPath = yogi::core::llvm::internal::fbString(path);
		const auto linkPath = std::filesystem::path(rawPath);

		return linkPath.is_absolute()
				? linkPath
				: rootPath / linkPath;
	}
}

namespace yogi::core::llvm {

	bool Linker::linkBuildOutput(const Yogi::Build::Meta *buildMeta) {
		#if YOGI_HAS_LLVM
		if (!buildMeta || !buildMeta->modules()) {
			return false;
		}

		const auto rootPath = std::filesystem::path(internal::fbString(buildMeta->root_path()));
		auto outputPath = internal::fbString(buildMeta->output_path());

		if (outputPath.empty()) {
			outputPath = (std::filesystem::path(internal::fbString(buildMeta->cache_path())) / "yogi.out").string();
		}

		const auto absoluteOutputPath = rootPath / std::filesystem::path(outputPath);
		std::vector<std::filesystem::path> objects;
		std::vector<std::filesystem::path> externalLinks;
		std::unordered_set<std::string> seenPaths;
		int entryModuleCount = 0;
		const auto appendLinkPath = [&](
			const std::filesystem::path &linkPath,
			const std::string &label,
			bool mustExist
		) -> bool {
			const auto pathKey = linkPath.string();

			if (seenPaths.contains(pathKey)) {
				return true;
			}

			seenPaths.insert(pathKey);

			if (mustExist && !std::filesystem::exists(linkPath)) {
				std::cerr << "cannot link missing " << label << ": " << linkPath << "\n";
				return false;
			}

			externalLinks.push_back(linkPath);
			return true;
		};

		for (const auto *module: *buildMeta->modules()) {
			if (!module->should_lower()) {
				continue;
			}

			if (module->is_entry()) {
				entryModuleCount++;
			}

			const auto objectPath =
					std::filesystem::path(internal::fbString(module->root_path())) /
					std::filesystem::path(internal::fbString(module->object_path()));

			if (!std::filesystem::exists(objectPath)) {
				std::cerr << "cannot link missing object file: " << objectPath << "\n";
				return false;
			}

			objects.push_back(objectPath);
		}

		if (entryModuleCount != 1) {
			std::cerr << "expected exactly one entry module, found " << entryModuleCount << "\n";
			return false;
		}

		if (objects.empty()) {
			std::cerr << "no object files were produced; skipping executable link\n";
			return false;
		}

		if (buildMeta->links()) {
			for (const auto *link: *buildMeta->links()) {
				const auto linkPath = resolveLinkPath(rootPath, link->path());
				if (!appendLinkPath(
					linkPath,
					"external library",
					link->kind() != Yogi::Build::LinkKind_system_library
				)) {
					return false;
				}
			}
		}

		const std::filesystem::path runtimeLibraryPath = YOGI_RUNTIME_LIBRARY_PATH;

		if (!runtimeLibraryPath.empty() && !appendLinkPath(runtimeLibraryPath, "runtime library", true)) {
			return false;
		}

		std::filesystem::create_directories(absoluteOutputPath.parent_path());

		std::ostringstream command;

		#if defined(__APPLE__)
		const std::string lldPath = YOGI_LD64_LLD_PATH;

		if (lldPath.empty()) {
			std::cerr << "ld64.lld was not found in the configured LLVM toolchain\n";
			return false;
		}

		command << quoteArg(lldPath)
				<< " -arch " << hostArch()
				<< " -platform_version macos "
				<< quoteArg(YOGI_MACOS_DEPLOYMENT_TARGET)
				<< " " << quoteArg(YOGI_MACOS_DEPLOYMENT_TARGET);

		const std::string sdkPath = YOGI_MACOS_SDK_PATH;

		if (!sdkPath.empty()) {
			command << " -syslibroot " << quoteArg(sdkPath);
		}

		command << " -lSystem";
		#else
		const std::string lldPath = YOGI_LLD_PATH;

		if (lldPath.empty()) {
			std::cerr << "ld.lld was not found in the configured LLVM toolchain\n";
			return false;
		}

		command << quoteArg(lldPath);
		#endif

		for (const auto &object: objects) {
			command << " " << quoteArg(object.string());
		}

		for (const auto &link: externalLinks) {
			command << " " << quoteArg(link.string());
		}

		command << " -o " << quoteArg(absoluteOutputPath.string());

		return runLldCommand(command.str(), absoluteOutputPath);
		#else
		(void) buildMeta;
		std::cerr << "LLVM support is disabled; skipping executable link\n";
		return false;
		#endif
	}

} // namespace yogi::core::llvm