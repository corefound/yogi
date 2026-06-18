#pragma once

#include "types.hpp"
#include <nlohmann/json.hpp>

namespace yogi::manifest {

Manifest validateManifest(const nlohmann::json& raw);

} // namespace yogi::manifest
