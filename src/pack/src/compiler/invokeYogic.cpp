#include "compiler/invokeYogic.hpp"
#include "diagnostics/errors.hpp"
#include <cstdlib>
#include <cstdio>
#include <array>
#include <filesystem>

namespace yogi::compiler {
namespace fs = std::filesystem;

static std::string findYogic(const yogi::fs::ProjectPaths& paths) {
  // check local packages/bin/yogic first
  std::string localYogic = paths.binDir + "/yogic";
  if (fs::exists(localYogic))
    return localYogic;

  // check system PATH
  std::string cmd = "which yogic 2>/dev/null";
  FILE* pipe = popen(cmd.c_str(), "r");
  if (pipe) {
    std::array<char, 4096> buf;
    if (fgets(buf.data(), buf.size(), pipe)) {
      std::string result = buf.data();
      pclose(pipe);
      if (!result.empty() && result.back() == '\n')
        result.pop_back();
      if (!result.empty())
        return result;
    }
    pclose(pipe);
  }

  throw diagnostics::missingYogic();
}

YogicResult invokeYogic(const yogi::fs::ProjectPaths& paths, const std::vector<std::string>& args) {
  std::string yogicPath = findYogic(paths);

  // build command string
  std::string cmd = yogicPath;
  for (const auto& arg : args) {
    cmd += " " + arg;
  }
  cmd += " 2>&1";

  FILE* pipe = popen(cmd.c_str(), "r");
  if (!pipe)
    throw diagnostics::compilerFailure("failed to execute yogic");

  std::string output;
  std::array<char, 4096> buf;
  while (fgets(buf.data(), buf.size(), pipe))
    output += buf.data();

  int exitCode = pclose(pipe);
  YogicResult result;
  result.stdout = output;
  result.exitCode = exitCode;

  if (exitCode != 0)
    throw diagnostics::compilerFailure(output);

  return result;
}

bool checkYogicExists(const yogi::fs::ProjectPaths& paths) {
  try {
    findYogic(paths);
    return true;
  } catch (...) {
    return false;
  }
}

} // namespace yogi::compiler
