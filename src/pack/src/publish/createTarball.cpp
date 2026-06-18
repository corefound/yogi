#include "createTarball.hpp"
#include "diagnostics/errors.hpp"
#include <filesystem>
#include <fstream>
#include <cstdio>
#include <sstream>

namespace yogi::publish {
namespace fs = std::filesystem;

namespace {

std::string shellEscape(const std::string& value) {
  std::string escaped = "'";
  for (char c : value) {
    if (c == '\'') {
      escaped += "'\\''";
    } else {
      escaped += c;
    }
  }
  escaped += "'";
  return escaped;
}

} // namespace

std::string createProjectTarball(const std::string& root, const std::string& packageName, const std::string& version) {
  fs::path rootPath(root);
  if (!fs::exists(rootPath)) {
    throw diagnostics::fileSystemError(root, "project root does not exist");
  }

  fs::path tempDir = fs::temp_directory_path();
  std::string assetName = packageName + "-" + version + ".tar.gz";
  fs::path tarPath = tempDir / assetName;

  std::ostringstream cmd;
  cmd << "tar -czf " << shellEscape(tarPath.string())
      << " --exclude=" << shellEscape("packages")
      << " --exclude=" << shellEscape("dist")
      << " --exclude=" << shellEscape(".git")
      << " -C " << shellEscape(root) << " .";

  int status = std::system(cmd.str().c_str());
  if (status != 0 || !fs::exists(tarPath)) {
    throw diagnostics::publishFailed("failed to create source tarball");
  }

  return tarPath.string();
}

void removeTarball(const std::string& tarPath) {
  std::error_code ec;
  fs::remove(tarPath, ec);
}

std::string computeSha256(const std::string& filePath) {
  std::ostringstream cmd;
  cmd << "shasum -a 256 " << shellEscape(filePath) << " 2>/dev/null";

  FILE* pipe = popen(cmd.str().c_str(), "r");
  if (!pipe) {
    return "";
  }

  std::string result;
  char buffer[256];
  while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
    result += buffer;
  }
  pclose(pipe);

  size_t space = result.find(' ');
  if (space != std::string::npos) {
    return result.substr(0, space);
  }
  while (!result.empty() && (result.back() == '\n' || result.back() == '\r')) {
    result.pop_back();
  }
  return result;
}

} // namespace yogi::publish
