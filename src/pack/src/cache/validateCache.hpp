#pragma once

#include <string>
#include <vector>
#include "../fs/paths.hpp"

namespace yogi::cache {

struct CacheValidation {
  bool valid = false;
  std::vector<std::string> missingArtifacts;
  bool metaExists = false;
};

CacheValidation validateCache(const yogi::fs::ProjectPaths& paths, const std::vector<std::pair<std::string, std::string>>& packages);

} // namespace yogi::cache
