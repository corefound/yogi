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
    };
}