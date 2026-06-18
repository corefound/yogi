#include "logout.hpp"
#include "auth/tokenStore.hpp"
#include "auth/authConfig.hpp"
#include "diagnostics/errors.hpp"

namespace yogi::cli {

void logoutCommand(diagnostics::Logger& logger) {
  std::string configPath = auth::getAuthConfigPath();
  if (configPath.empty()) {
    throw diagnostics::tokenStoreWriteFailed("", "could not determine config directory");
  }

  auth::FileTokenStore tokenStore(configPath);
  tokenStore.deleteToken();

  logger.info("Logged out successfully.");
}

} // namespace yogi::cli