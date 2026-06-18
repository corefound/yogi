#pragma once

#include <string>
#include <vector>
#include "diagnostics/logger.hpp"

namespace yogi::cli {

void runCommand(const std::string& root, diagnostics::Logger& logger, const std::vector<std::string>& passthroughArgs);

} // namespace yogi::cli
