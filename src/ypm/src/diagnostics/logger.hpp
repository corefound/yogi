#pragma once

#include <string>

namespace yogi::diagnostics {

enum class LogLevel {
  Debug,
  Info,
  Warn,
  Error,
};

class Logger {
public:
  explicit Logger(LogLevel level = LogLevel::Info);
  void debug(const std::string& message);
  void info(const std::string& message);
  void warn(const std::string& message);
  void error(const std::string& message);

private:
  LogLevel level_;
  bool shouldLog(LogLevel target) const;
};

} // namespace yogi::diagnostics
