#include "publish.hpp"
#include "auth/tokenStore.hpp"
#include "auth/authConfig.hpp"
#include "manifest/readManifest.hpp"
#include "fs/paths.hpp"
#include "fs/archive.hpp"
#include "github/githubClient.hpp"
#include "registry/registryClient.hpp"
#include "publish/packageMetadata.hpp"
#include "diagnostics/errors.hpp"
#include <filesystem>
#include <sstream>
#include <chrono>

namespace {
	std::string shellEscape(const std::string &value) {
		std::string escaped = "'";
		for (const char c: value) {
			if (c == '\'') {
				escaped += "'\\''";
			} else {
				escaped += c;
			}
		}
		escaped += "'";
		return escaped;
	}

	int runInDir(const std::string &root, const std::string &cmd) {
		std::ostringstream full;
		full << "cd " << shellEscape(root) << " && " << cmd;
		return std::system(full.str().c_str());
	}

	std::string captureInDir(const std::string &root, const std::string &cmd) {
		std::ostringstream full;
		full << "cd " << shellEscape(root) << " && " << cmd << " 2>/dev/null";
		FILE *pipe = popen(full.str().c_str(), "r");
		if (!pipe) return "";
		std::string result;
		char buffer[256];
		while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
			result += buffer;
		}
		pclose(pipe);
		while (!result.empty() && (result.back() == '\n' || result.back() == '\r')) {
			result.pop_back();
		}
		return result;
	}

	std::string currentBranch(const std::string &root) {
		std::string branch = captureInDir(root, "git branch --show-current");
		if (!branch.empty()) return branch;
		return "main";
	}

} // namespace

namespace yogi::cli {
	namespace fs = std::filesystem;

