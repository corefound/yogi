#include "range.hpp"

namespace yogi::semver {

std::optional<VersionRange> parseRange(const std::string& raw) {
  std::string trimmed = raw;
  // trim whitespace
  size_t start = trimmed.find_first_not_of(" \t\r\n");
  if (start == std::string::npos) return std::nullopt;
  size_t end = trimmed.find_last_not_of(" \t\r\n");
  trimmed = trimmed.substr(start, end - start + 1);

  VersionRange range;
  if (trimmed[0] == '^') {
    range.kind = RangeKind::CompatibleMajor;
    auto v = parseVersion(trimmed.substr(1));
    if (!v) return std::nullopt;
    range.version = *v;
  } else if (trimmed[0] == '~') {
    range.kind = RangeKind::CompatibleMinor;
    auto v = parseVersion(trimmed.substr(1));
    if (!v) return std::nullopt;
    range.version = *v;
  } else {
    range.kind = RangeKind::Exact;
    auto v = parseVersion(trimmed);
    if (!v) return std::nullopt;
    range.version = *v;
  }
  return range;
}

bool rangeSatisfies(const Version& version, const VersionRange& range) {
  switch (range.kind) {
    case RangeKind::Exact:
      return compareVersions(version, range.version) == 0;
    case RangeKind::CompatibleMajor:
      if (version.major != range.version.major) return false;
      return compareVersions(version, range.version) >= 0;
    case RangeKind::CompatibleMinor:
      if (version.major != range.version.major || version.minor != range.version.minor)
        return false;
      return compareVersions(version, range.version) >= 0;
  }
  return false;
}

std::string formatRange(const VersionRange& range) {
  std::string base = formatVersion(range.version);
  switch (range.kind) {
    case RangeKind::Exact: return base;
    case RangeKind::CompatibleMajor: return "^" + base;
    case RangeKind::CompatibleMinor: return "~" + base;
  }
  return base;
}

} // namespace yogi::semver
