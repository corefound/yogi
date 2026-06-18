#include "version.hpp"
#include <regex>
#include <cctype>
#include <sstream>

namespace yogi::semver {

std::optional<Version> parseVersion(const std::string& raw) {
  static const std::regex re(R"(^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$)");
  std::smatch m;
  if (!std::regex_match(raw, m, re))
    return std::nullopt;

  Version v;
  v.major = std::stoi(m[1].str());
  v.minor = std::stoi(m[2].str());
  v.patch = std::stoi(m[3].str());

  if (m[4].matched) {
    std::string pre = m[4].str();
    std::istringstream ss(pre);
    std::string part;
    while (std::getline(ss, part, '.')) {
      if (!part.empty())
        v.prerelease.push_back(part);
    }
  }
  return v;
}

std::string formatVersion(const Version& v) {
  std::string result = std::to_string(v.major) + "." + std::to_string(v.minor) + "." + std::to_string(v.patch);
  if (!v.prerelease.empty()) {
    result += "-";
    for (size_t i = 0; i < v.prerelease.size(); i++) {
      if (i > 0) result += ".";
      result += v.prerelease[i];
    }
  }
  return result;
}

int compareVersions(const Version& a, const Version& b) {
  if (a.major != b.major) return a.major - b.major;
  if (a.minor != b.minor) return a.minor - b.minor;
  if (a.patch != b.patch) return a.patch - b.patch;

  bool aPre = !a.prerelease.empty();
  bool bPre = !b.prerelease.empty();
  if (!aPre && !bPre) return 0;
  if (!aPre) return 1;
  if (!bPre) return -1;

  size_t minLen = std::min(a.prerelease.size(), b.prerelease.size());
  for (size_t i = 0; i < minLen; i++) {
    const auto& aPart = a.prerelease[i];
    const auto& bPart = b.prerelease[i];
    char* aEnd = nullptr;
    char* bEnd = nullptr;
    long aNum = std::strtol(aPart.c_str(), &aEnd, 10);
    long bNum = std::strtol(bPart.c_str(), &bEnd, 10);
    if (*aEnd == '\0' && *bEnd == '\0') {
      if (aNum != bNum) return aNum - bNum;
    } else {
      if (aPart != bPart) return aPart < bPart ? -1 : 1;
    }
  }
  return static_cast<int>(a.prerelease.size() - b.prerelease.size());
}

bool isPrerelease(const Version& v) {
  return !v.prerelease.empty();
}

} // namespace yogi::semver
