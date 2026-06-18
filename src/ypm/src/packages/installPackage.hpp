#pragma once

#include <string>
#include "../fs/paths.hpp"
#include "packageIdentity.hpp"

namespace yogi::packages {

struct InstalledPackage {
  PackageIdentity identity;
  std::string path;
};

InstalledPackage installPackage(const yogi::fs::ProjectPaths& paths, const PackageIdentity& identity, const std::string& sourceDir);
InstalledPackage createStubPackage(const yogi::fs::ProjectPaths& paths, const PackageIdentity& identity);

} // namespace yogi::packages
