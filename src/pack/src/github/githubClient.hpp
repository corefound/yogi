#pragma once

#include "githubTypes.hpp"
#include <string>
#include <optional>
#include <functional>
#include <vector>

namespace yogi::github {

class GitHubClient {
  public:
    using HttpCallback = std::function<std::string(const std::string&, const std::string&, const std::string&)>;

    explicit GitHubClient(HttpCallback httpPost = defaultHttpPost);

    std::optional<GitHubUser> getAuthenticatedUser(const std::string& accessToken);
    DeviceCodeResponse startDeviceFlow(const std::string& clientId);
    AccessTokenResponse pollForToken(const std::string& clientId, const std::string& deviceCode);

    std::optional<GitHubRepository> getRepository(const std::string& owner,
                                                  const std::string& repo,
                                                  const std::string& accessToken);
    GitHubRepository createRepository(const std::string& name,
                                      const std::optional<std::string>& description,
                                      const std::string& accessToken);
    std::vector<GitHubCollaborator> getCollaborators(const std::string& owner,
                                                     const std::string& repo,
                                                     const std::string& accessToken);
    std::optional<std::string> getReadme(const std::string& owner,
                                         const std::string& repo,
                                         const std::string& accessToken);
    std::optional<GitHubRelease> getReleaseByTag(const std::string& owner,
                                                 const std::string& repo,
                                                 const std::string& tag,
                                                 const std::string& accessToken);
    GitHubRelease createRelease(const std::string& owner,
                                const std::string& repo,
                                const std::string& tag,
                                const std::string& title,
                                const std::string& body,
                                const std::string& accessToken,
                                const std::string& targetCommitish = "");
    GitHubAsset uploadReleaseAsset(const std::string& uploadUrl,
                                   const std::string& assetName,
                                   const std::string& filePath,
                                   const std::string& accessToken);

  private:
    HttpCallback httpPost_;
    static std::string defaultHttpPost(const std::string& url, const std::string& body, const std::string& acceptType);
    static HttpResponse httpRequest(const std::string& method,
                                    const std::string& url,
                                    const std::string& authHeader,
                                    const std::string& body,
                                    const std::string& contentType);
    static HttpResponse httpUploadFile(const std::string& url,
                                       const std::string& authHeader,
                                       const std::string& filePath);
    static std::string httpGet(const std::string& url, const std::string& authHeader);
    static void checkGitHubError(const HttpResponse& response, const std::string& context);
    GitHubUser parseUser(const std::string& json);
    DeviceCodeResponse parseDeviceCodeResponse(const std::string& json);
    AccessTokenResponse parseAccessTokenResponse(const std::string& json);
    GitHubRepository parseRepository(const std::string& json);
    GitHubRelease parseRelease(const std::string& json);
    GitHubAsset parseAsset(const std::string& json);
};

} // namespace yogi::github
