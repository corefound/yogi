#pragma once

#include <string>
#include "../fs/paths.hpp"

namespace yogi::cache {

struct CacheLayout {
  std::string cacheDir;
  std::string libsDir;
  std::string metaPath;
};

CacheLayout getCacheLayout(const yogi::fs::ProjectPaths& paths);
std::string cacheMetaPath(const yogi::fs::ProjectPaths& paths);
std::string libArtifactPath(const yogi::fs::ProjectPaths& paths, const std::string& name, const std::string& version);

} // namespace yogi::cache
