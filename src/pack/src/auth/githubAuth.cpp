#include "githubAuth.hpp"
#include "diagnostics/errors.hpp"
#include "auth/tokenStore.hpp"
#include "auth/authConfig.hpp"
#include "github/githubClient.hpp"
#include "githubConfig.hpp"
#include <iostream>
#include <string>
#include <optional>
#include <chrono>
#include <sstream>
#include <iomanip>
#include <thread>

namespace yogi::auth {

LoginResult GitHubAuth::login(yogi::diagnostics::Logger& logger) {
  std::string clientId = yogi::auth::getGitHubClientId();
  if (clientId.empty()) {
    return {
      false,
      std::nullopt,
      "No GitHub OAuth Client ID configured.\n"
      "Set the YOGI_GITHUB_CLIENT_ID environment variable.\n"
      "Create an OAuth App at: https://github.com/settings/developers"
    };
  }

  yogi::github::DeviceCodeResponse deviceCode;
  try {
    deviceCode = client_.startDeviceFlow(clientId);
  } catch (const yogi::diagnostics::YogiError& e) {
    return {false, std::nullopt, "Failed to start device flow: " + std::string(e.what())};
  } catch (const std::exception& e) {
    return {false, std::nullopt, "Failed to start device flow: " + std::string(e.what())};
  }

  openBrowser(deviceCode.verificationUri);

  std::cout << "\n🔐 GitHub Device Login\n";
  std::cout << "   Visit: " << deviceCode.verificationUri << "\n";
  std::cout << "   Enter code: " << deviceCode.userCode << "\n\n";
  std::cout << "Waiting for authorization";
  std::cout.flush();

  yogi::github::AccessTokenResponse tokenResponse;
  bool authorized = false;

  for (int i = 0; i < 60; ++i) {
    std::this_thread::sleep_for(std::chrono::seconds(deviceCode.interval));

    try {
      tokenResponse = client_.pollForToken(clientId, deviceCode.deviceCode);
    } catch (const yogi::diagnostics::YogiError& e) {
      return {false, std::nullopt, "Polling failed: " + std::string(e.what())};
    } catch (const std::exception& e) {
      return {false, std::nullopt, "Polling failed: " + std::string(e.what())};
    }

    if (tokenResponse.error == "authorization_pending") {
      std::cout << ".";
      std::cout.flush();
      continue;
    }
    if (tokenResponse.error == "slow_down") {
      std::cout << ".";
      std::cout.flush();
      std::this_thread::sleep_for(std::chrono::seconds(5));
      continue;
    }
    if (tokenResponse.error == "expired_token") {
      return {false, std::nullopt, "Device code expired. Please try again."};
    }
    if (tokenResponse.error == "access_denied") {
      return {false, std::nullopt, "Authorization denied by user."};
    }
    if (!tokenResponse.accessToken.empty()) {
      authorized = true;
      break;
    }
  }

  if (!authorized || tokenResponse.accessToken.empty()) {
    return {false, std::nullopt, "Authorization timed out. Please try again."};
  }

  std::cout << "\n\n✓ Authorization successful!\n\n";

  std::optional<yogi::github::GitHubUser> user;
  try {
    user = client_.getAuthenticatedUser(tokenResponse.accessToken);
  } catch (const yogi::diagnostics::YogiError& e) {
    if (e.code == yogi::diagnostics::ErrorCode::GitHubTokenInvalid ||
        e.code == yogi::diagnostics::ErrorCode::NetworkRequestFailed) {
      return {false, std::nullopt, "Failed to fetch user info. Please try again."};
    }
    return {false, std::nullopt, "Failed to fetch user info: " + std::string(e.what())};
  } catch (const std::exception& e) {
    return {false, std::nullopt, "Failed to fetch user info: " + std::string(e.what())};
  }

  if (!user) {
    return {false, std::nullopt, "Failed to get user information"};
  }

  AuthToken authToken;
  authToken.provider = "github";
  authToken.accessToken = tokenResponse.accessToken;
  authToken.username = user->login;

  auto now = std::chrono::system_clock::now();
  auto nowTimeT = std::chrono::system_clock::to_time_t(now);
  std::stringstream ss;
  std::tm* gmt = std::gmtime(&nowTimeT);
  ss << std::put_time(gmt, "%Y-%m-%dT%H:%M:%SZ");
  authToken.createdAt = ss.str();

  std::string configPath = getAuthConfigPath();
  if (configPath.empty()) {
    return {false, std::nullopt, "Could not determine config directory"};
  }

  try {
    FileTokenStore tokenStore(configPath);
    tokenStore.setToken(authToken);
  } catch (const yogi::diagnostics::YogiError& e) {
    return {false, std::nullopt, std::string("Failed to save token: ") + e.what()};
  }

  return {true, authToken, ""};
}

void GitHubAuth::openBrowser(const std::string& url) {
#if defined(__APPLE__)
  std::string cmd = "open '" + url + "' >/dev/null 2>&1 &";
#elif defined(_WIN32)
  std::string cmd = "start \"\" \"" + url + "\" >nul 2>&1";
#else
  std::string cmd = "xdg-open '" + url + "' >/dev/null 2>&1 &";
#endif
  std::system(cmd.c_str());
}

void GitHubAuth::printTokenInstructions() {
  std::cout << "\nOpening GitHub login in your browser...\n";
  std::cout << "\nIf the browser did not open, visit:\n";
  std::cout << "https://github.com/login/device\n\n";
  std::cout << "Enter the 6-digit code shown in the terminal when prompted.\n\n";
}

} // namespace yogi::auth
