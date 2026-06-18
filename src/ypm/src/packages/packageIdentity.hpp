#pragma once

#include <string>
#include <optional>

namespace yogi::packages {

struct PackageIdentity {
  std::string name;
  std::string version;
};

PackageIdentity makeIdentity(const std::string& name, const std::string& version);
std::string identityKey(const PackageIdentity& identity);
std::optional<PackageIdentity> identityFromKey(const std::string& key);
bool identityEquals(const PackageIdentity& a, const PackageIdentity& b);

} // namespace yogi::packages
