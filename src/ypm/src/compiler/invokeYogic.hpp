#pragma once

#include <string>
#include <vector>
#include "../fs/paths.hpp"

namespace yogi::compiler {

struct YogicResult {
  int exitCode = 0;
  std::string stdout;
  std::string stderr;
};

YogicResult invokeYogic(const yogi::fs::ProjectPaths& paths, const std::vector<std::string>& args);
bool checkYogicExists(const yogi::fs::ProjectPaths& paths);

} // namespace yogi::compiler
