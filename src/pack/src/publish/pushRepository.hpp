#pragma once

#include "diagnostics/logger.hpp"
#include <string>

namespace yogi::publish {

std::string pushProjectToGitHub(const std::string& root,
                                const std::string& owner,
                                const std::string& repoName,
                                const std::string& version,
                                const std::string& accessToken,
                                diagnostics::Logger& logger);

} // namespace yogi::publish
