#include "cli/commands/build.hpp"
#include "fs/paths.hpp"
#include "fs/layout.hpp"
#include "manifest/readManifest.hpp"
#include "lockfile/readYogiLog.hpp"
#include "compiler/invokeYogic.hpp"
#include "diagnostics/errors.hpp"
#include <filesystem>

namespace yogi::cli {
namespace stdfs = std::filesystem;

void buildCommand(const std::string& root, diagnostics::Logger& logger) {
  auto paths = fs::resolveProjectPaths(root);

  logger.info("Reading manifest...");
  auto manifest = manifest::readManifest(paths.manifestPath);

  logger.info("Reading lockfile...");
  auto lockfile = lockfile::readYogiLog(paths.lockfilePath);
  if (!lockfile)
    throw diagnostics::missingLockfile(paths.lockfilePath);

  fs::ensureDirectories(paths);

  std::error_code ec;
  stdfs::create_directories(paths.destDir, ec);
  if (ec)
    throw diagnostics::fileSystemError(paths.destDir, ec.message());

  bool yogicAvailable = compiler::checkYogicExists(paths);
  if (!yogicAvailable) {
    logger.warn("yogic compiler not found; skipping build (simulated)");
    logger.info("Build output expected at: " + paths.destDir);
    return;
  }

  logger.info("Running yogic...");
  std::string entry = manifest.build && manifest.build->entry ? *manifest.build->entry : "main.ts";
  std::string output = manifest.build && manifest.build->output ? *manifest.build->output : "dist";

  auto result = compiler::invokeYogic(paths, {
    "--entry", entry,
    "--output", output,
    "--project-root", root,
    "--packages", paths.packagesDir,
    "--cache", paths.cacheDir,
  });

  logger.info(result.stdout);

  if (!stdfs::exists(paths.destDir))
    throw diagnostics::missingBuildOutput(paths.destDir);

  logger.info("Build successful: " + paths.destDir);
}

} // namespace yogi::cli
