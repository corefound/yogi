//
// Created by Brayhan De Aza on 5/28/26.
//

#include "includes/core.h"

#include "utils/helpers/helpers.h"

namespace yogi::core {
    nlohmann::json Core::TSParser() {
        const std::filesystem::path TS_PARSERS_PATH = TS_PARSERS;
        const auto resolvedPath = std::filesystem::weakly_canonical(TS_PARSERS_PATH / "ts-parser-macos-arm64").string();
        const std::string response = utils::helpers::Helpers::runCommand(resolvedPath + " " + TEST_PATH);

        nlohmann::json ast = nlohmann::json::parse(response);
        return ast;
    }
}