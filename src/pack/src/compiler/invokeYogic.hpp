#pragma once

#include <string>
#include <vector>
#include "../fs/paths.hpp"

namespace yogi::compiler {

struct YogicResult {
  int exitCode = 0;
  std::string standardOutput;
  std::string standardError;
};

YogicResult invokeYogic(const yogi::fs::ProjectPaths& paths, const std::vector<std::string>& args);
bool checkYogicExists(const yogi::fs::ProjectPaths& paths);

} // namespace yogi::compiler
