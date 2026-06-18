#pragma once

#include <string>
#include "types.hpp"

namespace yogi::manifest {

Manifest readManifest(const std::string& path);

} // namespace yogi::manifest
