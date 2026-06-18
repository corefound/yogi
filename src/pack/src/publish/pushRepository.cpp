#include "pushRepository.hpp"
#include "diagnostics/errors.hpp"
#include <cstdio>
#include <sstream>
#include <string>

namespace yogi::publish {

namespace {

std::string shellEscape(const std::string& value) {
  std::string escaped = "'";
  for (char c : value) {
    if (c == '\'') {
      escaped += "'\\''";
    } else {
      escaped += c;
    }
  }
  escaped += "'";
  return escaped;
}

int runInDir(const std::string& root, const std::string& cmd) {
  std::ostringstream full;
  full << "cd " << shellEscape(root) << " && " << cmd;
  return std::system(full.str().c_str());
}

std::string captureInDir(const std::string& root, const std::string& cmd) {
  std::ostringstream full;
  full << "cd " << shellEscape(root) << " && " << cmd << " 2>/dev/null";

  FILE* pipe = popen(full.str().c_str(), "r");
  if (!pipe) {
    return "";
  }

  std::string result;
  char buffer[256];
  while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
    result += buffer;
  }
  pclose(pipe);

  while (!result.empty() && (result.back() == '\n' || result.back() == '\r')) {
    result.pop_back();
  }
  return result;
}

bool gitAvailable() {
  return std::system("git --version >/dev/null 2>&1") == 0;
}

void ensureGitRepo(const std::string& root) {
  if (runInDir(root, "git rev-parse --is-inside-work-tree >/dev/null 2>&1") != 0) {
    if (runInDir(root, "git init -b main") != 0) {
      throw diagnostics::publishFailed("failed to initialize git repository");
    }
  }
}

void ensureGitIdentity(const std::string& root, const std::string& username) {
  if (captureInDir(root, "git config user.email").empty()) {
    runInDir(root, "git config user.email " + shellEscape(username + "@users.noreply.github.com"));
  }
  if (captureInDir(root, "git config user.name").empty()) {
    runInDir(root, "git config user.name " + shellEscape(username));
  }
}

void ensureRemote(const std::string& root, const std::string& owner, const std::string& repoName) {
  std::string remoteUrl = "https://github.com/" + owner + "/" + repoName + ".git";
  if (runInDir(root, "git remote get-url origin >/dev/null 2>&1") == 0) {
    runInDir(root, "git remote set-url origin " + shellEscape(remoteUrl));
  } else {
    runInDir(root, "git remote add origin " + shellEscape(remoteUrl));
  }
}

std::string currentBranch(const std::string& root) {
  std::string branch = captureInDir(root, "git branch --show-current");
  if (!branch.empty()) {
    return branch;
  }
  return "main";
}

void ensureCommit(const std::string& root, const std::string& version) {
  runInDir(root, "git add -A");

  bool hasCommits = runInDir(root, "git rev-parse HEAD >/dev/null 2>&1") == 0;
  bool hasStagedChanges = runInDir(root, "git diff --cached --quiet") != 0;

  if (!hasCommits || hasStagedChanges) {
    std::string message = "Release " + version;
    if (runInDir(root, "git commit -m " + shellEscape(message)) != 0) {
      throw diagnostics::publishFailed("failed to commit project changes before publish");
    }
  }
}

void pushToRemote(const std::string& root,
                  const std::string& owner,
                  const std::string& repoName,
                  const std::string& accessToken) {
  std::string branch = currentBranch(root);
  std::string pushUrl = "https://x-access-token:" + accessToken + "@github.com/" + owner + "/" + repoName + ".git";
  std::string pushCmd = "git push " + shellEscape(pushUrl) + " HEAD:refs/heads/" + branch;

  if (runInDir(root, pushCmd) == 0) {
    return;
  }

  if (branch != "main") {
    if (runInDir(root, "git push " + shellEscape(pushUrl) + " HEAD:refs/heads/main") == 0) {
      return;
    }
  }

  throw diagnostics::publishFailed("failed to push project to GitHub; ensure your token has repo access");
}

} // namespace

std::string pushProjectToGitHub(const std::string& root,
                                const std::string& owner,
                                const std::string& repoName,
                                const std::string& version,
                                const std::string& accessToken,
                                diagnostics::Logger& logger) {
  if (!gitAvailable()) {
    throw diagnostics::publishFailed("git is required to publish but was not found on PATH");
  }

  logger.info("Pushing project source to GitHub...");
  ensureGitRepo(root);
  ensureGitIdentity(root, owner);
  ensureRemote(root, owner, repoName);
  ensureCommit(root, version);
  pushToRemote(root, owner, repoName, accessToken);
  logger.info("Source pushed to " + owner + "/" + repoName);
  return currentBranch(root);
}

} // namespace yogi::publish
