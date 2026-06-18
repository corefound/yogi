#include "cli/commands/build.hpp"
#include "fs/paths.hpp"
#include "fs/layout.hpp"
#include "manifest/readManifest.hpp"
#include "lockfile/readYogiLog.hpp"
#include "compiler/invokeYogic.hpp"
#include "diagnostics/errors.hpp"
#include <filesystem>
#include <system_error>

namespace yogi::cli {
namespace stdfs = std::filesystem;

static bool hasDependencies(const manifest::Manifest& manifest) {
  return (manifest.dependencies && !manifest.dependencies->empty()) ||
    (manifest.devDependencies && !manifest.devDependencies->empty());
}

void buildCommand(const std::string& root, diagnostics::Logger& logger) {
  auto paths = fs::resolveProjectPaths(root);

  logger.info("Reading manifest...");
  auto manifest = manifest::readManifest(paths.manifestPath);

  logger.info("Reading lockfile...");
  auto lockfile = lockfile::readYogiLog(paths.lockfilePath);
  if (!lockfile && hasDependencies(manifest))
    throw diagnostics::missingLockfile(paths.lockfilePath);
  if (!lockfile)
    logger.warn("No lockfile found; continuing because the project has no dependencies.");

  fs::ensureDirectories(paths);

  std::error_code ec;
  stdfs::create_directories(paths.destDir, ec);
  if (ec)
    throw diagnostics::fileSystemError(paths.destDir, ec.message());

  logger.info("Running Yogi compiler...");
  std::string entry = manifest.build && manifest.build->entry ? *manifest.build->entry : "main.io";
  std::string output = manifest.build && manifest.build->output ? *manifest.build->output : "dist";

  auto result = compiler::invokeYogic(paths, {
    "--entry", entry,
    "--output", output,
    "--project-root", root,
    "--packages", paths.packagesDir,
    "--cache", paths.cacheDir,
  });

  logger.info(result.stdout);

  const auto cacheExecutable = stdfs::path(paths.cacheDir) / "yogi";
  if (!stdfs::exists(cacheExecutable))
    throw diagnostics::missingBuildOutput(cacheExecutable.string());

  const auto outputDir = stdfs::path(root) / output;
  stdfs::create_directories(outputDir, ec);
  if (ec)
    throw diagnostics::fileSystemError(outputDir.string(), ec.message());

  const auto outputExecutable = outputDir / manifest.name;
  stdfs::copy_file(cacheExecutable, outputExecutable, stdfs::copy_options::overwrite_existing, ec);
  if (ec)
    throw diagnostics::fileSystemError(outputExecutable.string(), ec.message());

  stdfs::permissions(
    outputExecutable,
    stdfs::perms::owner_exec | stdfs::perms::group_exec | stdfs::perms::others_exec,
    stdfs::perm_options::add,
    ec);
  if (ec)
    throw diagnostics::fileSystemError(outputExecutable.string(), ec.message());

  logger.info("Build successful: " + outputExecutable.string());
}

} // namespace yogi::cli
