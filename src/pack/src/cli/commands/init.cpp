#include "cli/commands/init.hpp"
#include "fs/paths.hpp"
#include "fs/layout.hpp"
#include "diagnostics/errors.hpp"
#include "lockfile/types.hpp"
#include "lockfile/writeYogiLog.hpp"
#include <fstream>
#include <filesystem>
#include <nlohmann/json.hpp>
#include <iostream>

namespace yogi::cli {
namespace stdfs = std::filesystem;

static std::string getProjectName(const std::string& root) {
  size_t pos = root.find_last_of('/');
  if (pos == std::string::npos) return "my-app";
  return root.substr(pos + 1);
}

static std::string prompt(const std::string& message, const std::string& defaultValue = "") {
  std::cout << message;
  if (!defaultValue.empty())
    std::cout << " [" << defaultValue << "]";
  std::cout << ": ";
  std::string input;
  std::getline(std::cin, input);
  if (input.empty() && !defaultValue.empty())
    return defaultValue;
  return input;
}

static std::string promptLicense() {
  std::cout << "license (MIT): ";
  std::string input;
  std::getline(std::cin, input);
  return input.empty() ? "MIT" : input;
}

void initCommand(const std::string& root, diagnostics::Logger& logger, bool yes) {
  auto paths = fs::resolveProjectPaths(root);

  std::string name = getProjectName(root);
  std::string version = "0.1.0";
  std::string description = "";
  std::string license = "MIT";
  std::string entry = "main.ts";
  std::string author = "";

  if (!yes) {
    std::cout << "\nYogi project initialization\n";
    std::cout << "==========================\n\n";

    name = prompt("name", name);
    version = prompt("version", version);
    description = prompt("description", description);
    license = promptLicense();
    entry = prompt("entry point", entry);
    author = prompt("author", author);
    std::cout << "\n";
  }

  std::string mainTs = root + "/" + entry;

  std::error_code rootError;
  stdfs::create_directories(root, rootError);
  if (rootError)
    throw diagnostics::fileSystemError(root, rootError.message());

  fs::ensureDirectories(paths);

  nlohmann::json manifest;
  manifest["name"] = name;
  manifest["version"] = version;
  manifest["description"] = description;
  manifest["license"] = license;
  manifest["author"] = author;
  manifest["build"]["entry"] = entry;
  manifest["build"]["output"] = "dist";
  std::ofstream(paths.manifestPath) << manifest.dump(2);

  const auto mainPath = stdfs::path(mainTs);
  if (mainPath.has_parent_path()) {
    std::error_code parentError;
    stdfs::create_directories(mainPath.parent_path(), parentError);
    if (parentError)
      throw diagnostics::fileSystemError(mainPath.parent_path().string(), parentError.message());
  }

  std::ofstream mainFile(mainTs);
  mainFile
    << "function main(): number {\n"
    << "    return 0\n"
    << "}\n";

  lockfile::Lockfile emptyLock;
  emptyLock.version = "1";
  lockfile::writeYogiLog(paths.lockfilePath, emptyLock);

  fs::createGitignore(paths);
  fs::createBinSymlinks(paths);

  logger.info("Initialized project at " + root);
}

} // namespace yogi::cli
