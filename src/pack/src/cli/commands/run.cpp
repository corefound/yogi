#include "cli/commands/run.hpp"
#include "cli/commands/build.hpp"
#include "fs/paths.hpp"
#include "manifest/readManifest.hpp"
#include "diagnostics/errors.hpp"
#include <cstdlib>
#include <filesystem>

namespace yogi::cli {
namespace stdfs = std::filesystem;

void runCommand(const std::string& root, diagnostics::Logger& logger, const std::vector<std::string>& passthroughArgs) {
  logger.info("Building before run...");
  buildCommand(root, logger);

  auto paths = fs::resolveProjectPaths(root);
  auto manifest = manifest::readManifest(paths.manifestPath);

  std::string outputDir = manifest.build && manifest.build->output ? *manifest.build->output : "dist";
  std::string binaryPath = root + "/" + outputDir + "/" + manifest.name;

  if (!stdfs::exists(binaryPath)) {
    std::string fallback = root + "/" + outputDir + "/main";
    if (!stdfs::exists(fallback))
      throw diagnostics::missingBuildOutput(binaryPath);

    logger.info("Running " + fallback + "...");
    std::string cmd = fallback;
    for (const auto& arg : passthroughArgs)
      cmd += " " + arg;
    int ret = std::system(cmd.c_str());
    if (ret != 0)
      throw diagnostics::compilerFailure("binary exited with code " + std::to_string(ret));
    return;
  }

  logger.info("Running " + binaryPath + "...");
  std::string cmd = binaryPath;
  for (const auto& arg : passthroughArgs)
    cmd += " " + arg;
  int ret = std::system(cmd.c_str());
  if (ret != 0)
    throw diagnostics::compilerFailure("binary exited with code " + std::to_string(ret));
}

} // namespace yogi::cli
