#pragma once

#include <string>
#include <map>
#include <optional>

namespace yogi::manifest {

struct BuildConfig {
  std::optional<std::string> output;
  std::optional<std::string> entry;
};

struct Manifest {
  std::string name;
  std::string version;
  std::optional<std::string> description;
  std::optional<std::string> license;
  std::optional<std::map<std::string, std::string>> dependencies;
  std::optional<std::map<std::string, std::string>> devDependencies;
  std::optional<BuildConfig> build;
};

} // namespace yogi::manifest
