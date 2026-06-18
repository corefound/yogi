#include "errors.hpp"

namespace yogi::diagnostics {

YogiError::YogiError(ErrorCode code, const std::string& message, std::vector<std::string> details)
  : std::runtime_error(message)
  , code(code)
  , details(std::move(details))
{}

// static std::string codeName(ErrorCode code) {
//   switch (code) {
//     case ErrorCode::MissingManifest: return "MISSING_MANIFEST";
//     case ErrorCode::InvalidManifest: return "INVALID_MANIFEST";
//     case ErrorCode::UnsupportedVersionRange: return "UNSUPPORTED_VERSION_RANGE";
//     case ErrorCode::DependencyConflict: return "DEPENDENCY_CONFLICT";
//     case ErrorCode::MissingLockfile: return "MISSING_LOCKFILE";
//     case ErrorCode::MissingInstalledPackage: return "MISSING_INSTALLED_PACKAGE";
//     case ErrorCode::MissingYogic: return "MISSING_YOGIC";
//     case ErrorCode::CompilerFailure: return "COMPILER_FAILURE";
//     case ErrorCode::MissingBuildOutput: return "MISSING_BUILD_OUTPUT";
//     case ErrorCode::FileSystemError: return "FILESYSTEM_ERROR";
//     case ErrorCode::RegistryError: return "REGISTRY_ERROR";
//     case ErrorCode::InternalError: return "INTERNAL_ERROR";
//     case ErrorCode::GitHubLoginFailed: return "GITHUB_LOGIN_FAILED";
//     case ErrorCode::GitHubDeviceFlowExpired: return "GITHUB_DEVICE_FLOW_EXPIRED";
//     case ErrorCode::GitHubAuthorizationPending: return "GITHUB_AUTHORIZATION_PENDING";
//     case ErrorCode::GitHubRateLimited: return "GITHUB_RATE_LIMITED";
//     case ErrorCode::GitHubTokenInvalid: return "GITHUB_TOKEN_INVALID";
//     case ErrorCode::TokenStoreReadFailed: return "TOKEN_STORE_READ_FAILED";
//     case ErrorCode::TokenStoreWriteFailed: return "TOKEN_STORE_WRITE_FAILED";
//     case ErrorCode::BrowserOpenFailed: return "BROWSER_OPEN_FAILED";
//     case ErrorCode::NetworkRequestFailed: return "NETWORK_REQUEST_FAILED";
//     case ErrorCode::NotAuthenticated: return "NOT_AUTHENTICATED";
//     case ErrorCode::PublishFailed: return "PUBLISH_FAILED";
//     case ErrorCode::RepositoryNameTaken: return "REPOSITORY_NAME_TAKEN";
//   }
//   return "UNKNOWN";
// }

YogiError missingManifest(const std::string& path) {
  return YogiError(ErrorCode::MissingManifest,
    "Missing manifest file: " + path,
    {"Expected a yogi.json at " + path});
}

YogiError invalidManifest(const std::string& path, const std::string& parseError) {
  return YogiError(ErrorCode::InvalidManifest,
    "Invalid manifest at " + path + ": " + parseError);
}

YogiError unsupportedVersionRange(const std::string& packageName, const std::string& range) {
  return YogiError(ErrorCode::UnsupportedVersionRange,
    "Unsupported version range for package \"" + packageName + "\": \"" + range + "\"",
    {"Supported forms: \"1.2.0\" (exact), \"^1.2.0\" (compatible major), \"~1.2.0\" (compatible minor)"});
}

YogiError dependencyConflict(const std::string& packageName, const std::string& existing, const std::string& attempted) {
  return YogiError(ErrorCode::DependencyConflict,
    "Dependency conflict for \"" + packageName + "\": requires " + attempted + " but " + existing + " is already resolved");
}

YogiError missingLockfile(const std::string& path) {
  return YogiError(ErrorCode::MissingLockfile,
    "Missing lockfile: " + path,
    {"Run \"yogi install\" to generate " + path});
}

YogiError missingInstalledPackage(const std::string& name, const std::string& version) {
  return YogiError(ErrorCode::MissingInstalledPackage,
    "Missing installed package " + name + "@" + version,
    {"Run \"yogi install\" to install missing packages"});
}

YogiError missingYogic() {
  return YogiError(ErrorCode::MissingYogic,
    "Missing yogic compiler",
    {"Ensure yogic is installed and available at packages/bin/yogic or on the system PATH"});
}

YogiError compilerFailure(const std::string& stderr) {
  return YogiError(ErrorCode::CompilerFailure,
    "Compiler process failed",
    {stderr});
}

YogiError missingBuildOutput(const std::string& path) {
  return YogiError(ErrorCode::MissingBuildOutput,
    "Missing build output at " + path,
    {"The compiler did not produce the expected output file"});
}

YogiError fileSystemError(const std::string& path, const std::string& detail) {
  return YogiError(ErrorCode::FileSystemError,
    "File system error at " + path + ": " + detail);
}

YogiError registryError(const std::string& packageName, const std::string& detail) {
  return YogiError(ErrorCode::RegistryError,
    "Registry error for package \"" + packageName + "\": " + detail);
}

YogiError gitHubLoginFailed(const std::string& detail) {
  return YogiError(ErrorCode::GitHubLoginFailed,
    "GitHub login failed: " + detail);
}

YogiError gitHubDeviceFlowExpired() {
  return YogiError(ErrorCode::GitHubDeviceFlowExpired,
    "GitHub device flow expired. Please try again.");
}

YogiError gitHubAuthorizationPending() {
  return YogiError(ErrorCode::GitHubAuthorizationPending,
    "Authorization pending. Waiting for user to complete login...");
}

YogiError gitHubRateLimited() {
  return YogiError(ErrorCode::GitHubRateLimited,
    "GitHub API rate limited. Please wait before retrying.");
}

YogiError gitHubTokenInvalid(const std::string& detail) {
  return YogiError(ErrorCode::GitHubTokenInvalid,
    "GitHub token invalid: " + detail);
}

YogiError tokenStoreReadFailed(const std::string& path, const std::string& detail) {
  return YogiError(ErrorCode::TokenStoreReadFailed,
    "Failed to read token store at " + path + ": " + detail);
}

YogiError tokenStoreWriteFailed(const std::string& path, const std::string& detail) {
  return YogiError(ErrorCode::TokenStoreWriteFailed,
    "Failed to write token store at " + path + ": " + detail);
}

YogiError browserOpenFailed(const std::string& detail) {
  return YogiError(ErrorCode::BrowserOpenFailed,
    "Failed to open browser: " + detail,
    {"If the browser did not open, visit the URL manually."});
}

YogiError networkRequestFailed(const std::string& detail) {
  return YogiError(ErrorCode::NetworkRequestFailed,
    "Network request failed: " + detail);
}

YogiError notAuthenticated() {
  return YogiError(ErrorCode::NotAuthenticated,
    "Not authenticated with GitHub",
    {"Run \"yogi login\" to authenticate before publishing."});
}

YogiError publishFailed(const std::string& detail) {
  return YogiError(ErrorCode::PublishFailed,
    "Publish failed: " + detail);
}

YogiError repositoryNameTaken(const std::string& name, const std::string& owner) {
  return YogiError(ErrorCode::RepositoryNameTaken,
    "Repository name \"" + name + "\" is already taken on GitHub",
    {"A repository named \"" + name + "\" already exists under account \"" + owner + "\".",
     "Choose a unique package name in yogi.json."});
}

} // namespace yogi::diagnostics
