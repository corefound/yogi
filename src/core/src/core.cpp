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

		ast = nlohmann::json::parse(response);
	}
}