#include "cli/commands/install.hpp"
#include "fs/paths.hpp"
#include "fs/layout.hpp"
#include "manifest/readManifest.hpp"
#include "lockfile/writeYogiLog.hpp"
#include "lockfile/types.hpp"
#include "semver/range.hpp"
#include "semver/resolver.hpp"
#include "registry/fetchPackage.hpp"
#include "packages/installPackage.hpp"
#include "diagnostics/errors.hpp"
#include <map>
#include <filesystem>

namespace yogi::cli {
namespace stdfs = std::filesystem;

void installCommand(const std::string& root, diagnostics::Logger& logger) {
  auto paths = fs::resolveProjectPaths(root);

  logger.info("Reading manifest...");
  auto manifest = manifest::readManifest(paths.manifestPath);

  logger.info("Resolving dependencies for " + manifest.name + "...");

  // Merge all dependencies
  std::map<std::string, std::string> allDeps;
  if (manifest.dependencies) {
    for (const auto& [name, version] : *manifest.dependencies)
      allDeps[name] = version;
  }
  if (manifest.devDependencies) {
    for (const auto& [name, version] : *manifest.devDependencies)
      allDeps[name] = version;
  }

  fs::ensureDirectories(paths);
  fs::createBinSymlinks(paths);

  if (allDeps.empty()) {
    logger.info("No dependencies to install.");
    lockfile::Lockfile emptyLock;
    emptyLock.version = "1";
    lockfile::writeYogiLog(paths.lockfilePath, emptyLock);
    return;
  }

  // Resolve dependencies
  lockfile::Lockfile lockfile;
  lockfile.version = "1";

  auto& registry = registry::getRegistry();

  for (const auto& [depName, depRange] : allDeps) {
    auto range = semver::parseRange(depRange);
    if (!range)
      throw diagnostics::unsupportedVersionRange(depName, depRange);

    auto available = registry.getAvailableVersions(depName);
    auto best = semver::selectBestMatch(available, *range);

    if (!best) {
      throw diagnostics::dependencyConflict(depName, "none", depRange);
    }

    std::string lockKey = depName + "@" + *best;
    if (lockfile.packages.find(lockKey) != lockfile.packages.end())
      continue;

    lockfile::LockfileEntry entry;
    entry.version = *best;
    lockfile.packages[lockKey] = entry;

    // Install package
    logger.info("  Installing " + depName + "@" + *best + "...");
    packages::PackageIdentity id{depName, *best};
    packages::installPackage(paths, id, "");
  }

  lockfile::writeYogiLog(paths.lockfilePath, lockfile);
  logger.info("Install complete.");
}

} // namespace yogi::cli
