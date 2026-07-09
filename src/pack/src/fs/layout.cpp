#include "fs/layout.hpp"
#include "diagnostics/errors.hpp"
#include "platform/process.hpp"
#include <array>
#include <filesystem>
#include <fstream>
#include <cstdlib>
#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#else
#include <unistd.h>
#include <limits.h>
#endif
#ifdef __APPLE__
#include <mach-o/dyld.h>
#endif

namespace yogi::fs {
namespace fs = std::filesystem;

static std::string resolveSystemBinary(const std::string& name) {
#if defined(_WIN32)
  std::string cmd = "where " + name + " 2>NUL";
#else
  std::string cmd = "which " + name + " 2>/dev/null";
#endif
  FILE* pipe = platform::openPipe(cmd.c_str(), "r");
  if (!pipe) return "";
  char buf[4096];
  std::string result;
  if (fgets(buf, sizeof(buf), pipe))
    result = buf;
  platform::closePipe(pipe);
  if (!result.empty() && result.back() == '\n')
    result.pop_back();
  return result;
}

static std::string getBinaryDir() {
#if defined(_WIN32)
  std::array<char, MAX_PATH> buf{};
  DWORD len = GetModuleFileNameA(nullptr, buf.data(), static_cast<DWORD>(buf.size()));
  if (len > 0 && len < buf.size()) {
    return fs::path(buf.data()).parent_path().string();
  }
#else
  char buf[PATH_MAX];
  ssize_t len = readlink("/proc/self/exe", buf, sizeof(buf) - 1);
  if (len != -1) {
    buf[len] = '\0';
    std::string path = buf;
    size_t pos = path.find_last_of('/');
    if (pos != std::string::npos)
      return path.substr(0, pos);
  }
#ifdef __APPLE__
  uint32_t size = PATH_MAX;
  if (_NSGetExecutablePath(buf, &size) == 0) {
    std::string path = buf;
    size_t pos = path.find_last_of('/');
    if (pos != std::string::npos)
      return path.substr(0, pos);
  }
#endif
#endif
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
  const auto executableName = [](const std::string& name) {
#if defined(_WIN32)
    return name + ".exe";
#else
    return name;
#endif
  };

  std::string yogiLink = (fs::path(paths.binDir) / executableName("yogi")).string();
  std::string yogicLink = (fs::path(paths.binDir) / executableName("yogic")).string();

  auto tryCreateSymlink = [&](const std::string& linkPath, const std::string& binaryName) -> bool {
    if (fs::exists(linkPath) || fs::is_symlink(linkPath))
      return true;

    std::string source = resolveSystemBinary(binaryName);
    if (source.empty()) {
      std::string binDir = getBinaryDir();
      if (!binDir.empty()) {
        // For yogi, use the actual yogi binary we built (not dist/cli/main.js)
        source = (fs::path(binDir) / executableName(binaryName)).string();
      }
    }
    if (!source.empty()) {
      std::error_code ec;
      source = fs::canonical(source, ec).string();
      if (!ec) {
#if defined(_WIN32)
        fs::copy_file(source, linkPath, fs::copy_options::overwrite_existing, ec);
#else
        fs::create_symlink(source, linkPath, ec);
#endif
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
