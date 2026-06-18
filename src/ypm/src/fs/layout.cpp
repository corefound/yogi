#include "fs/layout.hpp"
#include "diagnostics/errors.hpp"
#include <filesystem>
#include <fstream>
#include <cstdlib>
#include <unistd.h>
#include <limits.h>
#include <mach-o/dyld.h>

namespace yogi::fs {
namespace fs = std::filesystem;

static std::string resolveSystemBinary(const std::string& name) {
  std::string cmd = "which " + name + " 2>/dev/null";
  FILE* pipe = popen(cmd.c_str(), "r");
  if (!pipe) return "";
  char buf[4096];
  std::string result;
  if (fgets(buf, sizeof(buf), pipe))
    result = buf;
  pclose(pipe);
  if (!result.empty() && result.back() == '\n')
    result.pop_back();
  return result;
}

static std::string getBinaryDir() {
  char buf[PATH_MAX];
  ssize_t len = readlink("/proc/self/exe", buf, sizeof(buf) - 1);
  if (len != -1) {
    buf[len] = '\0';
    std::string path = buf;
    size_t pos = path.find_last_of('/');
    if (pos != std::string::npos)
      return path.substr(0, pos);
  }
  // macOS fallback
  uint32_t size = PATH_MAX;
  if (_NSGetExecutablePath(buf, &size) == 0) {
    std::string path = buf;
    size_t pos = path.find_last_of('/');
    if (pos != std::string::npos)
      return path.substr(0, pos);
  }
  return "";
}

void ensureDirectories(const ProjectPaths& paths) {
  const std::string dirs[] = {
    paths.packagesDir,
    paths.binDir,
    paths.libsDir,
    paths.cacheDir,
    paths.cacheLibsDir,
  };
  for (const auto& dir : dirs) {
    std::error_code ec;
    fs::create_directories(dir, ec);
    if (ec)
      throw diagnostics::fileSystemError(dir, ec.message());
  }
}

void createBinSymlinks(const ProjectPaths& paths) {
  std::string yogiLink = paths.binDir + "/yogi";
  std::string yogicLink = paths.binDir + "/yogic";

  auto tryCreateSymlink = [&](const std::string& linkPath, const std::string& binaryName) -> bool {
    if (fs::exists(linkPath) || fs::is_symlink(linkPath))
      return true;

    std::string source = resolveSystemBinary(binaryName);
    if (source.empty()) {
      std::string binDir = getBinaryDir();
      if (!binDir.empty()) {
        // For yogi, use the actual yogi binary we built (not dist/cli/main.js)
        if (binaryName == "yogi")
          source = binDir + "/yogi";
        else
          source = binDir + "/yogic";
      }
    }
    if (!source.empty()) {
      std::error_code ec;
      source = fs::canonical(source, ec).string();
      if (!ec) {
        fs::create_symlink(source, linkPath, ec);
        if (ec)
          throw diagnostics::fileSystemError(linkPath, ec.message());
        return true;
      }
    }
    return false;
  };

  tryCreateSymlink(yogiLink, "yogi");
  tryCreateSymlink(yogicLink, "yogic");
}

void createGitignore(const ProjectPaths& paths) {
  std::string gitignorePath = paths.root + "/.gitignore";
  if (!fs::exists(gitignorePath)) {
    std::ofstream file(gitignorePath);
    file << "packages/\ndist/\n";
  }
}

} // namespace yogi::fs