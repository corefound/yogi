#pragma once

#include <cstdint>
#include <string>
#include <optional>
#include <vector>

namespace yogi::github {

struct GitHubUser {
  std::string login;
  int64_t id;
  std::optional<std::string> avatarUrl;
  std::optional<std::string> htmlUrl;
  std::optional<std::string> name;
  std::optional<std::string> email;
};

struct DeviceCodeResponse {
  std::string deviceCode;
  std::string userCode;
  std::string verificationUri;
  std::string verificationUriComplete;
  int expiresIn;
  int interval;
};

struct AccessTokenResponse {
  std::string accessToken;
  std::string tokenType;
  std::string scope;
  std::string error;
  std::string errorDescription;
};

struct GitHubRepository {
  std::string name;
  std::string fullName;
  std::string htmlUrl;
  std::string cloneUrl;
  std::string ownerLogin;
  std::optional<std::string> description;
  bool isPrivate;
};

struct GitHubCollaborator {
  std::string login;
  std::string role;
};

struct GitHubAsset {
  int64_t id;
  std::string name;
  int64_t size;
  std::string downloadUrl;
  std::string contentType;
  std::string createdAt;
  std::string updatedAt;
};

struct GitHubRelease {
  int64_t id;
  std::string tagName;
  std::string name;
  std::string htmlUrl;
  std::string uploadUrl;
};

struct HttpResponse {
  int status;
  std::string body;
};

} // namespace yogi::github