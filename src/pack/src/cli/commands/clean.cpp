#include "cli/commands/clean.hpp"
#include "fs/paths.hpp"
#include "fs/layout.hpp"
#include <filesystem>
#include <vector>

namespace yogi::cli {
namespace stdfs = std::filesystem;

void cleanCommand(const std::string& root, diagnostics::Logger& logger) {
  auto paths = fs::resolveProjectPaths(root);

  logger.info("Cleaning project...");

  std::vector<std::string> targets = {
    paths.cacheDir,
    paths.destDir,
  };

  for (const auto& target : targets) {
    if (stdfs::exists(target)) {
      std::error_code ec;
      stdfs::remove_all(target, ec);
      if (!ec)
        logger.info("  Removed " + target);
    }
  }

  logger.info("Recreating clean directories...");
  fs::ensureDirectories(paths);
  logger.info("Clean complete.");
}

} // namespace yogi::cli
