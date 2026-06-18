#pragma once

#include "paths.hpp"

namespace yogi::fs {

void ensureDirectories(const ProjectPaths& paths);
void createBinSymlinks(const ProjectPaths& paths);
void createGitignore(const ProjectPaths& paths);

} // namespace yogi::fs
