#pragma once

#include <cstdio>

namespace yogi::platform {

inline FILE* openPipe(const char* command, const char* mode) {
#if defined(_WIN32)
  return _popen(command, mode);
#else
  return ::popen(command, mode);
#endif
}

inline int closePipe(FILE* pipe) {
#if defined(_WIN32)
  return _pclose(pipe);
#else
  return ::pclose(pipe);
#endif
}

} // namespace yogi::platform
