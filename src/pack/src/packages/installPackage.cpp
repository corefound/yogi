#include "packages/installPackage.hpp"
#include "diagnostics/errors.hpp"
#include <filesystem>
#include <fstream>
#include <nlohmann/json.hpp>

namespace yogi::packages {
namespace fs = std::filesystem;

InstalledPackage installPackage(const yogi::fs::ProjectPaths& paths, const PackageIdentity& identity, const std::string&) {
  std::string destDir = paths.libsDir + "/" + identity.name + "/" + identity.version;
  std::error_code ec;
  fs::create_directories(destDir, ec);
  if (ec)
    throw diagnostics::fileSystemError(destDir, ec.message());
  return {identity, destDir};
}

InstalledPackage createStubPackage(const yogi::fs::ProjectPaths& paths, const PackageIdentity& identity) {
  std::string destDir = paths.libsDir + "/" + identity.name + "/" + identity.version;
  std::error_code ec;
  fs::create_directories(destDir, ec);
  if (ec)
    throw diagnostics::fileSystemError(destDir, ec.message());

  // write yogi.json
  nlohmann::json pkgJson;
  pkgJson["name"] = identity.name;
  pkgJson["version"] = identity.version;
  pkgJson["description"] = "Stub package for " + identity.name + "@" + identity.version;
  std::ofstream(destDir + "/yogi.json") << pkgJson.dump(2);

  // write src/main.ts
  fs::create_directories(destDir + "/src", ec);
  if (ec)
    throw diagnostics::fileSystemError(destDir + "/src", ec.message());
  std::ofstream(destDir + "/src/main.ts") << "// " + identity.name + "@" + identity.version + "\n// stub source file\n";

  return {identity, destDir};
}

} // namespace yogi::packages
