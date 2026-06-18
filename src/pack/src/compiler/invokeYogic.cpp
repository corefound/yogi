#include "compiler/invokeYogic.hpp"
#include "compilerDriver.h"
#include "diagnostics/errors.hpp"
#include <filesystem>

namespace yogi::compiler {
namespace fs = std::filesystem;

static std::string valueAfterFlag(const std::vector<std::string>& args, const std::string& flag) {
  for (std::size_t index = 0; index + 1 < args.size(); index++) {
    if (args[index] == flag) {
      return args[index + 1];
    }
  }

  return "";
}

YogicResult invokeYogic(const yogi::fs::ProjectPaths& paths, const std::vector<std::string>& args) {
  std::string entry = valueAfterFlag(args, "--entry");
  if (entry.empty())
    entry = "main.ts";

  std::string projectRoot = valueAfterFlag(args, "--project-root");
  if (projectRoot.empty())
    projectRoot = paths.root;

  fs::path entryPath = entry;
  if (entryPath.is_relative())
    entryPath = fs::path(projectRoot) / entryPath;

  const auto previousPath = fs::current_path();
  fs::current_path(projectRoot);
  const int exitCode = yogi::core::runCompiler(entryPath.string());
  fs::current_path(previousPath);

  YogicResult result;
  result.stdout = "Compiled " + entryPath.string();
  result.exitCode = exitCode;

  if (exitCode != 0)
    throw diagnostics::compilerFailure("Yogi compiler failed for " + entryPath.string());

  return result;
}

bool checkYogicExists(const yogi::fs::ProjectPaths& paths) {
  (void)paths;
  return true;
}

} // namespace yogi::compiler
