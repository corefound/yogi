#include "githubClient.hpp"
#include "diagnostics/errors.hpp"
#include <nlohmann/json.hpp>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
#include <sstream>

namespace yogi::github {
using json = nlohmann::json;

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

HttpResponse executeCurl(const std::string& url,
                         const std::string& method,
                         const std::string& body,
                         const std::vector<std::string>& headers,
                         const std::string& dataFile = "") {
  std::string cmd = "curl -sS -X " + method;
  for (const auto& h : headers) {
    cmd += " -H " + shellEscape(h);
  }
  if (!dataFile.empty()) {
    cmd += " --data-binary @" + shellEscape(dataFile);
  } else if (!body.empty()) {
    cmd += " -d " + shellEscape(body);
  }
  cmd += " -w " + shellEscape("\n%{http_code}");
  cmd += " " + shellEscape(url);

  FILE* pipe = popen(cmd.c_str(), "r");
  if (!pipe) {
    throw diagnostics::networkRequestFailed("failed to execute curl");
  }

  std::string result;
  char buffer[8192];
  while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
    result += buffer;
  }

  int status = pclose(pipe);
  if (status != 0) {
    throw diagnostics::networkRequestFailed("curl exited with status " + std::to_string(status));
  }

  if (result.size() < 4) {
    throw diagnostics::networkRequestFailed("empty response from curl");
  }

  size_t newlinePos = result.rfind('\n');
  if (newlinePos == std::string::npos) {
    throw diagnostics::networkRequestFailed("malformed curl response");
  }

  std::string bodyPart = result.substr(0, newlinePos);
  std::string statusPart = result.substr(newlinePos + 1);
  while (!statusPart.empty() && (statusPart.back() == '\n' || statusPart.back() == '\r')) {
    statusPart.pop_back();
  }

  HttpResponse response;
  response.status = std::stoi(statusPart);
  response.body = bodyPart;
  return response;
}

} // namespace

GitHubClient::GitHubClient(HttpCallback httpPost)
  : httpPost_(std::move(httpPost)) {}

std::optional<GitHubUser> GitHubClient::getAuthenticatedUser(const std::string& accessToken) {
  try {
    std::string response = httpGet("https://api.github.com/user", "Bearer " + accessToken);
    GitHubUser user = parseUser(response);
    return user;
  } catch (const diagnostics::YogiError&) {
    throw;
  } catch (const std::exception& e) {
    throw diagnostics::networkRequestFailed(e.what());
  }
}

DeviceCodeResponse GitHubClient::startDeviceFlow(const std::string& clientId) {
  std::string body = "client_id=" + clientId + "&scope=read:user";
  std::string response = httpPost_("https://github.com/login/device/code", body, "application/json");
  return parseDeviceCodeResponse(response);
}

AccessTokenResponse GitHubClient::pollForToken(const std::string& clientId, const std::string& deviceCode) {
  std::string body = "client_id=" + clientId + "&device_code=" + deviceCode + "&grant_type=urn:ietf:params:oauth:grant-type:device_code";
  std::string response = httpPost_("https://github.com/login/oauth/access_token", body, "application/json");
  return parseAccessTokenResponse(response);
}

std::optional<GitHubRepository> GitHubClient::getRepository(const std::string& owner,
                                                            const std::string& repo,
                                                            const std::string& accessToken) {
  HttpResponse response = httpRequest(
    "GET",
    "https://api.github.com/repos/" + owner + "/" + repo,
    "Bearer " + accessToken,
    "",
    "");
  if (response.status == 404) {
    return std::nullopt;
  }
  checkGitHubError(response, "get repository");
  return parseRepository(response.body);
}

GitHubRepository GitHubClient::createRepository(const std::string& name,
                                                const std::optional<std::string>& description,
                                                const std::string& accessToken) {
  json body;
  body["name"] = name;
  body["private"] = false;
  body["auto_init"] = false;
  if (description && !description->empty()) {
    body["description"] = *description;
  }

  HttpResponse response = httpRequest(
    "POST",
    "https://api.github.com/user/repos",
    "Bearer " + accessToken,
    body.dump(),
    "application/json");
  checkGitHubError(response, "create repository");
  return parseRepository(response.body);
}

std::vector<GitHubCollaborator> GitHubClient::getCollaborators(const std::string& owner,
                                                               const std::string& repo,
                                                               const std::string& accessToken) {
  HttpResponse response = httpRequest(
    "GET",
    "https://api.github.com/repos/" + owner + "/" + repo + "/collaborators",
    "Bearer " + accessToken,
    "",
    "");
  if (response.status == 404) {
    return {};
  }
  checkGitHubError(response, "get collaborators");

  json j = json::parse(response.body);
  std::vector<GitHubCollaborator> collaborators;
  if (!j.is_array()) {
    return collaborators;
  }

  for (const auto& item : j) {
    GitHubCollaborator collaborator;
    collaborator.login = item.value("login", "");
    if (item.contains("role_name") && item["role_name"].is_string()) {
      collaborator.role = item["role_name"].get<std::string>();
    } else {
      collaborator.role = "collaborator";
    }
    if (!collaborator.login.empty()) {
      collaborators.push_back(collaborator);
    }
  }
  return collaborators;
}

