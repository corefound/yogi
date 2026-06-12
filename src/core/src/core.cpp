//
// Created by Brayhan De Aza on 5/28/26.
//

#include "../core.h"
#include "utils/helpers/helpers.h"


namespace yogi::core {
void Core::init(const std::string &filePath) {
    const std::filesystem::path TS_PARSERS_PATH = TS_PARSERS;
    const auto resolvedPath = std::filesystem::weakly_canonical(TS_PARSERS_PATH / utils::helpers::Helpers::getTSParserBinaryName()).string();
    const std::string response = utils::helpers::Helpers::runCommand(resolvedPath + " " + filePath);

    if(response.empty()) {
        // std::cerr << "Error: TypeScript compiler did not emit JSON output." << std::endl;
        std::exit(1);
    }

    try {
        ast = nlohmann::json::parse(response);
    } catch(const nlohmann::json::parse_error &error) {
        std::cerr << "Error: TypeScript compiler emitted invalid JSON: " << error.what() << std::endl;
        std::exit(1);
    }
}
}
