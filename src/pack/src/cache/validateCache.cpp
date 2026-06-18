#include "cache/validateCache.hpp"
#include "cache/cacheLayout.hpp"
#include <filesystem>

namespace yogi::cache {
namespace fs = std::filesystem;

CacheValidation validateCache(const yogi::fs::ProjectPaths& paths, const std::vector<std::pair<std::string, std::string>>& packages) {
  CacheValidation result;
  for (const auto& [name, version] : packages) {
    std::string artifactPath = libArtifactPath(paths, name, version);
    if (!fs::exists(artifactPath))
      result.missingArtifacts.push_back(name + "@" + version);
  }
  result.metaExists = fs::exists(cacheMetaPath(paths));
  result.valid = result.missingArtifacts.empty();
  return result;
}

} // namespace yogi::cache
