#pragma once

#include <string>
#include <optional>
#include "types.hpp"

namespace yogi::lockfile {

std::optional<Lockfile> readYogiLog(const std::string& path);

} // namespace yogi::lockfile