std::optional<std::string> GitHubClient::getReadme(const std::string& owner,
                                                   const std::string& repo,
                                                   const std::string& accessToken) {
  HttpResponse response = httpRequest(
    "GET",
    "https://api.github.com/repos/" + owner + "/" + repo + "/readme",
    "Bearer " + accessToken,
    "",
    "");
  if (response.status == 404) {
    return std::nullopt;
  }
  checkGitHubError(response, "get readme");

  json j = json::parse(response.body);
  if (!j.contains("content") || !j["content"].is_string()) {
    return std::nullopt;
  }

  std::string encoded = j["content"].get<std::string>();
  std::string decodeCmd = "printf %s " + shellEscape(encoded) + " | base64 -d 2>/dev/null";
  FILE* pipe = popen(decodeCmd.c_str(), "r");
  if (!pipe) {
    return std::nullopt;
  }

  std::string decoded;
  char buffer[4096];
  while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
    decoded += buffer;
  }
  pclose(pipe);
  return decoded;
}

std::optional<GitHubRelease> GitHubClient::getReleaseByTag(const std::string& owner,
                                                           const std::string& repo,
                                                           const std::string& tag,
                                                           const std::string& accessToken) {
  HttpResponse response = httpRequest(
    "GET",
    "https://api.github.com/repos/" + owner + "/" + repo + "/releases/tags/" + tag,
    "Bearer " + accessToken,
    "",
    "");
  if (response.status == 404) {
    return std::nullopt;
  }
  checkGitHubError(response, "get release by tag");
  return parseRelease(response.body);
}

GitHubRelease GitHubClient::createRelease(const std::string& owner,
                                          const std::string& repo,
                                          const std::string& tag,
                                          const std::string& title,
                                          const std::string& body,
                                          const std::string& accessToken,
                                          const std::string& targetCommitish) {
  json payload;
  payload["tag_name"] = tag;
  payload["name"] = title;
  payload["body"] = body;
  payload["draft"] = false;
  payload["prerelease"] = false;
  if (!targetCommitish.empty()) {
    payload["target_commitish"] = targetCommitish;
  }

  HttpResponse response = httpRequest(
    "POST",
    "https://api.github.com/repos/" + owner + "/" + repo + "/releases",
    "Bearer " + accessToken,
    payload.dump(),
    "application/json");
  checkGitHubError(response, "create release");
  return parseRelease(response.body);
}

GitHubAsset GitHubClient::uploadReleaseAsset(const std::string& uploadUrl,
                                              const std::string& assetName,
                                              const std::string& filePath,
                                              const std::string& accessToken) {
  std::string url = uploadUrl;
  const std::string marker = "{?name,label}";
  size_t pos = url.find(marker);
  if (pos != std::string::npos) {
    url.replace(pos, marker.size(), "?name=" + assetName);
  } else if (url.find('?') == std::string::npos) {
    url += "?name=" + assetName;
  } else {
    url += "&name=" + assetName;
  }

  HttpResponse response = httpUploadFile(url, "Bearer " + accessToken, filePath);
  checkGitHubError(response, "upload release asset");
  return parseAsset(response.body);
}

std::string GitHubClient::defaultHttpPost(const std::string& url, const std::string& body, const std::string& acceptType) {
  std::vector<std::string> headers = {
    "Accept: " + acceptType,
    "Content-Type: application/x-www-form-urlencoded",
    "User-Agent: yogi-pkg"
  };
  HttpResponse response = executeCurl(url, "POST", body, headers);
  if (response.status >= 400) {
    throw diagnostics::networkRequestFailed("HTTP " + std::to_string(response.status) + ": " + response.body);
  }
  return response.body;
}

HttpResponse GitHubClient::httpRequest(const std::string& method,
                                       const std::string& url,
                                       const std::string& authHeader,
                                       const std::string& body,
                                       const std::string& contentType) {
  std::vector<std::string> headers = {
    "Authorization: " + authHeader,
    "Accept: application/vnd.github+json",
    "User-Agent: yogi-pkg"
  };
  if (!contentType.empty()) {
    headers.push_back("Content-Type: " + contentType);
  }
  return executeCurl(url, method, body, headers);
}

HttpResponse GitHubClient::httpUploadFile(const std::string& url,
                                          const std::string& authHeader,
                                          const std::string& filePath) {
  std::vector<std::string> headers = {
    "Authorization: " + authHeader,
    "Accept: application/vnd.github+json",
    "Content-Type: application/octet-stream",
    "User-Agent: yogi-pkg"
  };
  return executeCurl(url, "POST", "", headers, filePath);
}

