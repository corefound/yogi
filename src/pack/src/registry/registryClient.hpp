#pragma once

#include <string>
#include "publish/types.hpp"

namespace yogi::registry {

/// Send publish data to the registry server
void notifyRegistry(const publish::PublishResult& result, const std::string& serverUrl = "http://localhost:3456");

} // namespace yogi::registry