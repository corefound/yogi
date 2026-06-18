#pragma once

#include <string>
#include <vector>
#include <optional>

namespace yogi::publish {

struct PublishedRelease {
  std::string version;
  std::string tag;
  std::string assetName;
  std::string publishedAt;
};

struct PackageMetadata {
  std::string name;
  std::string version;
  std::optional<std::string> description;
  std::string owner;
  std::string repository;
  std::optional<std::string> readme;
  std::vector<std::string> collaborators;
  std::string publishedAt;
  std::vector<PublishedRelease> releases;
};

struct PublishedUserInfo {
  int64_t githubUserId;
  std::string githubLogin;
  std::optional<std::string> displayName;
  std::optional<std::string> avatarUrl;
};

struct PublishedPackageInfo {
  std::string name;
  std::string repoFullName;
  std::string visibility; // "public" or "private"
  std::optional<std::string> description;
  std::optional<std::string> readmeText;
  std::optional<std::string> license;
  std::string latestVersion;
};

struct PublishedVersionInfo {
  std::string version;
  std::string releaseTag;
  int64_t githubReleaseId;
  int64_t githubAssetId;
  std::string assetName;
  int64_t assetSizeBytes;
  std::string downloadUrl;
  std::string sha256;
  std::string status; // "published"
  std::string publishedAt;
};

struct PublishResult {
  // Rich metadata extracted after publish
  PublishedUserInfo user;
  PublishedPackageInfo package;
  PublishedVersionInfo version;

  // Legacy fields
  std::string releaseUrl;
  std::string repository;
  std::string assetName;
  PackageMetadata metadata;
};

} // namespace yogi::publish