#pragma once

#include "types.hpp"
#include <string>

namespace yogi::publish {

std::string getRegistryDir();
std::string metadataPathForPackage(const std::string& packageName);
void savePackageMetadata(const PackageMetadata& metadata);
std::optional<PackageMetadata> loadPackageMetadata(const std::string& packageName);
std::optional<std::string> findLocalReadme(const std::string& root);
std::string normalizeReleaseTag(const std::string& version);
std::string validateGitHubRepoName(const std::string& name);
std::string currentTimestamp();

} // namespace yogi::publish
