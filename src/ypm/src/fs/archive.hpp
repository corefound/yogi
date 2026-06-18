#pragma once

#include <string>
#include <vector>

namespace yogi::fs {

bool createTarGz(const std::string& sourceDir, const std::string& outputPath,
                 const std::vector<std::string>& excludePatterns = {});

} // namespace yogi::fs