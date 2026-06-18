#include "cache/cacheLayout.hpp"

namespace yogi::cache {

CacheLayout getCacheLayout(const yogi::fs::ProjectPaths& paths) {
  CacheLayout layout;
  layout.cacheDir = paths.cacheDir;
  layout.libsDir = paths.cacheLibsDir;
  layout.metaPath = cacheMetaPath(paths);
  return layout;
}

std::string cacheMetaPath(const yogi::fs::ProjectPaths& paths) {
  return paths.cacheDir + "/meta.fb";
}

std::string libArtifactPath(const yogi::fs::ProjectPaths& paths, const std::string& name, const std::string& version) {
  return paths.cacheLibsDir + "/lib" + name + "@" + version + ".a";
}

} // namespace yogi::cache
