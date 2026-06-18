#include "cacheKeys.hpp"
#include <sstream>
#include <iomanip>

namespace yogi::cache {
namespace {
  // FNV-1a hash for simple content fingerprinting
  std::string fnv1aHash(const std::string& content) {
    uint64_t hash = 14695981039346656037ULL;
    for (unsigned char c : content) {
      hash ^= c;
      hash *= 1099511628211ULL;
    }
    std::stringstream ss;
    ss << std::hex << std::setw(8) << std::setfill('0') << hash;
    return ss.str();
  }
}

std::string cacheKey(const std::string& name, const std::string& version) {
  return name + "@" + version;
}

std::string artifactFileName(const std::string& name, const std::string& version, const std::string& hash) {
  std::string base = "lib" + name + "@" + version;
  if (!hash.empty())
    return base + "+" + hash + ".a";
  return base + ".a";
}

std::string sourceHash(const std::string& content) {
  return fnv1aHash(content);
}

} // namespace yogi::cache
