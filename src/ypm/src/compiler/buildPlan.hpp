#pragma once

#include <string>
#include <vector>
#include "../manifest/types.hpp"
#include "../lockfile/types.hpp"
#include "../fs/paths.hpp"

namespace yogi::compiler {

struct BuildStep {
  std::string kind; // "compile" or "link"
  std::string target;
  std::vector<std::string> sources;
  std::string outputPath;
};

struct BuildPlan {
  std::vector<BuildStep> steps;
  std::string outputPath;
  std::string entryPath;
};

BuildPlan createBuildPlan(
  const yogi::manifest::Manifest& manifest,
  const yogi::lockfile::Lockfile& lockfile,
  const yogi::fs::ProjectPaths& paths);

} // namespace yogi::compiler
