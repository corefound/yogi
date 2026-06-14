#include "lowering_context.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Function.h>
#endif

namespace yogi::core::llvm::internal {

	std::string fb_string(const flatbuffers::String *value) {
		return value ? value->str() : "";
	}

	std::string sanitize_symbol(std::string name) {
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
		const Yogi::Build::ModuleMeta *module_meta,
		const Yogi::Sir::Module *sir_module
	)
		: module_meta(module_meta),
		  sir_module(sir_module),
		  module(std::make_unique<::llvm::Module>(module_name(), llvm_context)),
		  builder(llvm_context) {
		module->setSourceFileName(fb_string(sir_module->source_path()));
	}

	std::string ModuleLoweringContext::module_name() const {
		return sanitize_symbol(fb_string(module_meta->name()));
	}

	std::filesystem::path ModuleLoweringContext::object_path() const {
		return std::filesystem::path(module_meta->root_path()->str()) /
			std::filesystem::path(module_meta->object_path()->str());
	}

	std::filesystem::path ModuleLoweringContext::ir_path() const {
		auto path = object_path();
		path.replace_extension(".ll");
		return path;
	}

	::llvm::AllocaInst *ModuleLoweringContext::create_entry_alloca(
		::llvm::Function *function,
		const std::string &name,
		::llvm::Type *type
	) {
		::llvm::IRBuilder<> temporary(
			&function->getEntryBlock(),
			function->getEntryBlock().begin()
		);

		return temporary.CreateAlloca(type, nullptr, sanitize_symbol(name));
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
