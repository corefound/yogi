#include "lockfile/writeYogiLog.hpp"
#include <fstream>
#include <nlohmann/json.hpp>

namespace yogi::lockfile {

void writeYogiLog(const std::string& path, const Lockfile& lockfile) {
  nlohmann::json j;
  j["version"] = lockfile.version;

  nlohmann::json pkgs = nlohmann::json::object();
  // packages are already sorted by using std::map
  for (const auto& [key, entry] : lockfile.packages) {
    nlohmann::json e;
    e["version"] = entry.version;
    if (entry.dependencies) {
      nlohmann::json deps = nlohmann::json::object();
      for (const auto& [dk, dv] : *entry.dependencies)
        deps[dk] = dv;
      e["dependencies"] = deps;
    }
    if (entry.devDependencies) {
      nlohmann::json deps = nlohmann::json::object();
      for (const auto& [dk, dv] : *entry.devDependencies)
        deps[dk] = dv;
      e["devDependencies"] = deps;
    }
    pkgs[key] = e;
  }
  j["packages"] = pkgs;

  std::ofstream file(path);
  file << j.dump(2) << "\n";
}

} // namespace yogi::lockfile
