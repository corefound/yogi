//
// Created by Brayhan De Aza on 6/18/26.
//

#pragma once

#include <string>
#include <vector>

namespace yogi::core {

int runCompiler(const std::string &inputFile);
int runCompiler(const std::vector<std::string> &args);

} // namespace yogi::core

