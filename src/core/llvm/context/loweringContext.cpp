// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/context/loweringContext.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Function.h>
#endif

namespace yogi::core::llvm::internal {

	std::string fbString(const flatbuffers::String *value) {
		return value ? value->str() : "";
	}

	std::string sanitizeSymbol(std::string name) {
		for (char &ch: name) {
			const bool valid =
				(ch >= 'a' && ch <= 'z') ||
				(ch >= 'A' && ch <= 'Z') ||
				(ch >= '0' && ch <= '9') ||
				ch == '_';

			if (!valid) {
				ch = '_';
			}
		}

		return name.empty() ? "anonymous" : name;
	}

#if YOGI_HAS_LLVM
	ModuleLoweringContext::ModuleLoweringContext(
		const Yogi::Build::ModuleMeta *moduleMeta,
		const Yogi::Sir::Module *sirModule
	)
		: moduleMeta(moduleMeta),
		  sirModule(sirModule),
		  module(std::make_unique<::llvm::Module>(moduleName(), llvmContext)),
		  builder(llvmContext) {
		module->setSourceFileName(fbString(sirModule->source_path()));
	}

	std::string ModuleLoweringContext::moduleName() const {
		return sanitizeSymbol(fbString(moduleMeta->name()));
	}

	std::filesystem::path ModuleLoweringContext::objectPath() const {
		return std::filesystem::path(moduleMeta->root_path()->str()) /
			std::filesystem::path(moduleMeta->object_path()->str());
	}

	std::filesystem::path ModuleLoweringContext::irPath() const {
		auto path = objectPath();
		path.replace_extension(".ll");
		return path;
	}

	::llvm::AllocaInst *ModuleLoweringContext::createEntryAlloca(
		::llvm::Function *function,
		const std::string &name,
		::llvm::Type *type
	) {
		::llvm::IRBuilder<> temporary(
			&function->getEntryBlock(),
			function->getEntryBlock().begin()
		);

		return temporary.CreateAlloca(type, nullptr, sanitizeSymbol(name));
	}

	::llvm::Function *ModuleLoweringContext::runtimeFunction(
		const std::string &name,
		::llvm::Type *returnType,
		const std::vector<::llvm::Type *> &parameters
	) {
		if (auto *function = module->getFunction(name)) {
			return function;
		}

		auto *functionType = ::llvm::FunctionType::get(returnType, parameters, false);
		return ::llvm::Function::Create(
			functionType,
			::llvm::Function::ExternalLinkage,
			name,
			module.get()
		);
	}
#endif

} // namespace yogi::core::llvm::internal
