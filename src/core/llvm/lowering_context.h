#pragma once

#include "lowerer.h"

#include <filesystem>
#include <map>
#include <memory>
#include <string>

#include "libs/flatbuffers/flatbuffers.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/IRBuilder.h>
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Module.h>
#endif

namespace yogi::core::llvm::internal {

	std::string fb_string(const flatbuffers::String *value);
	std::string sanitize_symbol(std::string name);

#if YOGI_HAS_LLVM
	class ModuleLoweringContext {
		public:
			ModuleLoweringContext(
				const Yogi::Build::ModuleMeta *module_meta,
				const Yogi::Sir::Module *sir_module
			);

			std::string module_name() const;
			std::filesystem::path object_path() const;
			std::filesystem::path ir_path() const;
			::llvm::AllocaInst *create_entry_alloca(
				::llvm::Function *function,
				const std::string &name,
				::llvm::Type *type
			);

			const Yogi::Build::ModuleMeta *module_meta;
			const Yogi::Sir::Module *sir_module;
			::llvm::LLVMContext llvm_context;
			std::unique_ptr<::llvm::Module> module;
			::llvm::IRBuilder<> builder;
			std::map<std::string, ::llvm::GlobalVariable *> globals;
			std::map<std::string, ::llvm::AllocaInst *> locals;
	};
#endif

} // namespace yogi::core::llvm::internal