	void publishCommand(const std::string &root, diagnostics::Logger &logger) {
		auto manifest = manifest::readManifest(yogi::fs::resolveProjectPaths(root).manifestPath);

		std::string configPath = auth::getAuthConfigPath();
		if (configPath.empty()) {
			throw diagnostics::tokenStoreReadFailed("", "could not determine config directory");
		}

		auth::FileTokenStore tokenStore(configPath);
		std::optional<auth::AuthToken> token = tokenStore.getToken();

		if (!token) {
			throw diagnostics::gitHubTokenInvalid("not logged in. run 'yogi login' first");
		}

		logger.info("Publishing " + manifest.name + "@" + manifest.version + " to GitHub as " + token->username + "/" + manifest.name);

		auto paths = yogi::fs::resolveProjectPaths(root);

		std::string tag = "v" + manifest.version;

		// Ensure repository exists on GitHub first
		github::GitHubClient client;
		std::optional<github::GitHubRepository> repo;
		try {
			repo = client.getRepository(token->username, manifest.name, token->accessToken);
		} catch (const diagnostics::YogiError &) {
			throw;
		}

		if (!repo) {
			try {
				repo = client.createRepository(manifest.name, manifest.description, token->accessToken);
			} catch (const diagnostics::YogiError &e) {
				throw diagnostics::publishFailed(std::string("failed to create repository: ") + e.what());
			}

			std::string remoteUrl = "https://github.com/" + token->username + "/" + manifest.name + ".git";
			runInDir(root, "git remote remove origin 2>/dev/null; true");
			if (runInDir(root, "git remote add origin " + shellEscape(remoteUrl)) != 0) {
				throw diagnostics::fileSystemError(root, "failed to add remote origin");
			}
			if (runInDir(root, "git push -u origin " + shellEscape(currentBranch(root)) + " 2>&1") != 0 &&
				runInDir(root, "git push -u origin main 2>&1") != 0) {
				throw diagnostics::fileSystemError(root, "failed to push source to GitHub");
			}
		}

		// Remove stale local and remote tags if they exist from a previous failed run
		// runInDir(root, "git tag -d " + shellEscape(tag) + " 2>/dev/null; true");
		// runInDir(root, "git push origin :refs/tags/" + shellEscape(tag) + " 2>/dev/null; true");

		if (runInDir(root, "git tag -a " + shellEscape(tag) + " -m " + shellEscape("Release " + manifest.version)) != 0) {
			throw diagnostics::fileSystemError(root, "failed to create git tag: " + tag);
		}

		if (runInDir(root, "git push origin " + shellEscape(tag) + " 2>&1") != 0) {
			throw diagnostics::fileSystemError(root, "failed to push tag to GitHub: " + tag);
		}

		logger.info("Creating release " + tag + "...");
		std::string releaseTitle = "Release " + manifest.version;
		std::string releaseBody = "Release " + manifest.version + "\n\n" + manifest.description.value_or("");

		// Check if release already exists on GitHub before attempting creation
		if (auto existingRelease = client.getReleaseByTag(token->username, manifest.name, tag, token->accessToken)) {
			throw diagnostics::publishFailed(
				"release " + tag + " already exists at " + existingRelease->htmlUrl + ". "
				"Each version can only be published once.");
		}

		github::GitHubRelease release = client.createRelease(token->username, manifest.name, tag, releaseTitle, releaseBody, token->accessToken, currentBranch(root));

		logger.info("Release created: " + release.htmlUrl);

		std::string archiveName = manifest.name + "-" + manifest.version + ".tar.gz";
		std::string archivePath = (fs::temp_directory_path() / archiveName).string();

		logger.info("Creating archive " + archiveName + "...");
		std::vector<std::string> excludePatterns = {
			"packages/", "dist/", ".git/", ".DS_Store", "*.tar.gz"
		};
		try {
			yogi::fs::createTarGz(root, archivePath, excludePatterns);
		} catch (const diagnostics::YogiError &e) {
			std::error_code ec;
			fs::remove(archivePath, ec);
			throw diagnostics::fileSystemError(root, std::string("failed to create archive: ") + e.what());
		}

		logger.info("Uploading archive as release asset...");
		try {
			client.uploadReleaseAsset(release.uploadUrl, archiveName, archivePath, token->accessToken);
		} catch (const diagnostics::YogiError &e) {
			std::error_code ec;
			fs::remove(archivePath, ec);
			throw diagnostics::publishFailed(std::string("failed to upload asset: ") + e.what());
		}

		logger.info("Asset uploaded successfully!");

		// Get user info for registry notification
		github::GitHubUser ghUser = *client.getAuthenticatedUser(token->accessToken);

		// Build registry notification data
		publish::PublishResult registryResult;
		registryResult.user.githubUserId = ghUser.id;
		registryResult.user.githubLogin = ghUser.login;
		registryResult.user.displayName = ghUser.name;
		registryResult.user.avatarUrl = ghUser.avatarUrl;

		registryResult.package.name = manifest.name;
		registryResult.package.repoFullName = repo ? repo->fullName : token->username + "/" + manifest.name;
		registryResult.package.visibility = repo && repo->isPrivate ? "private" : "public";
		registryResult.package.description = manifest.description;
		registryResult.package.readmeText = publish::findLocalReadme(root);
		registryResult.package.license = manifest.license;
		registryResult.package.latestVersion = manifest.version;

		registryResult.version.version = manifest.version;
		registryResult.version.releaseTag = tag;
		registryResult.version.githubReleaseId = release.id;
		registryResult.version.githubAssetId = 0; // We don't capture asset ID in CLI path
		registryResult.version.assetName = archiveName;
		registryResult.version.assetSizeBytes = 0; // Not computed in CLI path
		registryResult.version.downloadUrl = "";
		registryResult.version.sha256 = "";
		registryResult.version.status = "published";
		registryResult.version.publishedAt = publish::currentTimestamp();

		try {
			registry::notifyRegistry(registryResult);
		} catch (...) {
			// Non-fatal
		}

		std::error_code ec;
		fs::remove(archivePath, ec);

		logger.info("Published " + manifest.name + "@" + manifest.version + " to " + token->username + "/" + manifest.name);
		logger.info("Release URL: " + release.htmlUrl);
	}

} // namespace yogi::cli