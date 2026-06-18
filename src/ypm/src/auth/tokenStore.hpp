#pragma once

#include "types.hpp"
#include <string>

namespace yogi::auth {

class FileTokenStore : public TokenStore {
public:
  explicit FileTokenStore(const std::string& configPath);
  std::optional<AuthToken> getToken() override;
  void setToken(const AuthToken& token) override;
  void deleteToken() override;

private:
  std::string configPath_;
  void ensureConfigDir();
};

} // namespace yogi::auth