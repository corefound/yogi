#pragma once

#include "types.hpp"
#include "diagnostics/logger.hpp"
#include "github/githubClient.hpp"
#include <string>
#include <optional>

namespace yogi::auth {

struct LoginResult {
  bool success;
  std::optional<AuthToken> token;
  std::string error;
};

class GitHubAuth {
public:
  LoginResult login(yogi::diagnostics::Logger& logger);
  void openBrowser(const std::string& url);
  void printTokenInstructions();
  std::optional<AuthToken> validateToken(const std::string& token, yogi::diagnostics::Logger& logger);

private:
  static constexpr const char* GITHUB_PAT_URL = "https://github.com/settings/tokens/new?scopes=repo,admin:ssh_signing_key,admin:enterprise,audit_log,codespace,copilot,project,admin:gpg_key,admin:org_hook,gist,notifications,user,delete_repo,write:discussion,admin:org,workflow,write:packages,delete:packages,admin:public_key,admin:repo_hook,read:user&description=Yogi%20Package%20Manager";
  yogi::github::GitHubClient client_;
};

} // namespace yogi::auth