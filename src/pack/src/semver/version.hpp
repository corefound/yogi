#pragma once

#include <string>
#include <vector>
#include <optional>

namespace yogi::semver {

struct Version {
  int major = 0;
  int minor = 0;
  int patch = 0;
  std::vector<std::string> prerelease;
};

std::optional<Version> parseVersion(const std::string& raw);
std::string formatVersion(const Version& v);
int compareVersions(const Version& a, const Version& b);
bool isPrerelease(const Version& v);

} // namespace yogi::semver
