#include "manifest/validateManifest.hpp"
#include "diagnostics/errors.hpp"

namespace yogi::manifest {

Manifest validateManifest(const nlohmann::json& raw) {
  if (!raw.is_object())
    throw diagnostics::invalidManifest("<unknown>", "manifest must be a JSON object");

  if (!raw.contains("name") || !raw["name"].is_string() || raw["name"].get<std::string>().empty())
    throw diagnostics::invalidManifest("<unknown>", "\"name\" is required and must be a non-empty string");
  std::string name = raw["name"].get<std::string>();

  if (!raw.contains("version") || !raw["version"].is_string() || raw["version"].get<std::string>().empty())
    throw diagnostics::invalidManifest("<unknown>", "\"version\" is required and must be a non-empty string");
  std::string version = raw["version"].get<std::string>();

  std::optional<std::string> description;
  if (raw.contains("description") && raw["description"].is_string())
    description = raw["description"].get<std::string>();

  std::optional<std::string> license;
  if (raw.contains("license") && raw["license"].is_string())
    license = raw["license"].get<std::string>();

  std::optional<std::map<std::string, std::string>> dependencies;
  if (raw.contains("dependencies")) {
    if (!raw["dependencies"].is_object())
      throw diagnostics::invalidManifest("<unknown>", "\"dependencies\" must be an object");
    dependencies = std::map<std::string, std::string>();
    for (auto& [key, val] : raw["dependencies"].items()) {
      if (!val.is_string())
        throw diagnostics::invalidManifest("<unknown>", "dependency \"" + key + "\" must have a string version");
      (*dependencies)[key] = val.get<std::string>();
    }
  }

  std::optional<std::map<std::string, std::string>> devDependencies;
  if (raw.contains("devDependencies")) {
    if (!raw["devDependencies"].is_object())
      throw diagnostics::invalidManifest("<unknown>", "\"devDependencies\" must be an object");
    devDependencies = std::map<std::string, std::string>();
    for (auto& [key, val] : raw["devDependencies"].items()) {
      if (!val.is_string())
        throw diagnostics::invalidManifest("<unknown>", "devDependency \"" + key + "\" must have a string version");
      (*devDependencies)[key] = val.get<std::string>();
    }
  }

  std::optional<BuildConfig> build;
  if (raw.contains("build")) {
    if (!raw["build"].is_object())
      throw diagnostics::invalidManifest("<unknown>", "\"build\" must be an object");
    BuildConfig bc;
    if (raw["build"].contains("output") && raw["build"]["output"].is_string())
      bc.output = raw["build"]["output"].get<std::string>();
    if (raw["build"].contains("entry") && raw["build"]["entry"].is_string())
      bc.entry = raw["build"]["entry"].get<std::string>();
    build = bc;
  }

  Manifest m;
  m.name = name;
  m.version = version;
  m.description = description;
  m.license = license;
  m.dependencies = dependencies;
  m.devDependencies = devDependencies;
  m.build = build;
  return m;
}

} // namespace yogi::manifest
