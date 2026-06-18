#include "githubConfig.hpp"
#include <cstdlib>

namespace yogi::auth {

std::string getGitHubClientId() {
  const char* env = std::getenv("YOGI_GITHUB_CLIENT_ID");
  if (env && *env) {
    return std::string(env);
  }
  return "Ov23li4hQ5gd0fhYnYEm";
}

} // namespace yogi::auth
