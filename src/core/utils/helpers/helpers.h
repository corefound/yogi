//
// Created by Brayhan De Aza on 5/28/26.
//

#pragma once

#include <iostream>
#include <stdexcept>
#include <array>


namespace yogi::core::utils::helpers {

	class Helpers {
		public:
			static std::string runCommand(const std::string &command) {
				FILE *pipe = popen(command.c_str(), "r");
				std::array<char, 4096> buffer{};
				std::string result;

				if (!pipe) {
					throw std::runtime_error("Failed to start process");
				}

				while (fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
					result.append(buffer.data());
				}

				pclose(pipe);
				return result;
			}

			static std::string getTSParserBinaryName() {
				#if defined(_WIN32)
				return "ts-parser-win-x64.exe";

				#elif defined(__APPLE__)
				#if defined(__aarch64__) || defined(_M_ARM64)
				return "ts-parser-macos-arm64";
				#else
				return "ts-parser-macos-x64";
				#endif

				#elif defined(__linux__)
				return "ts-parser-linux-x64";

				#else
				static_assert(false, "Unsupported platform");
				#endif
			}
	};
}