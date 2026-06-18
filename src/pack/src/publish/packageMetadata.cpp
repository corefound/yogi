#include "packageMetadata.hpp"
#include "auth/authConfig.hpp"
#include "fs/fileSystem.hpp"
#include "diagnostics/errors.hpp"
#include <nlohmann/json.hpp>
#include <filesystem>
#include <fstream>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <cctype>

namespace yogi::publish {
namespace stdfs = std::filesystem;
using json = nlohmann::json;

std::string getRegistryDir() {
  std::string configDir = auth::getAuthConfigDir();
  if (configDir.empty()) {
    throw diagnostics::fileSystemError("<config>", "could not determine config directory");
  }
  return configDir + "/registry";
}

std::string metadataPathForPackage(const std::string& packageName) {
  return getRegistryDir() + "/" + packageName + ".json";
}

std::optional<std::string> findLocalReadme(const std::string& root) {
  static const char* candidates[] = {
    "README.md",
    "readme.md",
    "README",
    "README.txt",
    "readme.txt"
  };

  for (const char* candidate : candidates) {
    std::string path = root + "/" + candidate;
    if (yogi::fs::fileExists(path)) {
      return yogi::fs::readFile(path);
    }
  }
  return std::nullopt;
}

std::string normalizeReleaseTag(const std::string& version) {
  if (version.empty()) {
    return version;
  }
  if (version[0] == 'v' || version[0] == 'V') {
    return version;
  }
  return "v" + version;
}

std::string validateGitHubRepoName(const std::string& name) {
  if (name.empty()) {
    throw diagnostics::invalidManifest("<unknown>", "package name cannot be empty");
  }

  std::string normalized;
  normalized.reserve(name.size());
  for (char c : name) {
    if (std::isalnum(static_cast<unsigned char>(c)) || c == '-' || c == '_' || c == '.') {
      normalized += static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    } else {
      throw diagnostics::publishFailed(
        "package name \"" + name + "\" is not valid for a GitHub repository "
        "(use letters, numbers, hyphens, underscores, or periods)");
    }
  }

  if (!normalized.empty() && (normalized.front() == '-' || normalized.front() == '.')) {
    throw diagnostics::publishFailed("package name \"" + name + "\" cannot start with '-' or '.'");
  }

  return normalized;
}

std::string currentTimestamp() {
  auto now = std::chrono::system_clock::now();
  auto time = std::chrono::system_clock::to_time_t(now);
  std::tm tm{};
#if defined(_WIN32)
  gmtime_s(&tm, &time);
#else
  gmtime_r(&time, &tm);
#endif
  std::ostringstream oss;
  oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
  return oss.str();
}

static PackageMetadata parseMetadata(const json& j) {
  PackageMetadata metadata;
  metadata.name = j.value("name", "");
  metadata.version = j.value("version", "");
  if (j.contains("description") && j["description"].is_string()) {
    metadata.description = j["description"].get<std::string>();
  }
  metadata.owner = j.value("owner", "");
  metadata.repository = j.value("repository", "");
  if (j.contains("readme") && j["readme"].is_string()) {
    metadata.readme = j["readme"].get<std::string>();
  }
  metadata.publishedAt = j.value("publishedAt", "");
  if (j.contains("collaborators") && j["collaborators"].is_array()) {
    for (const auto& item : j["collaborators"]) {
      if (item.is_string()) {
        metadata.collaborators.push_back(item.get<std::string>());
      }
    }
  }
  if (j.contains("releases") && j["releases"].is_array()) {
    for (const auto& item : j["releases"]) {
      PublishedRelease release;
      release.version = item.value("version", "");
      release.tag = item.value("tag", "");
      release.assetName = item.value("assetName", "");
      release.publishedAt = item.value("publishedAt", "");
      metadata.releases.push_back(release);
    }
  }
  return metadata;
}

static json metadataToJson(const PackageMetadata& metadata) {
  json j;
  j["name"] = metadata.name;
  j["version"] = metadata.version;
  if (metadata.description) {
    j["description"] = *metadata.description;
  }
  j["owner"] = metadata.owner;
  j["repository"] = metadata.repository;
  if (metadata.readme) {
    j["readme"] = *metadata.readme;
  }
  j["publishedAt"] = metadata.publishedAt;
  j["collaborators"] = metadata.collaborators;

  json releases = json::array();
  for (const auto& release : metadata.releases) {
    json item;
    item["version"] = release.version;
    item["tag"] = release.tag;
    item["assetName"] = release.assetName;
    item["publishedAt"] = release.publishedAt;
    releases.push_back(item);
  }
  j["releases"] = releases;
  return j;
}

void savePackageMetadata(const PackageMetadata& metadata) {
  std::string registryDir = getRegistryDir();
  yogi::fs::ensureDir(registryDir);
  std::string path = metadataPathForPackage(metadata.name);
  yogi::fs::writeFile(path, metadataToJson(metadata).dump(2));
}

std::optional<PackageMetadata> loadPackageMetadata(const std::string& packageName) {
  std::string path = metadataPathForPackage(packageName);
  if (!yogi::fs::fileExists(path)) {
    return std::nullopt;
  }

  std::ifstream file(path);
  if (!file.is_open()) {
    return std::nullopt;
  }

  json j;
  try {
    file >> j;
  } catch (const json::parse_error&) {
    return std::nullopt;
  }

  return parseMetadata(j);
}

} // namespace yogi::publish
