#pragma once

#include <string>

namespace yogi::fs {

void ensureDir(const std::string& dir);
void writeFile(const std::string& path, const std::string& content);
std::string readFile(const std::string& path);
bool fileExists(const std::string& path);
void removeDir(const std::string& dir);
void removeFile(const std::string& path);

} // namespace yogi::fs
