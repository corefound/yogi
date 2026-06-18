#include "packages/packageIdentity.hpp"

namespace yogi::packages {

PackageIdentity makeIdentity(const std::string& name, const std::string& version) {
  return {name, version};
}

std::string identityKey(const PackageIdentity& identity) {
  return identity.name + "@" + identity.version;
}

std::optional<PackageIdentity> identityFromKey(const std::string& key) {
  size_t atIndex = key.rfind('@');
  if (atIndex == std::string::npos || atIndex == 0 || atIndex == key.size() - 1)
    return std::nullopt;
  PackageIdentity id;
  id.name = key.substr(0, atIndex);
  id.version = key.substr(atIndex + 1);
  return id;
}

bool identityEquals(const PackageIdentity& a, const PackageIdentity& b) {
  return a.name == b.name && a.version == b.version;
}

} // namespace yogi::packages
