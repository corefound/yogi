// Created by Brayhan De Aza on 7/26/26.
//

#include "programIrInspector.h"

#include <llvm/IR/Function.h>
#include <llvm/IR/Instructions.h>
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Module.h>
#include <llvm/IR/Verifier.h>
#include <llvm/IRReader/IRReader.h>
#include <llvm/Support/SourceMgr.h>
#include <llvm/Support/raw_ostream.h>

#include <algorithm>
#include <map>
#include <memory>
#include <set>
#include <sstream>

namespace yogi::testing {

    namespace {

        std::filesystem::path resolvePath(const std::filesystem::path& artifactRoot, const std::string& file) {
            const std::filesystem::path path(file);
            return path.is_absolute() ? path.lexically_normal() : (artifactRoot / path).lexically_normal();
        }

        void addAnomaly(IrInspectionResult& result, std::string code, std::string message, const std::filesystem::path& source) {
            result.anomalies.push_back({
                std::move(code),
                std::move(message),
                source.string(),
            });
        }

        bool hasMetadata(const llvm::Instruction& instruction, const std::vector<std::string>& required) {
            return std::all_of(required.begin(), required.end(), [&](const auto& name) { return instruction.getMetadata(name) != nullptr; });
        }

        std::size_t countCalls(const llvm::Module& module, const IrExpectation& expectation) {
            std::size_t count = 0;

            for (const auto& function : module) {
                if (!expectation.function.empty() && function.getName() != expectation.function) {
                    continue;
                }

                for (const auto& block : function) {
                    for (const auto& instruction : block) {
                        const auto* call = llvm::dyn_cast<llvm::CallBase>(&instruction);
                        const auto* callee = call ? call->getCalledFunction() : nullptr;
                        if (!callee || (!expectation.callee.empty() && callee->getName() != expectation.callee) || !hasMetadata(instruction, expectation.metadata)) {
                            continue;
                        }
                        ++count;
                    }
                }
            }

            return count;
        }

        void checkCount(const IrExpectation& expectation, std::size_t observed, const std::string& label, const std::filesystem::path& path, IrInspectionResult& result) {
            if (expectation.exactly >= 0 && observed != static_cast<std::size_t>(expectation.exactly)) {
                addAnomaly(result, "ir.expectation_count", "expected exactly " + std::to_string(expectation.exactly) + " " + label + ", observed " + std::to_string(observed), path);
                return;
            }

            if (expectation.exactly < 0 && observed < static_cast<std::size_t>(std::max<std::int64_t>(0, expectation.atLeast))) {
                addAnomaly(result, "ir.expectation_count", "expected at least " + std::to_string(expectation.atLeast) + " " + label + ", observed " + std::to_string(observed), path);
            }
        }

        void inspectExpectation(const llvm::Module& module, const IrExpectation& expectation, const std::filesystem::path& path, IrInspectionResult& result) {
            if (expectation.kind == "call") {
                const auto observed = countCalls(module, expectation);
                const auto label = "calls to '" + expectation.callee + "'" + (expectation.function.empty() ? "" : " in '" + expectation.function + "'");
                checkCount(expectation, observed, label, path, result);
                return;
            }

            if (expectation.kind == "function") {
                const auto observed = module.getFunction(expectation.name) ? 1U : 0U;
                checkCount(expectation, observed, "functions named '" + expectation.name + "'", path, result);
                return;
            }

            if (expectation.kind == "namedMetadata") {
                const auto* metadata = module.getNamedMetadata(expectation.name);
                const auto observed = metadata ? metadata->getNumOperands() : 0U;
                checkCount(expectation, observed, "named metadata operands in '" + expectation.name + "'", path, result);
                return;
            }

            addAnomaly(result, "ir.expectation_kind", "unsupported LLVM expectation kind '" + expectation.kind + "'", path);
        }

    } // namespace

    IrInspectionResult ProgramIrInspector::inspect(const std::filesystem::path& artifactRoot, const std::vector<IrExpectation>& expectations) {
        IrInspectionResult result;
        std::set<std::filesystem::path> modulePaths;
        std::map<std::filesystem::path, std::vector<const IrExpectation*>> expectationsByPath;

        std::error_code iteratorError;
        if (std::filesystem::exists(artifactRoot)) {
            for (std::filesystem::recursive_directory_iterator iterator(artifactRoot, std::filesystem::directory_options::skip_permission_denied, iteratorError), end; iterator != end; iterator.increment(iteratorError)) {
                if (iteratorError) {
                    iteratorError.clear();
                    continue;
                }
                if (iterator->is_regular_file() && iterator->path().extension() == ".ll") {
                    modulePaths.insert(iterator->path().lexically_normal());
                }
            }
        }

        for (const auto& expectation : expectations) {
            const auto path = resolvePath(artifactRoot, expectation.file);
            modulePaths.insert(path);
            expectationsByPath[path].push_back(&expectation);
        }

        for (const auto& path : modulePaths) {
            if (!std::filesystem::exists(path)) {
                addAnomaly(result, "ir.missing", "LLVM module does not exist", path);
                continue;
            }

            llvm::LLVMContext context;
            llvm::SMDiagnostic diagnostic;
            auto module = llvm::parseIRFile(path.string(), diagnostic, context);
            if (!module) {
                std::string message;
                llvm::raw_string_ostream stream(message);
                diagnostic.print("yogi_program_trace_analyzer", stream);
                stream.flush();
                addAnomaly(result, "ir.parse", message, path);
                continue;
            }

            ++result.moduleCount;
            std::string verificationError;
            llvm::raw_string_ostream verificationStream(verificationError);
            if (llvm::verifyModule(*module, &verificationStream)) {
                verificationStream.flush();
                addAnomaly(result, "ir.verify", verificationError, path);
                continue;
            }

            for (const auto* expectation : expectationsByPath[path]) {
                inspectExpectation(*module, *expectation, path, result);
            }
        }

        return result;
    }

} // namespace yogi::testing
