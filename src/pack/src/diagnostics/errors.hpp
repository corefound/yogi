#pragma once

#include <string>
#include <vector>
#include <stdexcept>

namespace yogi::diagnostics {

enum class ErrorCode {
  MissingManifest,
  InvalidManifest,
  UnsupportedVersionRange,
  DependencyConflict,
  MissingLockfile,
  MissingInstalledPackage,
  MissingYogic,
  CompilerFailure,
  MissingBuildOutput,
  FileSystemError,
  RegistryError,
  InternalError,
  GitHubLoginFailed,
  GitHubDeviceFlowExpired,
  GitHubAuthorizationPending,
  GitHubRateLimited,
  GitHubTokenInvalid,
  TokenStoreReadFailed,
  TokenStoreWriteFailed,
  BrowserOpenFailed,
  NetworkRequestFailed,
  NotAuthenticated,
  PublishFailed,
  RepositoryNameTaken,
};

class YogiError : public std::runtime_error {
public:
  ErrorCode code;
  std::vector<std::string> details;

  YogiError(ErrorCode code, const std::string& message, std::vector<std::string> details = {});
};

YogiError missingManifest(const std::string& path);
YogiError invalidManifest(const std::string& path, const std::string& parseError);
YogiError unsupportedVersionRange(const std::string& packageName, const std::string& range);
YogiError dependencyConflict(const std::string& packageName, const std::string& existing, const std::string& attempted);
YogiError missingLockfile(const std::string& path);
YogiError missingInstalledPackage(const std::string& name, const std::string& version);
YogiError missingYogic();
YogiError compilerFailure(const std::string& stderr);
YogiError missingBuildOutput(const std::string& path);
YogiError fileSystemError(const std::string& path, const std::string& detail);
YogiError registryError(const std::string& packageName, const std::string& detail);

YogiError gitHubLoginFailed(const std::string& detail);
YogiError gitHubDeviceFlowExpired();
YogiError gitHubAuthorizationPending();
YogiError gitHubRateLimited();
YogiError gitHubTokenInvalid(const std::string& detail);
YogiError tokenStoreReadFailed(const std::string& path, const std::string& detail);
YogiError tokenStoreWriteFailed(const std::string& path, const std::string& detail);
YogiError browserOpenFailed(const std::string& detail);
YogiError networkRequestFailed(const std::string& detail);
  YogiError notAuthenticated();
  YogiError publishFailed(const std::string& detail);
  YogiError versionAlreadyPublished(const std::string& name, const std::string& version);
  YogiError repositoryNameTaken(const std::string& name, const std::string& owner);

} // namespace yogi::diagnostics
