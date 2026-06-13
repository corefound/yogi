#include "object_writer.h"

#if YOGI_HAS_LLVM
#include <iostream>
#include <system_error>

#include <llvm/ADT/Optional.h>
#include <llvm/IR/LegacyPassManager.h>
#include <llvm/MC/TargetRegistry.h>
#include <llvm/Support/FileSystem.h>
#include <llvm/Support/Host.h>
#include <llvm/Support/TargetSelect.h>
#include <llvm/Support/raw_ostream.h>
#include <llvm/Target/TargetMachine.h>
#include <llvm/Target/TargetOptions.h>

namespace yogi::core::llvm::internal {

	ObjectWriter::ObjectWriter(ModuleLoweringContext &context)
		: context_(context) {}

	void ObjectWriter::write_ir_file() {
		const auto path = context_.ir_path();
		std::filesystem::create_directories(path.parent_path());

		std::error_code error;
		::llvm::raw_fd_ostream output(path.string(), error, ::llvm::sys::fs::OF_Text);

		if (error) {
			std::cerr << "failed to write LLVM IR file: " << path << ": "
				<< error.message() << "\n";
			return;
		}

		context_.module->print(output, nullptr);
	}

	bool ObjectWriter::write_object_file() {
		::llvm::InitializeNativeTarget();
		::llvm::InitializeNativeTargetAsmParser();
		::llvm::InitializeNativeTargetAsmPrinter();

		const auto target_triple = ::llvm::sys::getDefaultTargetTriple();
		std::string error;
		const auto *target = ::llvm::TargetRegistry::lookupTarget(target_triple, error);

		if (!target) {
			std::cerr << "failed to find LLVM target: " << error << "\n";
			return false;
		}

		::llvm::TargetOptions options;
		::llvm::Optional<::llvm::Reloc::Model> reloc_model;
		std::unique_ptr<::llvm::TargetMachine> target_machine(
			target->createTargetMachine(target_triple, "generic", "", options, reloc_model)
		);

		if (!target_machine) {
			std::cerr << "failed to create LLVM target machine\n";
			return false;
		}

		context_.module->setDataLayout(target_machine->createDataLayout());
		context_.module->setTargetTriple(target_triple);

		const auto path = context_.object_path();
		std::filesystem::create_directories(path.parent_path());

		std::error_code error_code;
		::llvm::raw_fd_ostream destination(path.string(), error_code, ::llvm::sys::fs::OF_None);

		if (error_code) {
			std::cerr << "failed to open object file: " << path << ": "
				<< error_code.message() << "\n";
			return false;
		}

		::llvm::legacy::PassManager pass_manager;

		if (target_machine->addPassesToEmitFile(
			pass_manager,
			destination,
			nullptr,
			::llvm::CGFT_ObjectFile
		)) {
			std::cerr << "LLVM target machine cannot emit object files\n";
			return false;
		}

		pass_manager.run(*context_.module);
		destination.flush();

		return true;
	}

} // namespace yogi::core::llvm::internal
#endif
