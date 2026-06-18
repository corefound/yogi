#include "whoami.hpp"
#include "auth/tokenStore.hpp"
#include "auth/authConfig.hpp"
#include "github/githubClient.hpp"
#include "diagnostics/errors.hpp"
#include <iostream>

namespace yogi::cli {

void whoamiCommand(diagnostics::Logger& logger) {
  std::string configPath = auth::getAuthConfigPath();
  if (configPath.empty()) {
    throw diagnostics::tokenStoreReadFailed("", "could not determine config directory");
  }

  auth::FileTokenStore tokenStore(configPath);
  std::optional<auth::AuthToken> token = tokenStore.getToken();

  if (!token) {
    std::cout << "You are not logged in.\n";
    std::cout << "Run `yogi login` to authenticate with GitHub.\n";
    return;
  }

  github::GitHubClient client;
  std::optional<github::GitHubUser> user;
  try {
    user = client.getAuthenticatedUser(token->accessToken);
  } catch (const diagnostics::YogiError& e) {
    if (e.code == diagnostics::ErrorCode::GitHubTokenInvalid ||
        e.code == diagnostics::ErrorCode::NetworkRequestFailed) {
      std::cout << "Your GitHub token is invalid or expired.\n";
      std::cout << "Run `yogi login` to authenticate again.\n";
      return;
    }
    throw;
  }

  if (!user) {
    std::cout << "Your GitHub token is invalid or expired.\n";
    std::cout << "Run `yogi login` to authenticate again.\n";
    return;
  }

  std::cout << "Logged in as " + user->login + ".\n";
}

} // namespace yogi::cli