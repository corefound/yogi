#include "fs/fileSystem.hpp"
#include "diagnostics/errors.hpp"
#include <filesystem>
#include <fstream>

namespace yogi::fs {
namespace fs = std::filesystem;

void ensureDir(const std::string& dir) {
  std::error_code ec;
  fs::create_directories(dir, ec);
  if (ec)
    throw diagnostics::fileSystemError(dir, ec.message());
}

void writeFile(const std::string& path, const std::string& content) {
  std::ofstream file(path);
  if (!file.is_open())
    throw diagnostics::fileSystemError(path, "cannot open for writing");
  file << content;
}

std::string readFile(const std::string& path) {
  std::ifstream file(path);
  if (!file.is_open())
    throw diagnostics::fileSystemError(path, "cannot open for reading");
  std::string content((std::istreambuf_iterator<char>(file)),
                        std::istreambuf_iterator<char>());
  return content;
}

bool fileExists(const std::string& path) {
  return fs::exists(path);
}

void removeDir(const std::string& dir) {
  std::error_code ec;
  fs::remove_all(dir, ec);
  if (ec)
    throw diagnostics::fileSystemError(dir, ec.message());
}

void removeFile(const std::string& path) {
  std::error_code ec;
  fs::remove(path, ec);
  if (ec)
    throw diagnostics::fileSystemError(path, ec.message());
}

} // namespace yogi::fs
