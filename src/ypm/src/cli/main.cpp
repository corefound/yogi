#include <iostream>
#include <string>
#include <vector>
#include <filesystem>
#include <cstdlib>

#include "diagnostics/logger.hpp"
#include "diagnostics/errors.hpp"
#include "registry/fetchPackage.hpp"
#include "cli/commands/init.hpp"
#include "cli/commands/install.hpp"
#include "cli/commands/build.hpp"
#include "cli/commands/run.hpp"
#include "cli/commands/clean.hpp"
#include "cli/commands/login.hpp"
#include "cli/commands/logout.hpp"
#include "cli/commands/whoami.hpp"
#include "cli/commands/publish.hpp"

static void printHelp() {
  std::cerr << "Yogi Package Manager" << std::endl;
  std::cerr << "Usage: yogi <command> [options]" << std::endl;
  std::cerr << std::endl;
  std::cerr << "Commands:" << std::endl;
  std::cerr << "  init         Initialize a new Yogi project" << std::endl;
  std::cerr << "    yogi init" << std::endl;
  std::cerr << "  install      Install project dependencies" << std::endl;
  std::cerr << "    yogi install" << std::endl;
  std::cerr << "  build        Build the project" << std::endl;
  std::cerr << "    yogi build" << std::endl;
  std::cerr << "  run          Build and run the project" << std::endl;
  std::cerr << "    yogi run [-- args...]" << std::endl;
  std::cerr << "  clean        Clean build artifacts" << std::endl;
  std::cerr << "    yogi clean" << std::endl;
  std::cerr << "  login        Authenticate with GitHub" << std::endl;
  std::cerr << "    yogi login" << std::endl;
  std::cerr << "  logout       Log out from GitHub" << std::endl;
  std::cerr << "    yogi logout" << std::endl;
  std::cerr << "  whoami       Show current GitHub user" << std::endl;
  std::cerr << "    yogi whoami" << std::endl;
  std::cerr << "  publish      Publish package to GitHub Releases" << std::endl;
  std::cerr << "    yogi publish" << std::endl;
}

static void printVersion() {
  std::cerr << "yogi version 0.1.0" << std::endl;
}

int main(int argc, char* argv[]) {
  std::vector<std::string> args;
  for (int i = 1; i < argc; i++)
    args.push_back(argv[i]);

  yogi::diagnostics::Logger logger;

  if (args.empty()) {
    printHelp();
    return 1;
  }

  const std::string& command = args[0];

  if (command == "--help" || command == "-h") {
    printHelp();
    return 0;
  }

  if (command == "--version" || command == "-v") {
    printVersion();
    return 0;
  }

  std::string root = std::getenv("YOGI_PROJECT_ROOT")
    ? std::getenv("YOGI_PROJECT_ROOT")
    : std::filesystem::current_path().string();

  // Setup mock registry
  static yogi::registry::MockRegistry mockRegistry({
    {"math", {"1.0.0", "1.2.0", "1.5.0", "1.8.0", "2.0.0", "2.1.0"}},
    {"http", {"3.0.0", "3.1.0", "3.2.0"}},
    {"logger", {"1.0.0", "1.1.0", "2.0.0"}},
  });
  yogi::registry::setRegistry(&mockRegistry);

  bool yes = false;
  std::string initPath;

  if (command == "init") {
    for (size_t i = 1; i < args.size(); ++i) {
      if (args[i] == "-y" || args[i] == "--yes") {
        yes = true;
      } else if (args[i][0] != '-') {
        initPath = args[i];
      }
    }
    root = initPath.empty() ? root : initPath;
  } else {
    for (size_t i = 1; i < args.size(); ++i) {
      if (args[i] == "-y" || args[i] == "--yes")
        yes = true;
    }
  }

  try {
    if (command == "init") {
      yogi::cli::initCommand(root, logger, yes);
    } else if (command == "install") {
      yogi::cli::installCommand(root, logger);
    } else if (command == "build") {
      yogi::cli::buildCommand(root, logger);
    } else if (command == "run") {
      auto ddash = std::find(args.begin(), args.end(), "--");
      std::vector<std::string> passthroughArgs;
      if (ddash != args.end())
        passthroughArgs.assign(ddash + 1, args.end());
      yogi::cli::runCommand(root, logger, passthroughArgs);
    } else if (command == "clean") {
      yogi::cli::cleanCommand(root, logger);
    } else if (command == "login") {
      yogi::cli::loginCommand(logger);
    } else if (command == "logout") {
      yogi::cli::logoutCommand(logger);
    } else if (command == "whoami") {
      yogi::cli::whoamiCommand(logger);
    } else if (command == "publish") {
      yogi::cli::publishCommand(root, logger);
    } else {
      std::cerr << "Unknown command: " << command << std::endl;
      printHelp();
      return 1;
    }
  } catch (const yogi::diagnostics::YogiError& e) {
    std::cerr << "Error [" << static_cast<int>(e.code) << "]: " << e.what() << std::endl;
    for (const auto& detail : e.details)
      std::cerr << "  " << detail << std::endl;
    return 1;
  } catch (const std::exception& e) {
    std::cerr << "Unexpected error: " << e.what() << std::endl;
    return 1;
  }

  return 0;
}
