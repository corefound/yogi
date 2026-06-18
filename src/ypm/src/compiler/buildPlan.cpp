#include "compiler/buildPlan.hpp"
#include "fs/paths.hpp"

namespace yogi::compiler {

BuildPlan createBuildPlan(
  const yogi::manifest::Manifest& manifest,
  // const yogi::lockfile::Lockfile& lockfile,
  const yogi::fs::ProjectPaths& paths) {

  BuildPlan plan;
  BuildStep linkStep;
  linkStep.kind = "link";
  linkStep.target = manifest.name;
  linkStep.sources = {manifest.build && manifest.build->entry ? *manifest.build->entry : "src/main.ts"};
  linkStep.outputPath = manifest.build && manifest.build->output ? *manifest.build->output : paths.destDir;
  plan.steps.push_back(linkStep);
  plan.outputPath = linkStep.outputPath;
  plan.entryPath = linkStep.sources[0];
  return plan;
}

} // namespace yogi::compiler
