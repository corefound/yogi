#pragma once

#include <string>
#include <vector>
#include <optional>
#include "range.hpp"
#include "version.hpp"

namespace yogi::semver {

std::optional<std::string> selectBestMatch(
  const std::vector<std::string>& versions,
  const VersionRange& range);

} // namespace yogi::semver
