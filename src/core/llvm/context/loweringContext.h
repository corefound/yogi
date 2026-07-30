// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "llvm/driver/lowerer.h"

#include <cstdint>
#include <filesystem>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include "libs/flatbuffers/flatbuffers.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/Function.h>
#include <llvm/IR/IRBuilder.h>
#include <llvm/IR/Instruction.h>
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Module.h>
#include <llvm/IR/Value.h>
#endif

namespace yogi::core::llvm::internal {

    std::string fbString(const flatbuffers::String* value);
    std::string sanitizeSymbol(std::string name);

#if YOGI_HAS_LLVM
    class ModuleLoweringContext {
       public:
        struct LocalAggregateCleanup {
            std::string cleanupId;
            std::string owner;
            int symbolId;
            const Yogi::Sir::TypeRef* type;
            ::llvm::Value* value;
            bool heapOwned;
            bool active;
            ::llvm::Value* cleanupSlot;
            std::string runtimeDestroyFunction;
            std::string cleanupKind;
            std::string destroyFunction;
            std::string storage;
            const Yogi::Sir::SourcePosition* position;
        };

        struct StructFieldInfo {
            std::string name;
            const Yogi::Sir::TypeRef* type;
            std::size_t index;
        };

        ModuleLoweringContext(const Yogi::Build::ModuleMeta* moduleMeta, const Yogi::Sir::Module* sirModule);

        std::string moduleName() const;
        std::filesystem::path objectPath() const;
        std::filesystem::path irPath() const;
        ::llvm::AllocaInst* createEntryAlloca(::llvm::Function* function, const std::string& name, ::llvm::Type* type);
        ::llvm::Function* runtimeFunction(const std::string& name, ::llvm::Type* returnType, const std::vector<::llvm::Type*>& parameters);
        void pushMemoryContext(const std::string& functionName);
        void popMemoryContext(const std::string& exitReason = "normal");
        void pushMemorySourceLocation(const Yogi::Sir::SourcePosition* position);
        void popMemorySourceLocation();
        void clearLocalState();
        void registerAggregateOwner(const std::string& name, int symbolId, const Yogi::Sir::TypeRef* type, ::llvm::Value* value, bool heapOwned, ::llvm::Value* cleanupSlot = nullptr, const Yogi::Sir::SourcePosition* position = nullptr);
        void registerRuntimeCleanup(const std::string& name, int symbolId, ::llvm::Value* value, ::llvm::Value* cleanupSlot, const std::string& destroyFunction, const Yogi::Sir::SourcePosition* position = nullptr);
        void registerNativeResourceOwner(const std::string& name, int symbolId, ::llvm::Value* value, ::llvm::Value* cleanupSlot, const std::string& destroyFunction, const Yogi::Sir::SourcePosition* position = nullptr);
        void registerNativeResourceFieldOwner(const std::string& owner, const std::string& fieldPath, const std::string& destroyFunction);
        void registerNativeResourceFieldOwners(const std::string& owner, const std::map<std::string, std::string>& destroyFunctions);
        void registerNativeResourceArrayElementFieldOwners(const std::string& owner, const std::map<std::string, std::string>& destroyFunctions);
        void clearNativeResourceArrayElementFieldOwners(const std::string& owner);
        std::optional<std::string> nativeResourceFieldDestroyFunction(const std::string& owner, const std::string& fieldPath) const;
        std::map<std::string, std::string> nativeResourceFieldDestroyFunctions(const std::string& owner) const;
        std::map<std::string, std::string> nativeResourceArrayElementFieldDestroyFunctions(const std::string& owner) const;
        void clearNativeResourceFieldOwner(const std::string& owner, const std::string& fieldPath);
        void clearNativeResourceFieldOwners(const std::string& owner);
        void moveNativeResourceFieldOwners(const std::string& source, const std::string& target);
        void aliasAggregateOwner(const std::string& alias, const std::string& source);
        std::optional<std::string> resolveAggregateOwner(const std::string& name) const;
        std::optional<std::string> nativeResourceDestroyFunction(const std::string& name) const;
        void deactivateAggregateOwner(const std::string& name);
        void deactivateAggregateOwner(int symbolId);
        void recordSemanticDecisions();
        void emitRuntimeSemanticDecisions(const Yogi::Sir::ValueRef* value);
        void recordCleanupEmission(const LocalAggregateCleanup& cleanup, const std::string& exitReason);
        void emitRuntimeCleanupEvent(const LocalAggregateCleanup& cleanup, const std::string& eventKind, const std::string& exitReason = "none");

        const Yogi::Build::ModuleMeta* moduleMeta;
        const Yogi::Sir::Module* sirModule;
        ::llvm::LLVMContext llvmContext;
        std::unique_ptr<::llvm::Module> module;
        ::llvm::IRBuilder<> builder;
        std::map<std::string, ::llvm::GlobalVariable*> globals;
        std::map<std::string, ::llvm::AllocaInst*> locals;
        std::map<std::string, const Yogi::Sir::TypeRef*> globalTypes;
        std::map<std::string, const Yogi::Sir::TypeRef*> localTypes;
        std::map<std::string, Yogi::Sir::TypeKind> globalTypeKinds;
        std::map<std::string, Yogi::Sir::TypeKind> localTypeKinds;
        std::map<std::string, std::string> aggregateAliases;
        std::map<std::string, std::string> borrowedViewAliases;
        std::map<std::string, std::string> nativeResourceReturnDestructors;
        std::map<std::string, std::map<std::string, std::string>> nativeResourceFieldDestructors;
        std::map<std::string, std::map<std::string, std::string>> nativeResourceArrayElementFieldDestructors;
        std::map<std::string, std::map<std::string, std::string>> nativeResourceStructReturnDestructors;
        std::vector<LocalAggregateCleanup> localAggregateCleanups;
        std::map<std::string, const Yogi::Sir::SemanticDecision*> semanticDecisions;
        std::map<const ::llvm::Function*, std::set<std::string>> emittedRuntimeDecisionIds;
        std::uint64_t cleanupSequence = 0;
        bool retainEscapedObjectGraph = false;
        int switchBodyDepth = 0;
        const Yogi::Sir::TypeRef* currentReturnType = nullptr;

        // Struct type tracking
        std::map<std::string, ::llvm::StructType*> structTypes;
        std::map<std::string, std::vector<StructFieldInfo>> structFields;
        std::map<std::string, const Yogi::Sir::TypeRef*> structScalarTypes;
        std::map<std::string, std::vector<std::string>> structValidateChains;
        std::map<std::string, const Yogi::Sir::LayoutMetadata*> structLayouts;

       private:
        LocalAggregateCleanup
        createCleanup(const std::string& owner, int symbolId, const Yogi::Sir::TypeRef* type, ::llvm::Value* value, bool heapOwned, ::llvm::Value* cleanupSlot, const std::string& runtimeDestroyFunction, const Yogi::Sir::SourcePosition* position);
        void recordCleanupEvent(const char* eventKind, const LocalAggregateCleanup& cleanup, const std::string& exitReason = "none");
    };
#endif

} // namespace yogi::core::llvm::internal
