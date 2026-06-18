#pragma once

#include <string>
#include "types.hpp"

namespace yogi::lockfile {

void writeYogiLog(const std::string& path, const Lockfile& lockfile);

} // namespace yogi::lockfile
