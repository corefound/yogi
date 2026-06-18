#include "resolver.hpp"
#include <algorithm>

namespace yogi::semver {

std::optional<std::string> selectBestMatch(
  const std::vector<std::string>& versions,
  const VersionRange& range) {  
  std::vector<Version> parsed;
  for (const auto& v : versions) {
    auto p = parseVersion(v);
    if (p) parsed.push_back(*p);
  }
  std::sort(parsed.begin(), parsed.end(),
    [](const Version& a, const Version& b) {
      return compareVersions(a, b) < 0;
    });

  const Version* best = nullptr;
  for (const auto& v : parsed) {
    if (rangeSatisfies(v, range))
      best = &v;
  }
  if (best)
    return formatVersion(*best);
  return std::nullopt;
}

} // namespace yogi::semver
