// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/output/objectWriter.h"

#if YOGI_HAS_LLVM
#include <iostream>
#include <optional>
#include <system_error>

#include <llvm/IR/LegacyPassManager.h>
#include <llvm/MC/TargetRegistry.h>
#include <llvm/Support/FileSystem.h>
#include <llvm/Support/TargetSelect.h>
#include <llvm/Support/raw_ostream.h>
#include <llvm/TargetParser/Host.h>
#include <llvm/TargetParser/Triple.h>
#include <llvm/Target/TargetMachine.h>
#include <llvm/Target/TargetOptions.h>

namespace yogi::core::llvm::internal {

	ObjectWriter::ObjectWriter(ModuleLoweringContext &context)
		: context(context) {}

	void ObjectWriter::writeIrFile() {
		const auto path = context.irPath();
		std::filesystem::create_directories(path.parent_path());

		std::error_code error;
		::llvm::raw_fd_ostream output(path.string(), error, ::llvm::sys::fs::OF_Text);

		if (error) {
			std::cerr << "failed to write LLVM IR file: " << path << ": "
				<< error.message() << "\n";
			return;
		}

		context.module->print(output, nullptr);
	}

	bool ObjectWriter::writeObjectFile() {
		::llvm::InitializeNativeTarget();
		::llvm::InitializeNativeTargetAsmParser();
		::llvm::InitializeNativeTargetAsmPrinter();

		::llvm::Triple targetTriple(::llvm::sys::getDefaultTargetTriple());
		std::string error;
		const auto *target = ::llvm::TargetRegistry::lookupTarget(targetTriple, error);

		if (!target) {
			std::cerr << "failed to find LLVM target: " << error << "\n";
			return false;
		}

		::llvm::TargetOptions options;
		std::optional<::llvm::Reloc::Model> relocModel;
		std::unique_ptr<::llvm::TargetMachine> targetMachine(
			target->createTargetMachine(targetTriple, "generic", "", options, relocModel)
		);

		if (!targetMachine) {
			std::cerr << "failed to create LLVM target machine\n";
			return false;
		}

		context.module->setDataLayout(targetMachine->createDataLayout());
		context.module->setTargetTriple(targetTriple);

		const auto path = context.objectPath();
		std::filesystem::create_directories(path.parent_path());

		std::error_code errorCode;
		::llvm::raw_fd_ostream destination(path.string(), errorCode, ::llvm::sys::fs::OF_None);

		if (errorCode) {
			std::cerr << "failed to open object file: " << path << ": "
				<< errorCode.message() << "\n";
			return false;
		}

		::llvm::legacy::PassManager passManager;

		if (targetMachine->addPassesToEmitFile(
			passManager,
			destination,
			nullptr,
			::llvm::CodeGenFileType::ObjectFile
		)) {
			std::cerr << "LLVM target machine cannot emit object files\n";
			return false;
		}

		passManager.run(*context.module);
		destination.flush();

		return true;
	}

} // namespace yogi::core::llvm::internal
#endif
