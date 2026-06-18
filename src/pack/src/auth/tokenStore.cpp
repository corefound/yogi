#include "tokenStore.hpp"
#include "authConfig.hpp"
#include "diagnostics/errors.hpp"
#include <fstream>
#include <filesystem>
#include <nlohmann/json.hpp>
#include <chrono>
#include <iomanip>
#include <sstream>

namespace yogi::auth {
namespace fs = std::filesystem;
using json = nlohmann::json;

FileTokenStore::FileTokenStore(const std::string& configPath)
  : configPath_(configPath) {}

void FileTokenStore::ensureConfigDir() {
  fs::path dir = fs::path(configPath_).parent_path();
  std::error_code ec;
  fs::create_directories(dir, ec);
  if (ec) {
    throw diagnostics::tokenStoreWriteFailed(configPath_, ec.message());
  }
}

std::optional<AuthToken> FileTokenStore::getToken() {
  if (!fs::exists(configPath_)) {
    return std::nullopt;
  }

  std::ifstream file(configPath_);
  if (!file.is_open()) {
    throw diagnostics::tokenStoreReadFailed(configPath_, "cannot open file");
  }

  try {
    json j;
    file >> j;

    AuthToken token;
    token.provider = j.value("provider", "");
    token.accessToken = j.value("accessToken", "");
    token.username = j.value("username", "");
    token.createdAt = j.value("createdAt", "");

    if (token.provider.empty() || token.accessToken.empty()) {
      return std::nullopt;
    }

    return token;
  } catch (const json::parse_error& e) {
    throw diagnostics::tokenStoreReadFailed(configPath_, "invalid JSON: " + std::string(e.what()));
  } catch (const std::exception& e) {
    throw diagnostics::tokenStoreReadFailed(configPath_, e.what());
  }
}

void FileTokenStore::setToken(const AuthToken& token) {
  ensureConfigDir();

  json j;
  j["provider"] = token.provider;
  j["accessToken"] = token.accessToken;
  j["username"] = token.username;
  j["createdAt"] = token.createdAt;

  std::string tempPath = configPath_ + ".tmp";
  {
    std::ofstream file(tempPath);
    if (!file.is_open()) {
      throw diagnostics::tokenStoreWriteFailed(configPath_, "cannot open temp file for writing");
    }
    file << j.dump(2);
  }

  std::error_code ec;
  fs::rename(tempPath, configPath_, ec);
  if (ec) {
    fs::remove(tempPath, ec);
    throw diagnostics::tokenStoreWriteFailed(configPath_, ec.message());
  }

#if !defined(_WIN32)
  fs::permissions(configPath_, fs::perms::owner_read | fs::perms::owner_write, ec);
#endif
}

void FileTokenStore::deleteToken() {
  std::error_code ec;
  if (fs::exists(configPath_)) {
    fs::remove(configPath_, ec);
    if (ec) {
      throw diagnostics::tokenStoreWriteFailed(configPath_, ec.message());
    }
  }
}

} // namespace yogi::auth