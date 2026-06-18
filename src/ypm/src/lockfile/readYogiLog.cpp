#include "lockfile/readYogiLog.hpp"
#include <fstream>
#include <sstream>
#include <nlohmann/json.hpp>

namespace yogi::lockfile {

std::optional<Lockfile> readYogiLog(const std::string& path) {
  std::ifstream file(path);
  if (!file.is_open())
    return std::nullopt;

  std::stringstream buffer;
  buffer << file.rdbuf();

  try {
    nlohmann::json j = nlohmann::json::parse(buffer.str());
    if (!j.is_object() || !j.contains("version") || !j["version"].is_string())
      return std::nullopt;
    if (!j.contains("packages") || !j["packages"].is_object())
      return std::nullopt;

    Lockfile lock;
    lock.version = j["version"].get<std::string>();

    for (auto& [key, val] : j["packages"].items()) {
      if (!val.is_object() || !val.contains("version") || !val["version"].is_string())
        continue;
      LockfileEntry entry;
      entry.version = val["version"].get<std::string>();
      if (val.contains("dependencies") && val["dependencies"].is_object()) {
        std::map<std::string, std::string> deps;
        for (auto& [dk, dv] : val["dependencies"].items()) {
          if (dv.is_string())
            deps[dk] = dv.get<std::string>();
        }
        entry.dependencies = deps;
      }
      if (val.contains("devDependencies") && val["devDependencies"].is_object()) {
        std::map<std::string, std::string> deps;
        for (auto& [dk, dv] : val["devDependencies"].items()) {
          if (dv.is_string())
            deps[dk] = dv.get<std::string>();
        }
        entry.devDependencies = deps;
      }
      lock.packages[key] = entry;
    }
    return lock;
  } catch (...) {
    return std::nullopt;
  }
}

} // namespace yogi::lockfile
