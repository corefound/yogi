#pragma once

#include <string>

namespace yogi::publish {

std::string createProjectTarball(const std::string& root, const std::string& packageName, const std::string& version);
void removeTarball(const std::string& tarPath);
std::string computeSha256(const std::string& filePath);

} // namespace yogi::publish
