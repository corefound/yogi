#pragma once

#include <string>
#include <optional>
#include "version.hpp"

namespace yogi::semver {

enum class RangeKind {
  Exact,
  CompatibleMajor,
  CompatibleMinor,
};

struct VersionRange {
  RangeKind kind;
  Version version;
};

std::optional<VersionRange> parseRange(const std::string& raw);
bool rangeSatisfies(const Version& version, const VersionRange& range);
std::string formatRange(const VersionRange& range);

} // namespace yogi::semver
