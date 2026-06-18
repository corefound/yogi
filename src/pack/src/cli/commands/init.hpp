#pragma once

#include <string>
#include "diagnostics/logger.hpp"

namespace yogi::cli {

void initCommand(const std::string& root, diagnostics::Logger& logger, bool yes = false);

} // namespace yogi::cli
