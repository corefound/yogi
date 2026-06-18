#pragma once

#include <string>
#include <map>
#include <optional>

namespace yogi::lockfile {

struct LockfileEntry {
  std::string version;
  std::optional<std::map<std::string, std::string>> dependencies;
  std::optional<std::map<std::string, std::string>> devDependencies;
};

struct Lockfile {
  std::string version;
  std::map<std::string, LockfileEntry> packages;
};

} // namespace yogi::lockfile
