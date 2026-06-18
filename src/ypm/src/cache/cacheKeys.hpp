#pragma once

#include <string>

namespace yogi::cache {

std::string cacheKey(const std::string& name, const std::string& version);
std::string artifactFileName(const std::string& name, const std::string& version, const std::string& hash = "");
std::string sourceHash(const std::string& content);

} // namespace yogi::cache
