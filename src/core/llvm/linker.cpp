#include "linker.h"

#include <filesystem>
#include <iostream>
#include <sstream>
#include <string>
#include <unordered_set>
#include <vector>

#include "lowering_context.h"

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
	std::string quote_arg(const std::string &value) {
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

	std::string host_arch() {
		#if defined(__APPLE__) && (defined(__aarch64__) || defined(_M_ARM64))
		return "arm64";
		#elif defined(__APPLE__)
		return "x86_64";
		#else
		return "";
		#endif
	}

	bool run_lld_command(const std::string &command, const std::filesystem::path &output_path) {
		const int exit_code = std::system(command.c_str());

		if (exit_code != 0) {
			std::cerr << "failed to link executable with LLD: " << output_path << "\n";
			return false;
		}

		return true;
	}

	std::filesystem::path resolve_link_path(
		const std::filesystem::path &root_path,
		const flatbuffers::String *path
	) {
		const auto raw_path = yogi::core::llvm::internal::fb_string(path);
		const auto link_path = std::filesystem::path(raw_path);

		return link_path.is_absolute()
			? link_path
			: root_path / link_path;
	}
}

namespace yogi::core::llvm {

	bool Linker::link_build_output(const Yogi::Build::Meta *build_meta) {
		#if YOGI_HAS_LLVM
		if (!build_meta || !build_meta->modules()) {
			return false;
		}

		const auto root_path = std::filesystem::path(internal::fb_string(build_meta->root_path()));
		auto output_path = internal::fb_string(build_meta->output_path());

		if (output_path.empty()) {
			output_path = (std::filesystem::path(internal::fb_string(build_meta->cache_path())) / "yogi.out").string();
		}

		const auto absolute_output_path = root_path / std::filesystem::path(output_path);
		std::vector<std::filesystem::path> objects;
		std::vector<std::filesystem::path> external_links;
		std::unordered_set<std::string> seen_paths;
		int entry_module_count = 0;
		const auto append_link_path = [&](
			const std::filesystem::path &link_path,
			const std::string &label,
			bool must_exist
		) -> bool {
			const auto path_key = link_path.string();

			if (seen_paths.contains(path_key)) {
				return true;
			}

			seen_paths.insert(path_key);

			if (must_exist && !std::filesystem::exists(link_path)) {
				std::cerr << "cannot link missing " << label << ": " << link_path << "\n";
				return false;
			}

			external_links.push_back(link_path);
			return true;
		};

		for (const auto *module: *build_meta->modules()) {
			if (!module->should_lower()) {
				continue;
			}

			if (module->is_entry()) {
				entry_module_count++;
			}

			const auto object_path =
					std::filesystem::path(internal::fb_string(module->root_path())) /
					std::filesystem::path(internal::fb_string(module->object_path()));

			if (!std::filesystem::exists(object_path)) {
				std::cerr << "cannot link missing object file: " << object_path << "\n";
				return false;
			}

			objects.push_back(object_path);
		}

		if (entry_module_count != 1) {
			std::cerr << "expected exactly one entry module, found " << entry_module_count << "\n";
			return false;
		}

		if (objects.empty()) {
			std::cerr << "no object files were produced; skipping executable link\n";
			return false;
		}

		if (build_meta->links()) {
			for (const auto *link: *build_meta->links()) {
				const auto link_path = resolve_link_path(root_path, link->path());
				if (!append_link_path(
					link_path,
					"external library",
					link->kind() != Yogi::Build::LinkKind_system_library
				)) {
					return false;
				}
			}
		}

		const std::filesystem::path runtime_library_path = YOGI_RUNTIME_LIBRARY_PATH;

		if (!runtime_library_path.empty() && !append_link_path(runtime_library_path, "runtime library", true)) {
			return false;
		}

		std::filesystem::create_directories(absolute_output_path.parent_path());

		std::ostringstream command;

		#if defined(__APPLE__)
		const std::string lld_path = YOGI_LD64_LLD_PATH;

		if (lld_path.empty()) {
			std::cerr << "ld64.lld was not found in the configured LLVM toolchain\n";
			return false;
		}

		command << quote_arg(lld_path)
			<< " -arch " << host_arch()
			<< " -platform_version macos "
			<< quote_arg(YOGI_MACOS_DEPLOYMENT_TARGET)
			<< " " << quote_arg(YOGI_MACOS_DEPLOYMENT_TARGET);

		const std::string sdk_path = YOGI_MACOS_SDK_PATH;

		if (!sdk_path.empty()) {
			command << " -syslibroot " << quote_arg(sdk_path);
		}

		command << " -lSystem";
		#else
		const std::string lld_path = YOGI_LLD_PATH;

		if (lld_path.empty()) {
			std::cerr << "ld.lld was not found in the configured LLVM toolchain\n";
			return false;
		}

		command << quote_arg(lld_path);
		#endif

		for (const auto &object: objects) {
			command << " " << quote_arg(object.string());
		}

		for (const auto &link: external_links) {
			command << " " << quote_arg(link.string());
		}

		command << " -o " << quote_arg(absolute_output_path.string());

		return run_lld_command(command.str(), absolute_output_path);
		#else
		(void) build_meta;
		std::cerr << "LLVM support is disabled; skipping executable link\n";
		return false;
		#endif
	}

} // namespace yogi::core::llvm