std::string GitHubClient::httpGet(const std::string& url, const std::string& authHeader) {
  HttpResponse response = httpRequest("GET", url, authHeader, "", "");
  if (response.status == 401 || response.status == 403) {
    if (response.body.find("Bad credentials") != std::string::npos) {
      throw diagnostics::gitHubTokenInvalid("token rejected by GitHub API");
    }
    if (response.status == 403 && response.body.find("rate limit") != std::string::npos) {
      throw diagnostics::gitHubRateLimited();
    }
  }
  if (response.status >= 400) {
    throw diagnostics::networkRequestFailed("HTTP " + std::to_string(response.status) + ": " + response.body);
  }
  return response.body;
}

void GitHubClient::checkGitHubError(const HttpResponse& response, const std::string& context) {
  if (response.status == 401 || response.status == 403) {
    if (response.body.find("Bad credentials") != std::string::npos) {
      throw diagnostics::gitHubTokenInvalid("token rejected while trying to " + context);
    }
    if (response.status == 403 && response.body.find("rate limit") != std::string::npos) {
      throw diagnostics::gitHubRateLimited();
    }
  }
  if (response.status == 422) {
    if (
      context == "create release" &&
      (
        response.body.find("already_exists") != std::string::npos ||
        response.body.find("already exists") != std::string::npos
      )
    ) {
      throw diagnostics::publishFailed(
        "GitHub release already exists. Each package version can only be published once.");
    }

    throw diagnostics::publishFailed("GitHub rejected " + context + ": " + response.body);
  }
  if (response.status >= 400) {
    throw diagnostics::networkRequestFailed(
      "GitHub API error during " + context + " (HTTP " + std::to_string(response.status) + "): " + response.body);
  }
}

GitHubUser GitHubClient::parseUser(const std::string& jsonStr) {
  json j = json::parse(jsonStr);
  GitHubUser user;
  user.login = j.value("login", "");
  user.id = j.value("id", 0);
  if (j.contains("avatar_url") && !j["avatar_url"].is_null())
    user.avatarUrl = j["avatar_url"].get<std::string>();
  if (j.contains("html_url") && !j["html_url"].is_null())
    user.htmlUrl = j["html_url"].get<std::string>();
  if (j.contains("name") && !j["name"].is_null())
    user.name = j["name"].get<std::string>();
  if (j.contains("email") && !j["email"].is_null())
    user.email = j["email"].get<std::string>();
  return user;
}

DeviceCodeResponse GitHubClient::parseDeviceCodeResponse(const std::string& jsonStr) {
  json j = json::parse(jsonStr);
  DeviceCodeResponse resp;
  resp.deviceCode = j.value("device_code", "");
  resp.userCode = j.value("user_code", "");
  resp.verificationUri = j.value("verification_uri", "");
  resp.verificationUriComplete = j.value("verification_uri_complete", "");
  resp.expiresIn = j.value("expires_in", 0);
  resp.interval = j.value("interval", 5);
  return resp;
}

AccessTokenResponse GitHubClient::parseAccessTokenResponse(const std::string& jsonStr) {
  json j = json::parse(jsonStr);
  AccessTokenResponse resp;
  resp.accessToken = j.value("access_token", "");
  resp.tokenType = j.value("token_type", "");
  resp.scope = j.value("scope", "");
  resp.error = j.value("error", "");
  resp.errorDescription = j.value("error_description", "");
  return resp;
}

GitHubRepository GitHubClient::parseRepository(const std::string& jsonStr) {
  json j = json::parse(jsonStr);
  GitHubRepository repo;
  repo.name = j.value("name", "");
  repo.fullName = j.value("full_name", "");
  repo.htmlUrl = j.value("html_url", "");
  repo.cloneUrl = j.value("clone_url", "");
  repo.isPrivate = j.value("private", false);
  if (j.contains("owner") && j["owner"].is_object()) {
    repo.ownerLogin = j["owner"].value("login", "");
  }
  if (j.contains("description") && !j["description"].is_null()) {
    repo.description = j["description"].get<std::string>();
  }
  return repo;
}

GitHubRelease GitHubClient::parseRelease(const std::string& jsonStr) {
  json j = json::parse(jsonStr);
  GitHubRelease release;
  release.id = j.value("id", 0);
  release.tagName = j.value("tag_name", "");
  release.name = j.value("name", "");
  release.htmlUrl = j.value("html_url", "");
  release.uploadUrl = j.value("upload_url", "");
  return release;
}

GitHubAsset GitHubClient::parseAsset(const std::string& jsonStr) {
  json j = json::parse(jsonStr);
  GitHubAsset asset;
  asset.id = j.value("id", 0);
  asset.name = j.value("name", "");
  asset.size = j.value("size", 0);
  asset.downloadUrl = j.value("browser_download_url", "");
  asset.contentType = j.value("content_type", "");
  if (j.contains("created_at") && !j["created_at"].is_null())
    asset.createdAt = j["created_at"].get<std::string>();
  if (j.contains("updated_at") && !j["updated_at"].is_null())
    asset.updatedAt = j["updated_at"].get<std::string>();
  return asset;
}

} // namespace yogi::github
