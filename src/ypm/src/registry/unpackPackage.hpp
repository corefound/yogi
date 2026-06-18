#pragma once

#include <string>
#include <vector>
#include "fetchPackage.hpp"

namespace yogi::registry {

struct UnpackResult {
  std::string packageName;
  std::string version;
  std::string destination;
  std::vector<std::string> files;
};

UnpackResult unpackPackage(Registry& registry, const std::string& packageName, const std::string& version, const std::string& destination);

} // namespace yogi::registry
