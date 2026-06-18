#include "registry/unpackPackage.hpp"

namespace yogi::registry {

UnpackResult unpackPackage(Registry& registry, const std::string& packageName, const std::string& version, const std::string& destination) {
  registry.downloadPackage(packageName, version, destination);
  UnpackResult result;
  result.packageName = packageName;
  result.version = version;
  result.destination = destination;
  return result;
}

} // namespace yogi::registry
