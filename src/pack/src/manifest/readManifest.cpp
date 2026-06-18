#include "manifest/readManifest.hpp"
#include "manifest/validateManifest.hpp"
#include "diagnostics/errors.hpp"
#include <fstream>
#include <sstream>
#include <nlohmann/json.hpp>

namespace yogi::manifest {

Manifest readManifest(const std::string& path) {
  std::ifstream file(path);
  if (!file.is_open()) {
    throw diagnostics::missingManifest(path);
  }
  std::stringstream buffer;
  buffer << file.rdbuf();
  std::string raw = buffer.str();

  nlohmann::json parsed;
  try {
    parsed = nlohmann::json::parse(raw);
  } catch (const nlohmann::json::parse_error& e) {
    throw diagnostics::invalidManifest(path, e.what());
  }

  return validateManifest(parsed);
}

} // namespace yogi::manifest
