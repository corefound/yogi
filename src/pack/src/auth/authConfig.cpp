#include "authConfig.hpp"
#include <filesystem>
#include <cstdlib>

namespace yogi::auth {
namespace fs = std::filesystem;

std::string getAuthConfigDir() {
  const char* home = std::getenv("HOME");
  if (!home) {
    home = std::getenv("USERPROFILE");
  }
  if (!home) {
    return "";
  }

#if defined(__APPLE__)
  return std::string(home) + "/Library/Application Support/Yogi";
#elif defined(_WIN32)
  const char* appdata = std::getenv("APPDATA");
  if (appdata) {
    return std::string(appdata) + "/Yogi";
  }
  return std::string(home) + "/AppData/Roaming/Yogi";
#else
  const char* xdg = std::getenv("XDG_CONFIG_HOME");
  if (xdg) {
    return std::string(xdg) + "/yogi";
  }
  return std::string(home) + "/.config/yogi";
#endif
}

std::string getAuthConfigPath() {
  std::string dir = getAuthConfigDir();
  if (dir.empty()) {
    return "";
  }
  return dir + "/auth.json";
}

} // namespace yogi::auth