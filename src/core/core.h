//
// Created by Brayhan De Aza on 5/28/26.
//

#pragma once
#include <iostream>
#include <fstream>
#include "json.hpp"

namespace yogi::core {
	class Core final {
		public:
			nlohmann::json ast;

			explicit Core(const int argc, const char *argv[]) {
				if (argc < 2) {
					std::cerr << "Usage: " << argv[0] << " <input-file>" << std::endl;
					std::exit(1);
				}

				const std::string filePath = argv[1];
				if (const std::ifstream file(filePath); !file) {
					std::cerr << "Error: Could not open file " << filePath << std::endl;
					std::exit(1);
				}

				init(filePath);
			};

			void init(const std::string &filePath);
	};

}