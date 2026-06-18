#pragma once

#include <string>
#include "diagnostics/logger.hpp"

namespace yogi::cli {

void installCommand(const std::string& root, diagnostics::Logger& logger);

} // namespace yogi::cli
