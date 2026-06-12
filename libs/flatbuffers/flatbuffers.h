//
// Created by Brayhan De Aza on 12 Jun 2026.
//

#pragma once

#include <fstream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <vector>

#include <flatbuffers/flatbuffers.h>
#include "fbs_generated.h"

namespace yogi::libs::fbs {
	class FlatBuffers {
		public:
			static std::vector<std::uint8_t> read_file(const std::string &path) {
				std::ifstream file(path, std::ios::binary);

				if (!file) {
					throw std::runtime_error("failed to open flatbuffer file: " + path);
				}

				return {std::istreambuf_iterator(file), std::istreambuf_iterator<char>()};
			}

			static const Yogi::Sir::Module *read_sir_module(const std::vector<std::uint8_t> &buffer) {
				if (flatbuffers::Verifier verifier(buffer.data(), buffer.size()); !verifier.VerifyBuffer<Yogi::Sir::Module>(nullptr)) {
					throw std::runtime_error("invalid SIR flatbuffer");
				}

				return ::flatbuffers::GetRoot<Yogi::Sir::Module>(buffer.data());
			}

			static const Yogi::Sir::Module *read_sir_module_from_file(const std::string &path, std::vector<std::uint8_t> &storage) {
				storage = read_file(path);
				return read_sir_module(storage);
			}
	};

} // namespace yogi::libs::fbs