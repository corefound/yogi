#pragma once

#include <string>

namespace yogi::fs {

struct ProjectPaths {
  std::string root;
  std::string manifestPath;
  std::string lockfilePath;
  std::string packagesDir;
  std::string binDir;
  std::string libsDir;
  std::string cacheDir;
  std::string cacheLibsDir;
  std::string destDir;
};

ProjectPaths resolveProjectPaths(const std::string& root);
std::string packageLibPath(const ProjectPaths& paths, const std::string& name, const std::string& version);
std::string cacheArtifactPath(const ProjectPaths& paths, const std::string& name, const std::string& version);
std::string selfDir();

} // namespace yogi::fs
