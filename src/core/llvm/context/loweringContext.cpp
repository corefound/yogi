// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/context/loweringContext.h"

#include <cstdint>

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

	void ModuleLoweringContext::pushMemoryContext(const std::string &functionName) {
		auto *pointerType = ::llvm::PointerType::getUnqual(llvmContext);
		auto *function = runtimeFunction(
			"yogi_memory_push_context",
			::llvm::Type::getVoidTy(llvmContext),
			{pointerType, pointerType}
		);
		auto *moduleValue = builder.CreateGlobalString(moduleName());
		auto *functionValue = builder.CreateGlobalString(functionName);
		builder.CreateCall(function, {moduleValue, functionValue});
	}

	void ModuleLoweringContext::popMemoryContext() {
		auto *function = runtimeFunction(
			"yogi_memory_pop_context",
			::llvm::Type::getVoidTy(llvmContext),
			{}
		);
		builder.CreateCall(function);
	}

	void ModuleLoweringContext::pushMemorySourceLocation(const Yogi::Sir::SourcePosition *position) {
		auto *pointerType = ::llvm::PointerType::getUnqual(llvmContext);
		auto *integerType = ::llvm::Type::getInt64Ty(llvmContext);
		auto *function = runtimeFunction(
			"yogi_memory_push_source_location",
			::llvm::Type::getVoidTy(llvmContext),
			{pointerType, integerType, integerType}
		);
		auto sourcePath = fbString(sirModule->source_path());

		if (sourcePath.empty() && moduleMeta && moduleMeta->source_path()) {
			sourcePath = fbString(moduleMeta->source_path());
		}

		const auto line = position && position->line() >= 0
			? static_cast<std::uint64_t>(position->line()) + 1
			: 0;
		const auto column = position && position->character() >= 0
			? static_cast<std::uint64_t>(position->character()) + 1
			: 0;

		builder.CreateCall(function, {
			builder.CreateGlobalString(sourcePath.empty() ? "<unknown>" : sourcePath),
			::llvm::ConstantInt::get(integerType, line),
			::llvm::ConstantInt::get(integerType, column),
		});
	}

	void ModuleLoweringContext::popMemorySourceLocation() {
		auto *function = runtimeFunction(
			"yogi_memory_pop_source_location",
			::llvm::Type::getVoidTy(llvmContext),
			{}
		);
		builder.CreateCall(function);
	}

	void ModuleLoweringContext::clearLocalState() {
		locals.clear();
		localTypes.clear();
		localTypeKinds.clear();
		aggregateAliases.clear();
		localAggregateCleanups.clear();
	}

	void ModuleLoweringContext::registerAggregateOwner(
		const std::string &name,
		int symbolId,
		const Yogi::Sir::TypeRef *type,
		::llvm::Value *value,
		bool heapOwned,
		::llvm::Value *cleanupSlot
	) {
		aggregateAliases[name] = name;
		localAggregateCleanups.push_back({
			name,
			symbolId,
			type,
			value,
			heapOwned,
			true,
			cleanupSlot,
		});
	}

	void ModuleLoweringContext::aliasAggregateOwner(
		const std::string &alias,
		const std::string &source
	) {
		const auto owner = resolveAggregateOwner(source);
		if (owner) {
			aggregateAliases[alias] = *owner;
		}
	}

	std::optional<std::string> ModuleLoweringContext::resolveAggregateOwner(const std::string &name) const {
		auto current = name;

		for (std::size_t depth = 0; depth < aggregateAliases.size() + 1; ++depth) {
			const auto alias = aggregateAliases.find(current);

			if (alias == aggregateAliases.end()) {
				return std::nullopt;
			}

			if (alias->second == current) {
				return current;
			}

			current = alias->second;
		}

		return std::nullopt;
	}

	void ModuleLoweringContext::deactivateAggregateOwner(const std::string &name) {
		const auto owner = resolveAggregateOwner(name);
		if (!owner) {
			return;
		}

		for (auto &cleanup: localAggregateCleanups) {
			if (cleanup.owner == *owner) {
				cleanup.active = false;
			}
		}
	}

	void ModuleLoweringContext::deactivateAggregateOwner(int symbolId) {
		if (symbolId < 0) {
			return;
		}

		for (auto &cleanup: localAggregateCleanups) {
			if (cleanup.symbolId == symbolId) {
				cleanup.active = false;
			}
		}
	}
#endif

} // namespace yogi::core::llvm::internal
