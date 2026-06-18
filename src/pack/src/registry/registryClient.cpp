#include "registryClient.hpp"
#include "diagnostics/errors.hpp"
#include <nlohmann/json.hpp>
#include <cstdio>
#include <sstream>
#include <string>
#include <iostream>

namespace yogi::registry {
	using json = nlohmann::json;

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

	} // namespace

	void notifyRegistry(const publish::PublishResult &result, const std::string &serverUrl) {
		// Build JSON payload
		json payload;

		// User info
		payload["user"]["githubUserId"] = result.user.githubUserId;
		payload["user"]["githubLogin"] = result.user.githubLogin;
		if (result.user.displayName) payload["user"]["displayName"] = *result.user.displayName;
		if (result.user.avatarUrl) payload["user"]["avatarUrl"] = *result.user.avatarUrl;

		// Package info
		payload["package"]["name"] = result.package.name;
		payload["package"]["repoFullName"] = result.package.repoFullName;
		payload["package"]["visibility"] = result.package.visibility;
		if (result.package.description) payload["package"]["description"] = *result.package.description;
		if (result.package.readmeText) payload["package"]["readmeText"] = *result.package.readmeText;
		if (result.package.license) payload["package"]["license"] = *result.package.license;
		payload["package"]["latestVersion"] = result.package.latestVersion;

		// Version info
		payload["version"]["version"] = result.version.version;
		payload["version"]["releaseTag"] = result.version.releaseTag;
		payload["version"]["githubReleaseId"] = result.version.githubReleaseId;
		payload["version"]["githubAssetId"] = result.version.githubAssetId;
		payload["version"]["assetName"] = result.version.assetName;
		payload["version"]["assetSizeBytes"] = result.version.assetSizeBytes;
		payload["version"]["downloadUrl"] = result.version.downloadUrl;
		payload["version"]["sha256"] = result.version.sha256;
		payload["version"]["status"] = result.version.status;
		payload["version"]["publishedAt"] = result.version.publishedAt;

		std::cout << payload.dump(2) << std::endl;


		std::string jsonStr = payload.dump();

		// Build curl command
		std::ostringstream cmd;
		cmd << "curl -sS -X POST "
		<< shellEscape(serverUrl + "/api/publish")
		<< " -H 'Content-Type: application/json'"
		<< " -d " << shellEscape(jsonStr)
		<< " -w " << shellEscape("\n%{http_code}")
		<< " 2>/dev/null";

		FILE *pipe = popen(cmd.str().c_str(), "r");
		if (!pipe) {
			throw diagnostics::networkRequestFailed(
				"failed to notify registry server (could not execute curl)");
		}

		std::string resultStr;
		char buffer[1024];
		while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
			resultStr += buffer;
		}
		int exitCode = pclose(pipe);

		// Extract HTTP status code from last line
		size_t newlinePos = resultStr.rfind('\n');
		if (newlinePos == std::string::npos) {
			throw diagnostics::networkRequestFailed(
				"failed to notify registry server: malformed response");
		}

		std::string statusPart = resultStr.substr(newlinePos + 1);
		while (!statusPart.empty() && (statusPart.back() == '\n' || statusPart.back() == '\r')) {
			statusPart.pop_back();
		}

		if (exitCode != 0 || statusPart.empty()) {
			throw diagnostics::networkRequestFailed(
				"failed to notify registry server: curl exited with code " + std::to_string(exitCode));
		}

		int httpStatus = std::stoi(statusPart);
		if (httpStatus == 409) {
			// Parse error message from response body
			std::string body = resultStr.substr(0, newlinePos);
			auto json = nlohmann::json::parse(body);
			std::string msg = json.value("error", "conflict error from registry server");
			throw diagnostics::publishFailed("Registry rejected publish: " + msg);
		}
		if (httpStatus >= 400) {
			throw diagnostics::networkRequestFailed(
				"registry server returned HTTP " + statusPart + " for publish notification");
		}
	}

} // namespace yogi::registry