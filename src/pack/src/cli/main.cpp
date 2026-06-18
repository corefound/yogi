#include <iostream>
#include <string>
#include <vector>
#include <filesystem>
#include <cstdlib>
#include <algorithm>

#include "compilerDriver.h"
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
  std::cerr << "       yogi <file.io>" << std::endl;
  std::cerr << std::endl;
  std::cerr << "Commands:" << std::endl;
  std::cerr << "  <file.io>    Compile a single Yogi source file" << std::endl;
  std::cerr << "    yogi main.io" << std::endl;
  std::cerr << "  init         Initialize a new Yogi project" << std::endl;
  std::cerr << "    yogi init" << std::endl;
  std::cerr << "  install      Install project dependencies" << std::endl;
  std::cerr << "    yogi install" << std::endl;
  std::cerr << "  build        Build the project" << std::endl;
  std::cerr << "    yogi build" << std::endl;
  std::cerr << "  run          Build and run the project or a source file" << std::endl;
  std::cerr << "    yogi run [-- args...]" << std::endl;
  std::cerr << "    yogi run main.io [-- args...]" << std::endl;
  std::cerr << "  start        Alias for run" << std::endl;
  std::cerr << "    yogi start" << std::endl;
  std::cerr << "  compile      Compile a source file" << std::endl;
  std::cerr << "    yogi compile main.io" << std::endl;
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

static bool isYogiSourceFile(const std::string& value) {
  const auto extension = std::filesystem::path(value).extension().string();
  return extension == ".io" || extension == ".tx" || extension == ".ts";
}

static std::string quoteShellArg(const std::string& value) {
  std::string quoted = "'";

  for (char ch : value) {
    if (ch == '\'') {
      quoted += "'\\''";
    } else {
      quoted += ch;
    }
  }

  quoted += "'";
  return quoted;
}

static int compileAndRunSource(const std::string& sourceFile, const std::vector<std::string>& passthroughArgs) {
  const int compileResult = yogi::core::runCompiler(sourceFile);

  if (compileResult != 0) {
    return compileResult;
  }

  auto sourcePath = std::filesystem::absolute(sourceFile);
  const auto executable = sourcePath.parent_path() / "packages" / ".cache" / "yogi";

  if (!std::filesystem::exists(executable)) {
    std::cerr << "Error: expected executable was not generated: " << executable << std::endl;
    return 1;
  }

  std::string command = quoteShellArg(executable.string());
  for (const auto& arg : passthroughArgs) {
    command += " " + quoteShellArg(arg);
  }

  return std::system(command.c_str());
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

  if (isYogiSourceFile(command)) {
    return yogi::core::runCompiler(command);
  }

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
    } else if (command == "compile") {
      if (args.size() < 2) {
        std::cerr << "Usage: yogi compile <file.io>" << std::endl;
        return 1;
      }
      return yogi::core::runCompiler(args[1]);
    } else if (command == "install") {
      yogi::cli::installCommand(root, logger);
    } else if (command == "build") {
      yogi::cli::buildCommand(root, logger);
    } else if (command == "run" || command == "start") {
      auto ddash = std::find(args.begin(), args.end(), "--");
      std::vector<std::string> passthroughArgs;
      if (ddash != args.end())
        passthroughArgs.assign(ddash + 1, args.end());

      if (args.size() >= 2 && args[1] != "--" && isYogiSourceFile(args[1])) {
        return compileAndRunSource(args[1], passthroughArgs);
      }

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
