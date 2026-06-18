#include "fs/paths.hpp"

namespace yogi::fs {

ProjectPaths resolveProjectPaths(const std::string& root) {
  ProjectPaths p;
  p.root = root;
  p.manifestPath = root + "/yogi.json";
  p.lockfilePath = root + "/yogi.log";
  p.packagesDir = root + "/packages";
  p.binDir = root + "/packages/bin";
  p.libsDir = root + "/packages/libs";
  p.cacheDir = root + "/packages/.cache";
  p.cacheLibsDir = root + "/packages/.cache/libs";
  p.destDir = root + "/dist";
  return p;
}

std::string packageLibPath(const ProjectPaths& paths, const std::string& name, const std::string& version) {
  return paths.libsDir + "/" + name + "/" + version;
}

std::string cacheArtifactPath(const ProjectPaths& paths, const std::string& name, const std::string& version) {
  return paths.cacheLibsDir + "/lib" + name + "@" + version + ".a";
}

std::string selfDir() {
  return std::string();
}

} // namespace yogi::fs
