#include "login.hpp"
#include "auth/githubAuth.hpp"
#include "auth/tokenStore.hpp"
#include "auth/authConfig.hpp"
#include "diagnostics/errors.hpp"

namespace yogi::cli {

void loginCommand(diagnostics::Logger& logger) {
  std::string configPath = auth::getAuthConfigPath();
  if (configPath.empty()) {
    throw diagnostics::tokenStoreWriteFailed("", "could not determine config directory");
  }

  auth::FileTokenStore tokenStore(configPath);
  auth::GitHubAuth githubAuth;

  auto result = githubAuth.login(logger);

  if (!result.success || !result.token) {
    throw diagnostics::gitHubLoginFailed(result.error);
  }

  tokenStore.setToken(*result.token);

  logger.info("Logged in as " + result.token->username + ".");
}

} // namespace yogi::cli