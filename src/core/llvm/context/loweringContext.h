// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "llvm/driver/lowerer.h"

#include <filesystem>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "libs/flatbuffers/flatbuffers.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/IRBuilder.h>
#include <llvm/IR/Function.h>
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Module.h>
#include <llvm/IR/Value.h>
#endif

namespace yogi::core::llvm::internal {

	std::string fbString(const flatbuffers::String *value);
	std::string sanitizeSymbol(std::string name);

#if YOGI_HAS_LLVM
	class ModuleLoweringContext {
		public:
			struct LocalAggregateCleanup {
				std::string owner;
				int symbolId;
				const Yogi::Sir::TypeRef *type;
				::llvm::Value *value;
				bool heapOwned;
				bool active;
			};

			ModuleLoweringContext(
				const Yogi::Build::ModuleMeta *moduleMeta,
				const Yogi::Sir::Module *sirModule
			);

			std::string moduleName() const;
			std::filesystem::path objectPath() const;
			std::filesystem::path irPath() const;
			::llvm::AllocaInst *createEntryAlloca(
				::llvm::Function *function,
				const std::string &name,
				::llvm::Type *type
			);
			::llvm::Function *runtimeFunction(
				const std::string &name,
				::llvm::Type *returnType,
				const std::vector<::llvm::Type *> &parameters
			);
			void pushMemoryContext(const std::string &functionName);
			void popMemoryContext();
			void pushMemorySourceLocation(const Yogi::Sir::SourcePosition *position);
			void popMemorySourceLocation();
			void clearLocalState();
			void registerAggregateOwner(
				const std::string &name,
				int symbolId,
				const Yogi::Sir::TypeRef *type,
				::llvm::Value *value,
				bool heapOwned
			);
			void aliasAggregateOwner(const std::string &alias, const std::string &source);
			std::optional<std::string> resolveAggregateOwner(const std::string &name) const;
			void deactivateAggregateOwner(const std::string &name);
			void deactivateAggregateOwner(int symbolId);

			const Yogi::Build::ModuleMeta *moduleMeta;
			const Yogi::Sir::Module *sirModule;
			::llvm::LLVMContext llvmContext;
			std::unique_ptr<::llvm::Module> module;
			::llvm::IRBuilder<> builder;
			std::map<std::string, ::llvm::GlobalVariable *> globals;
			std::map<std::string, ::llvm::AllocaInst *> locals;
			std::map<std::string, const Yogi::Sir::TypeRef *> globalTypes;
			std::map<std::string, const Yogi::Sir::TypeRef *> localTypes;
			std::map<std::string, Yogi::Sir::TypeKind> globalTypeKinds;
			std::map<std::string, Yogi::Sir::TypeKind> localTypeKinds;
			std::map<std::string, std::string> aggregateAliases;
			std::vector<LocalAggregateCleanup> localAggregateCleanups;
			const Yogi::Sir::TypeRef *currentReturnType = nullptr;
	};
#endif

} // namespace yogi::core::llvm::internal
