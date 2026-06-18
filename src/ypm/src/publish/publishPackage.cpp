#include "publishPackage.hpp"
#include "createTarball.hpp"
#include "pushRepository.hpp"
#include "packageMetadata.hpp"
#include "manifest/readManifest.hpp"
#include "auth/tokenStore.hpp"
#include "auth/authConfig.hpp"
#include "github/githubClient.hpp"
#include "registry/registryClient.hpp"
#include "fs/paths.hpp"
#include "diagnostics/errors.hpp"
#include <algorithm>

namespace yogi::publish {

static github::GitHubRepository ensureRepository(github::GitHubClient& client,
                                                 const std::string& owner,
                                                 const std::string& repoName,
                                                 const std::optional<std::string>& description,
                                                 const std::string& accessToken) {
  auto existing = client.getRepository(owner, repoName, accessToken);
  if (existing) {
    if (existing->ownerLogin != owner) {
      throw diagnostics::repositoryNameTaken(repoName, existing->ownerLogin);
    }
    return *existing;
  }

  try {
    return client.createRepository(repoName, description, accessToken);
  } catch (const diagnostics::YogiError& e) {
    if (e.code == diagnostics::ErrorCode::PublishFailed) {
      throw diagnostics::repositoryNameTaken(repoName, owner);
    }
    throw;
  }
}

PublishResult publishPackage(const std::string& root, diagnostics::Logger& logger) {
  auto paths = fs::resolveProjectPaths(root);
  auto manifest = manifest::readManifest(paths.manifestPath);

  std::string configPath = auth::getAuthConfigPath();
  if (configPath.empty()) {
    throw diagnostics::tokenStoreReadFailed("", "could not determine config directory");
  }

  auth::FileTokenStore tokenStore(configPath);
  auto token = tokenStore.getToken();
  if (!token) {
    throw diagnostics::notAuthenticated();
  }

  std::string repoName = validateGitHubRepoName(manifest.name);
  std::string releaseTag = normalizeReleaseTag(manifest.version);
  std::string assetName = repoName + "-" + manifest.version + ".tar.gz";

  github::GitHubClient client;
  auto user = client.getAuthenticatedUser(token->accessToken);
  if (!user || user->login.empty()) {
    throw diagnostics::gitHubTokenInvalid("could not resolve authenticated GitHub user");
  }

  std::string owner = user->login;
  logger.info("Publishing " + manifest.name + "@" + manifest.version + " to GitHub as " + owner + "/" + repoName);

  auto existingRelease = client.getReleaseByTag(owner, repoName, releaseTag, token->accessToken);
  if (existingRelease) {
    throw diagnostics::publishFailed(
      "release " + releaseTag + " already exists at " + existingRelease->htmlUrl);
  }

  std::string tarPath = createProjectTarball(root, repoName, manifest.version);

  try {
    auto repository = ensureRepository(client, owner, repoName, manifest.description, token->accessToken);
    if (repository.name.empty()) {
      throw diagnostics::publishFailed("failed to resolve GitHub repository for " + repoName);
    }

    std::string branch = pushProjectToGitHub(root, owner, repoName, manifest.version, token->accessToken, logger);

    std::string releaseBody = "Yogi package release " + manifest.name + "@" + manifest.version;
    if (manifest.description && !manifest.description->empty()) {
      releaseBody += "\n\n" + *manifest.description;
    }

    auto release = client.createRelease(
      owner,
      repoName,
      releaseTag,
      manifest.version,
      releaseBody,
      token->accessToken,
      branch);

    auto asset = client.uploadReleaseAsset(release.uploadUrl, assetName, tarPath, token->accessToken);

    // Compute SHA256 of the tarball
    std::string sha256 = computeSha256(tarPath);

    // Read local readme
    std::optional<std::string> readmeContent = findLocalReadme(root);

    // Build rich metadata result
    PublishResult result;

    // User info
    result.user.githubUserId = user->id;
    result.user.githubLogin = user->login;
    result.user.displayName = user->name;
    result.user.avatarUrl = user->avatarUrl;

    // Package info
    result.package.name = manifest.name;
    result.package.repoFullName = repository.fullName;
    result.package.visibility = repository.isPrivate ? "private" : "public";
    result.package.description = manifest.description;
    result.package.readmeText = readmeContent;
    result.package.license = manifest.license;
    result.package.latestVersion = manifest.version;

    // Version info
    result.version.version = manifest.version;
    result.version.releaseTag = releaseTag;
    result.version.githubReleaseId = release.id;
    result.version.githubAssetId = asset.id;
    result.version.assetName = assetName;
    result.version.assetSizeBytes = asset.size;
    result.version.downloadUrl = asset.downloadUrl;
    result.version.sha256 = sha256;
    result.version.status = "published";
    result.version.publishedAt = currentTimestamp();

    // Legacy metadata
    PackageMetadata metadata;
    metadata.name = manifest.name;
    metadata.version = manifest.version;
    metadata.description = manifest.description;
    metadata.owner = owner;
    metadata.repository = repository.htmlUrl;
    metadata.publishedAt = result.version.publishedAt;
    metadata.readme = readmeContent;

    auto collaborators = client.getCollaborators(owner, repoName, token->accessToken);
    for (const auto& collaborator : collaborators) {
      metadata.collaborators.push_back(collaborator.login);
    }
    std::sort(metadata.collaborators.begin(), metadata.collaborators.end());
    metadata.collaborators.erase(
      std::unique(metadata.collaborators.begin(), metadata.collaborators.end()),
      metadata.collaborators.end());

    auto previous = loadPackageMetadata(manifest.name);
    if (previous) {
      metadata.releases = previous->releases;
    }

    PublishedRelease publishedRelease;
    publishedRelease.version = manifest.version;
    publishedRelease.tag = releaseTag;
    publishedRelease.assetName = assetName;
    publishedRelease.publishedAt = result.version.publishedAt;
    metadata.releases.push_back(publishedRelease);

    savePackageMetadata(metadata);

    result.releaseUrl = release.htmlUrl;
    result.repository = repository.htmlUrl;
    result.assetName = assetName;
    result.metadata = metadata;

    // Notify registry server
    registry::notifyRegistry(result);

    removeTarball(tarPath);
    return result;
  } catch (...) {
    removeTarball(tarPath);
    throw;
  }
}

} // namespace yogi::publish