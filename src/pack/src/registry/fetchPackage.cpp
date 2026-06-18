#include "registry/fetchPackage.hpp"
#include "diagnostics/errors.hpp"

namespace yogi::registry {

MockRegistry::MockRegistry(std::map<std::string, std::vector<std::string>> packages)
  : packages_(std::move(packages))
{}

std::vector<std::string> MockRegistry::getAvailableVersions(const std::string& packageName) {
  auto it = packages_.find(packageName);
  if (it == packages_.end())
    throw diagnostics::registryError(packageName, "package not found in mock registry");
  return it->second;
}

void MockRegistry::downloadPackage(const std::string&, const std::string&, const std::string&) {}

std::vector<std::string> FailRegistry::getAvailableVersions(const std::string& packageName) {
  throw diagnostics::registryError(packageName, "registry is not configured; use a real registry or mock");
}

void FailRegistry::downloadPackage(const std::string& packageName, const std::string&, const std::string&) {
  throw diagnostics::registryError(packageName, "registry is not configured; use a real registry or mock");
}

static Registry* globalRegistry = nullptr;

Registry& getRegistry() {
  if (!globalRegistry) {
    static FailRegistry fail;
    return fail;
  }
  return *globalRegistry;
}

void setRegistry(Registry* registry) {
  globalRegistry = registry;
}

} // namespace yogi::registry
