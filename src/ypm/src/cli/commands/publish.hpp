#pragma once

#include "diagnostics/logger.hpp"

namespace yogi::cli {

void publishCommand(const std::string& root, diagnostics::Logger& logger);

} // namespace yogi::cli