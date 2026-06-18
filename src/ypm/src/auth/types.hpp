#pragma once

#include <string>
#include <optional>

namespace yogi::auth {

struct AuthToken {
  std::string provider;
  std::string accessToken;
  std::string username;
  std::string createdAt;
};

struct DeviceFlowResponse {
  std::string deviceCode;
  std::string userCode;
  std::string verificationUri;
  std::string verificationUriComplete;
  int expiresIn;
  int interval;
};

struct TokenResponse {
  std::string accessToken;
  std::string tokenType;
  std::string scope;
};

class TokenStore {
public:
  virtual ~TokenStore() = default;
  virtual std::optional<AuthToken> getToken() = 0;
  virtual void setToken(const AuthToken& token) = 0;
  virtual void deleteToken() = 0;
};

} // namespace yogi::auth