#include "archive.hpp"
#include "diagnostics/errors.hpp"
#include <filesystem>
#include <vector>
#include <string>
#include <cstdlib>
#include <sstream>

namespace yogi::fs {
namespace fs = std::filesystem;

bool createTarGz(const std::string& sourceDir, const std::string& outputPath,
                 const std::vector<std::string>& excludePatterns) {
  fs::path source = fs::absolute(sourceDir);
  fs::path output = fs::absolute(outputPath);

  if (!fs::exists(source) || !fs::is_directory(source)) {
    throw diagnostics::fileSystemError(sourceDir, "source directory does not exist");
  }

  fs::path parentDir = output.parent_path();
  if (!fs::exists(parentDir)) {
    std::error_code ec;
    fs::create_directories(parentDir, ec);
    if (ec) {
      throw diagnostics::fileSystemError(parentDir.string(), ec.message());
    }
  }

  std::ostringstream cmd;
  cmd << "tar -czf " << output.string();

  if (!excludePatterns.empty()) {
    for (const auto& pattern : excludePatterns) {
      cmd << " --exclude=" << pattern;
    }
  }

  cmd << " -C " << source.parent_path().string() << " " << source.filename().string() << " 2>/dev/null";

  int result = std::system(cmd.str().c_str());
  if (result != 0) {
    throw diagnostics::fileSystemError(outputPath, "tar command failed with exit code " + std::to_string(result));
  }

  return fs::exists(output);
}

} // namespace yogi::fs