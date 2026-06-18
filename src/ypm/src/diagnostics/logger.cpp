#include "logger.hpp"
#include <iostream>

namespace yogi::diagnostics {

Logger::Logger(LogLevel level)
  : level_(level)
{}

bool Logger::shouldLog(LogLevel target) const {
  static const LogLevel order[] = {
    LogLevel::Debug,
    LogLevel::Info,
    LogLevel::Warn,
    LogLevel::Error,
  };
  int selfIdx = 0, targetIdx = 0;
  for (int i = 0; i < 4; i++) {
    if (order[i] == level_) selfIdx = i;
    if (order[i] == target) targetIdx = i;
  }
  return targetIdx >= selfIdx;
}

void Logger::debug(const std::string& message) {
  if (shouldLog(LogLevel::Debug))
    std::cerr << "[debug] " << message << std::endl;
}

void Logger::info(const std::string& message) {
  if (shouldLog(LogLevel::Info))
    std::cerr << "[info] " << message << std::endl;
}

void Logger::warn(const std::string& message) {
  if (shouldLog(LogLevel::Warn))
    std::cerr << "[warn] " << message << std::endl;
}

void Logger::error(const std::string& message) {
  if (shouldLog(LogLevel::Error))
    std::cerr << "[error] " << message << std::endl;
}

} // namespace yogi::diagnostics
