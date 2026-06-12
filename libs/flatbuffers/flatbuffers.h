//
// Created by Brayhan De Aza on 12 Jun 2026.
//

#pragma once

#include <cstdint>
#include <fstream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <vector>

#include <flatbuffers/flatbuffers.h>

#include "main_generated.h"

namespace yogi::libs::fbs {

	class FlatBuffers {
		public:
			static std::vector<std::uint8_t> read_file(const std::string &path) {
				std::ifstream file(path, std::ios::binary);

				if (!file) {
					throw std::runtime_error("failed to open flatbuffer file: " + path);
				}

				return std::vector<std::uint8_t>(
					std::istreambuf_iterator<char>(file),
					std::istreambuf_iterator<char>()
				);
			}

			static const Yogi::Sir::Module *read_sir_module(
				const std::vector<std::uint8_t> &buffer
			) {
				if (buffer.empty()) {
					throw std::runtime_error("empty SIR flatbuffer");
				}

				const auto *module = flatbuffers::GetRoot<Yogi::Sir::Module>(buffer.data());

				flatbuffers::Verifier verifier(buffer.data(), buffer.size());

				if (!module->Verify(verifier)) {
					throw std::runtime_error("invalid SIR flatbuffer");
				}

				return module;
			}

			static const Yogi::Sir::Module *read_sir_module_from_file(
				const std::string &path,
				std::vector<std::uint8_t> &storage
			) {
				storage = read_file(path);
				return read_sir_module(storage);
			}

			static const Yogi::Build::Meta *read_build_meta(
				const std::vector<std::uint8_t> &buffer
			) {
				if (buffer.empty()) {
					throw std::runtime_error("empty build meta flatbuffer");
				}

				const auto *meta = flatbuffers::GetRoot<Yogi::Build::Meta>(buffer.data());

				flatbuffers::Verifier verifier(buffer.data(), buffer.size());

				if (!meta->Verify(verifier)) {
					throw std::runtime_error("invalid build meta flatbuffer");
				}

				return meta;
			}

			static const Yogi::Build::Meta *read_build_meta_unsafe(
				const std::vector<std::uint8_t> &buffer
			) {
				if (buffer.empty()) {
					throw std::runtime_error("empty build meta flatbuffer");
				}

				return flatbuffers::GetRoot<Yogi::Build::Meta>(buffer.data());
			}

			static const Yogi::Build::Meta *read_build_meta_from_file(
				const std::string &path,
				std::vector<std::uint8_t> &storage
			) {
				storage = read_file(path);
				return read_build_meta(storage);
			}

			static const Yogi::Build::Meta *read_build_meta_from_file_unsafe(
				const std::string &path,
				std::vector<std::uint8_t> &storage
			) {
				storage = read_file(path);
				return read_build_meta_unsafe(storage);
			}
	};

} // namespace yogi::libs::fbs