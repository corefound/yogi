#pragma once

#include "types.hpp"
#include "diagnostics/logger.hpp"
#include <string>

namespace yogi::publish {

PublishResult publishPackage(const std::string& root, diagnostics::Logger& logger);

} // namespace yogi::publish
