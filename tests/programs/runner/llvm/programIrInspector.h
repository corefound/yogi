// Created by Brayhan De Aza on 7/26/26.
//

#pragma once

#include <cstdint>
#include <filesystem>
#include <string>
#include <vector>

namespace yogi::testing {

    struct IrExpectation {
        std::string kind;
        std::string file;
        std::string name;
        std::string function;
        std::string callee;
        std::vector<std::string> metadata;
        std::int64_t exactly = -1;
        std::int64_t atLeast = 1;
    };

    struct IrInspectionAnomaly {
        std::string code;
        std::string message;
        std::string source;
    };

    struct IrInspectionResult {
        std::size_t moduleCount = 0;
        std::vector<IrInspectionAnomaly> anomalies;
    };

    class ProgramIrInspector final {
       public:
        static IrInspectionResult inspect(const std::filesystem::path& artifactRoot, const std::vector<IrExpectation>& expectations);
    };

} // namespace yogi::testing
