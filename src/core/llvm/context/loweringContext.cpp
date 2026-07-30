// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/context/loweringContext.h"

#include <cstdint>
#include <iomanip>
#include <sstream>

#include "yogi/runtime/observability/programObservability.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Function.h>
#include <llvm/IR/Instructions.h>
#include <llvm/IR/Metadata.h>
#endif

namespace yogi::core::llvm::internal {

    std::string fbString(const flatbuffers::String* value) {
        return value ? value->str() : "";
    }

    std::string sanitizeSymbol(std::string name) {
        for (char& ch : name) {
            const bool valid = (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_';

            if (!valid) {
                ch = '_';
            }
        }

        return name.empty() ? "anonymous" : name;
    }

#if YOGI_HAS_LLVM
    ModuleLoweringContext::ModuleLoweringContext(const Yogi::Build::ModuleMeta* moduleMeta, const Yogi::Sir::Module* sirModule)
        : moduleMeta(moduleMeta), sirModule(sirModule), module(std::make_unique<::llvm::Module>(moduleName(), llvmContext)), builder(llvmContext) {
        module->setSourceFileName(fbString(sirModule->source_path()));

        if (sirModule->decisions()) {
            for (const auto* decision : *sirModule->decisions()) {
                semanticDecisions[fbString(decision->decision_id())] = decision;
            }
        }
    }

    std::string ModuleLoweringContext::moduleName() const {
        return sanitizeSymbol(fbString(moduleMeta->name()));
    }

    std::filesystem::path ModuleLoweringContext::objectPath() const {
        return std::filesystem::path(moduleMeta->root_path()->str()) / std::filesystem::path(moduleMeta->object_path()->str());
    }

    std::filesystem::path ModuleLoweringContext::irPath() const {
        auto path = objectPath();
        path.replace_extension(".ll");
        return path;
    }

    ::llvm::AllocaInst* ModuleLoweringContext::createEntryAlloca(::llvm::Function* function, const std::string& name, ::llvm::Type* type) {
        ::llvm::IRBuilder<> temporary(&function->getEntryBlock(), function->getEntryBlock().begin());

        return temporary.CreateAlloca(type, nullptr, sanitizeSymbol(name));
    }

    ::llvm::Function* ModuleLoweringContext::runtimeFunction(const std::string& name, ::llvm::Type* returnType, const std::vector<::llvm::Type*>& parameters) {
        if (auto* function = module->getFunction(name)) {
            return function;
        }

        auto* functionType = ::llvm::FunctionType::get(returnType, parameters, false);
        return ::llvm::Function::Create(functionType, ::llvm::Function::ExternalLinkage, name, module.get());
    }

    void ModuleLoweringContext::pushMemoryContext(const std::string& functionName) {
        auto* pointerType = ::llvm::PointerType::getUnqual(llvmContext);
        auto* function = runtimeFunction("yogi_memory_push_context", ::llvm::Type::getVoidTy(llvmContext), {pointerType, pointerType});
        auto* moduleValue = builder.CreateGlobalString(moduleName());
        auto* functionValue = builder.CreateGlobalString(functionName);
        builder.CreateCall(function, {moduleValue, functionValue});
    }

    void ModuleLoweringContext::popMemoryContext(const std::string& exitReason) {
        auto* pointerType = ::llvm::PointerType::getUnqual(llvmContext);
        auto* function = runtimeFunction("yogi_memory_pop_context_with_reason", ::llvm::Type::getVoidTy(llvmContext), {pointerType});
        builder.CreateCall(function, {builder.CreateGlobalString(exitReason)});
    }

    void ModuleLoweringContext::pushMemorySourceLocation(const Yogi::Sir::SourcePosition* position) {
        auto* pointerType = ::llvm::PointerType::getUnqual(llvmContext);
        auto* integerType = ::llvm::Type::getInt64Ty(llvmContext);
        auto* function = runtimeFunction("yogi_memory_push_source_location", ::llvm::Type::getVoidTy(llvmContext), {pointerType, integerType, integerType});
        auto sourcePath = fbString(sirModule->source_path());

        if (sourcePath.empty() && moduleMeta && moduleMeta->source_path()) {
            sourcePath = fbString(moduleMeta->source_path());
        }

        const auto line = position && position->line() >= 0 ? static_cast<std::uint64_t>(position->line()) + 1 : 0;
        const auto column = position && position->character() >= 0 ? static_cast<std::uint64_t>(position->character()) + 1 : 0;

        builder.CreateCall(
            function,
            {
                builder.CreateGlobalString(sourcePath.empty() ? "<unknown>" : sourcePath),
                ::llvm::ConstantInt::get(integerType, line),
                ::llvm::ConstantInt::get(integerType, column),
            });
    }

    void ModuleLoweringContext::popMemorySourceLocation() {
        auto* function = runtimeFunction("yogi_memory_pop_source_location", ::llvm::Type::getVoidTy(llvmContext), {});
        builder.CreateCall(function);
    }

    void ModuleLoweringContext::recordSemanticDecisions() {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        if (!sirModule->decisions()) {
            return;
        }

        auto* metadata = module->getOrInsertNamedMetadata("yogi.semantic.decisions");
        const auto moduleId = fbString(sirModule->module_id());
        const auto sourcePath = fbString(sirModule->source_path());

        for (const auto* decision : *sirModule->decisions()) {
            const auto decisionId = fbString(decision->decision_id());
            const auto nodeId = fbString(decision->node_id());
            const auto valueId = fbString(decision->value_id());
            const auto typeId = fbString(decision->type_id());
            const auto kind = std::string(Yogi::Sir::EnumNameSemanticDecisionKind(decision->kind()));
            const auto reason = std::string(Yogi::Sir::EnumNameSemanticDecisionReason(decision->reason()));
            const auto* position = decision->position();
            const auto line = position && position->line() >= 0 ? static_cast<std::size_t>(position->line()) + 1 : 0;
            const auto column = position && position->character() >= 0 ? static_cast<std::size_t>(position->character()) + 1 : 0;

            yogi::runtime::ProgramObservability::recordSemanticDecision(
                "sir",
                "sir.decision.read",
                decisionId.c_str(),
                nodeId.c_str(),
                valueId.c_str(),
                typeId.c_str(),
                kind.c_str(),
                reason.c_str(),
                decision->runtime_required(),
                moduleId.c_str(),
                "<module>",
                sourcePath.c_str(),
                line,
                column);
            yogi::runtime::ProgramObservability::recordSemanticDecision(
                "lowering",
                "lowering.decision.consume",
                decisionId.c_str(),
                nodeId.c_str(),
                valueId.c_str(),
                typeId.c_str(),
                kind.c_str(),
                reason.c_str(),
                decision->runtime_required(),
                moduleId.c_str(),
                "<module>",
                sourcePath.c_str(),
                line,
                column);

            metadata->addOperand(::llvm::MDNode::
                                     get(llvmContext,
                                         {
                                             ::llvm::MDString::get(llvmContext, decisionId),
                                             ::llvm::MDString::get(llvmContext, nodeId),
                                             ::llvm::MDString::get(llvmContext, valueId),
                                             ::llvm::MDString::get(llvmContext, typeId),
                                             ::llvm::MDString::get(llvmContext, kind),
                                             ::llvm::MDString::get(llvmContext, reason),
                                         }));
        }
#endif
    }

    void ModuleLoweringContext::emitRuntimeSemanticDecisions(const Yogi::Sir::ValueRef* value) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        if (!value || !value->decision_ids() || value->decision_ids()->size() == 0 || !builder.GetInsertBlock()) {
            return;
        }

        auto* pointerType = ::llvm::PointerType::getUnqual(llvmContext);
        auto* observer = runtimeFunction("yogi_observe_semantic_decision", ::llvm::Type::getVoidTy(llvmContext), {pointerType, pointerType, pointerType, pointerType, pointerType, pointerType});
        auto* currentFunction = builder.GetInsertBlock()->getParent();

        for (const auto* decisionIdValue : *value->decision_ids()) {
            const auto decisionId = fbString(decisionIdValue);
            const auto iterator = semanticDecisions.find(decisionId);
            if (iterator == semanticDecisions.end() || !iterator->second->runtime_required()) {
                continue;
            }
            if (!emittedRuntimeDecisionIds[currentFunction].insert(decisionId).second) {
                continue;
            }

            const auto* decision = iterator->second;
            const auto nodeId = fbString(decision->node_id());
            const auto valueId = fbString(decision->value_id());
            const auto typeId = fbString(decision->type_id());
            const auto kind = std::string(Yogi::Sir::EnumNameSemanticDecisionKind(decision->kind()));
            const auto reason = std::string(Yogi::Sir::EnumNameSemanticDecisionReason(decision->reason()));
            auto* call = builder.CreateCall(
                observer,
                {
                    builder.CreateGlobalString(decisionId),
                    builder.CreateGlobalString(nodeId),
                    builder.CreateGlobalString(valueId),
                    builder.CreateGlobalString(typeId),
                    builder.CreateGlobalString(kind),
                    builder.CreateGlobalString(reason),
                });

            const auto metadataNode = [&](const std::string& text) { return ::llvm::MDNode::get(llvmContext, ::llvm::MDString::get(llvmContext, text)); };
            call->setMetadata("yogi.node", metadataNode(nodeId));
            call->setMetadata("yogi.value", metadataNode(valueId));
            call->setMetadata("yogi.type", metadataNode(typeId));
            call->setMetadata("yogi.decision", metadataNode(decisionId));
        }
#else
        (void)value;
#endif
    }

    void ModuleLoweringContext::clearLocalState() {
        locals.clear();
        localTypes.clear();
        localTypeKinds.clear();
        aggregateAliases.clear();
        borrowedViewAliases.clear();
        nativeResourceFieldDestructors.clear();
        nativeResourceArrayElementFieldDestructors.clear();
        localAggregateCleanups.clear();
        retainEscapedObjectGraph = false;
    }

    ModuleLoweringContext::LocalAggregateCleanup ModuleLoweringContext::createCleanup(
        const std::string& owner,
        int symbolId,
        const Yogi::Sir::TypeRef* type,
        ::llvm::Value* value,
        bool heapOwned,
        ::llvm::Value* cleanupSlot,
        const std::string& runtimeDestroyFunction,
        const Yogi::Sir::SourcePosition* position) {
        const auto typeName = type ? fbString(type->name()) : std::string();
        const auto isStruct = !typeName.empty() && structTypes.contains(typeName);
        const auto* resolvedType = type;
        while (resolvedType && resolvedType->kind() == Yogi::Sir::TypeKind_type_reference && resolvedType->resolved()) {
            resolvedType = resolvedType->resolved();
        }

        std::string cleanupKind = "aggregate";
        std::string destroyFunction = runtimeDestroyFunction;

        if (!runtimeDestroyFunction.empty()) {
            cleanupKind = runtimeDestroyFunction == "yogi_array_iteration_plan_destroy" ? "runtime-temporary" : "native-resource";
        } else if (isStruct) {
            cleanupKind = "struct";
            destroyFunction = "struct.cleanup";
        } else if (resolvedType) {
            switch (resolvedType->kind()) {
                case Yogi::Sir::TypeKind_string_type:
                    cleanupKind = "string";
                    destroyFunction = "yogi_string_destroy";
                    break;
                case Yogi::Sir::TypeKind_array_type:
                case Yogi::Sir::TypeKind_tuple_type:
                    cleanupKind = "array";
                    destroyFunction = "yogi_array_destroy";
                    break;
                case Yogi::Sir::TypeKind_type_literal:
                    cleanupKind = "object";
                    destroyFunction = "yogi_object_destroy";
                    break;
                case Yogi::Sir::TypeKind_type_reference:
                    cleanupKind = "struct";
                    destroyFunction = "struct.cleanup";
                    break;
                default:
                    destroyFunction = heapOwned ? "aggregate.destroy" : "aggregate.drop";
                    break;
            }
        }

        std::ostringstream id;
        id << "cleanup:" << fbString(sirModule->module_id()) << ':' << std::setw(6) << std::setfill('0') << ++cleanupSequence;

        return {
            id.str(),
            owner,
            symbolId,
            type,
            value,
            heapOwned,
            true,
            cleanupSlot,
            runtimeDestroyFunction,
            cleanupKind,
            destroyFunction,
            heapOwned ? "heap" : "stack",
            position,
        };
    }

    void ModuleLoweringContext::recordCleanupEvent(const char* eventKind, const LocalAggregateCleanup& cleanup, const std::string& exitReason) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        const auto moduleId = fbString(sirModule->module_id());
        const auto sourcePath = fbString(sirModule->source_path());
        const auto* position = cleanup.position;
        const auto line = position && position->line() >= 0 ? static_cast<std::size_t>(position->line()) + 1 : 0;
        const auto column = position && position->character() >= 0 ? static_cast<std::size_t>(position->character()) + 1 : 0;
        const auto* insertBlock = builder.GetInsertBlock();
        const auto functionName = insertBlock && insertBlock->getParent() ? insertBlock->getParent()->getName().str() : std::string("<module>");

        yogi::runtime::ProgramObservability::recordCleanupEvent(
            "lowering",
            eventKind,
            cleanup.cleanupId.c_str(),
            cleanup.owner.c_str(),
            cleanup.cleanupKind.c_str(),
            cleanup.destroyFunction.c_str(),
            cleanup.storage.c_str(),
            exitReason.c_str(),
            cleanup.symbolId,
            moduleId.c_str(),
            functionName.c_str(),
            sourcePath.c_str(),
            line,
            column);

        if (std::string(eventKind) == "cleanup.schedule") {
            auto* metadata = module->getOrInsertNamedMetadata("yogi.cleanup.obligations");
            metadata->addOperand(::llvm::MDNode::
                                     get(llvmContext,
                                         {
                                             ::llvm::MDString::get(llvmContext, cleanup.cleanupId),
                                             ::llvm::MDString::get(llvmContext, cleanup.owner),
                                             ::llvm::MDString::get(llvmContext, cleanup.cleanupKind),
                                             ::llvm::MDString::get(llvmContext, cleanup.destroyFunction),
                                             ::llvm::MDString::get(llvmContext, cleanup.storage),
                                         }));
        }
#else
        (void)eventKind;
        (void)cleanup;
        (void)exitReason;
#endif
    }

    void ModuleLoweringContext::recordCleanupEmission(const LocalAggregateCleanup& cleanup, const std::string& exitReason) {
        recordCleanupEvent("cleanup.emit", cleanup, exitReason);
    }

    void ModuleLoweringContext::emitRuntimeCleanupEvent(const LocalAggregateCleanup& cleanup, const std::string& eventKind, const std::string& exitReason) {
#if YOGI_ENABLE_PROGRAM_OBSERVABILITY
        if (!builder.GetInsertBlock() || builder.GetInsertBlock()->hasTerminator()) {
            return;
        }

        auto* pointerType = ::llvm::PointerType::getUnqual(llvmContext);
        auto* integerType = ::llvm::Type::getInt64Ty(llvmContext);
        auto* observer = runtimeFunction("yogi_observe_cleanup", ::llvm::Type::getVoidTy(llvmContext), {pointerType, pointerType, pointerType, pointerType, pointerType, pointerType, pointerType, pointerType, integerType, integerType});
        const auto* position = cleanup.position;
        const auto line = position && position->line() >= 0 ? static_cast<std::uint64_t>(position->line()) + 1 : 0;
        const auto column = position && position->character() >= 0 ? static_cast<std::uint64_t>(position->character()) + 1 : 0;
        auto* call = builder.CreateCall(
            observer,
            {
                builder.CreateGlobalString(cleanup.cleanupId),
                builder.CreateGlobalString(cleanup.owner),
                builder.CreateGlobalString(cleanup.cleanupKind),
                builder.CreateGlobalString(cleanup.destroyFunction),
                builder.CreateGlobalString(cleanup.storage),
                builder.CreateGlobalString(eventKind),
                builder.CreateGlobalString(exitReason),
                builder.CreateGlobalString(fbString(sirModule->source_path())),
                ::llvm::ConstantInt::get(integerType, line),
                ::llvm::ConstantInt::get(integerType, column),
            });
        const auto metadataNode = [&](const std::string& text) { return ::llvm::MDNode::get(llvmContext, ::llvm::MDString::get(llvmContext, text)); };
        call->setMetadata("yogi.cleanup", metadataNode(cleanup.cleanupId));
        call->setMetadata("yogi.owner", metadataNode(cleanup.owner));
        call->setMetadata("yogi.destroy", metadataNode(cleanup.destroyFunction));
        call->setMetadata("yogi.cleanup.exit", metadataNode(exitReason));
#else
        (void)cleanup;
        (void)eventKind;
        (void)exitReason;
#endif
    }

    void ModuleLoweringContext::registerAggregateOwner(const std::string& name, int symbolId, const Yogi::Sir::TypeRef* type, ::llvm::Value* value, bool heapOwned, ::llvm::Value* cleanupSlot, const Yogi::Sir::SourcePosition* position) {
        aggregateAliases[name] = name;
        localAggregateCleanups.push_back(createCleanup(name, symbolId, type, value, heapOwned, cleanupSlot, "", position));
        recordCleanupEvent("cleanup.schedule", localAggregateCleanups.back());
        emitRuntimeCleanupEvent(localAggregateCleanups.back(), "cleanup.activate");
    }

    void ModuleLoweringContext::registerRuntimeCleanup(const std::string& name, int symbolId, ::llvm::Value* value, ::llvm::Value* cleanupSlot, const std::string& destroyFunction, const Yogi::Sir::SourcePosition* position) {
        localAggregateCleanups.push_back(createCleanup(name, symbolId, nullptr, value, false, cleanupSlot, destroyFunction, position));
        recordCleanupEvent("cleanup.schedule", localAggregateCleanups.back());
        emitRuntimeCleanupEvent(localAggregateCleanups.back(), "cleanup.activate");
    }

    void ModuleLoweringContext::registerNativeResourceOwner(const std::string& name, int symbolId, ::llvm::Value* value, ::llvm::Value* cleanupSlot, const std::string& destroyFunction, const Yogi::Sir::SourcePosition* position) {
        aggregateAliases[name] = name;

        for (auto& cleanup : localAggregateCleanups) {
            if (cleanup.owner == name && !cleanup.runtimeDestroyFunction.empty()) {
                cleanup.symbolId = symbolId;
                cleanup.value = value;
                cleanup.cleanupSlot = cleanupSlot;
                cleanup.runtimeDestroyFunction = destroyFunction;
                cleanup.cleanupKind = "native-resource";
                cleanup.destroyFunction = destroyFunction;
                cleanup.storage = "stack";
                cleanup.position = position ? position : cleanup.position;
                cleanup.active = true;
                recordCleanupEvent("cleanup.rearm", cleanup);
                emitRuntimeCleanupEvent(cleanup, "cleanup.rearm");
                return;
            }
        }

        localAggregateCleanups.push_back(createCleanup(name, symbolId, nullptr, value, false, cleanupSlot, destroyFunction, position));
        recordCleanupEvent("cleanup.schedule", localAggregateCleanups.back());
        emitRuntimeCleanupEvent(localAggregateCleanups.back(), "cleanup.activate");
    }

    void ModuleLoweringContext::registerNativeResourceFieldOwner(const std::string& owner, const std::string& fieldPath, const std::string& destroyFunction) {
        if (owner.empty() || fieldPath.empty() || destroyFunction.empty()) {
            return;
        }

        nativeResourceFieldDestructors[owner][fieldPath] = destroyFunction;
    }

    void ModuleLoweringContext::registerNativeResourceFieldOwners(const std::string& owner, const std::map<std::string, std::string>& destroyFunctions) {
        if (owner.empty() || destroyFunctions.empty()) {
            return;
        }

        for (const auto& [fieldPath, destroyFunction] : destroyFunctions) {
            registerNativeResourceFieldOwner(owner, fieldPath, destroyFunction);
        }
    }

    void ModuleLoweringContext::registerNativeResourceArrayElementFieldOwners(const std::string& owner, const std::map<std::string, std::string>& destroyFunctions) {
        if (owner.empty() || destroyFunctions.empty()) {
            return;
        }

        for (const auto& [fieldPath, destroyFunction] : destroyFunctions) {
            if (!fieldPath.empty() && !destroyFunction.empty()) {
                nativeResourceArrayElementFieldDestructors[owner][fieldPath] = destroyFunction;
            }
        }
    }

    void ModuleLoweringContext::clearNativeResourceArrayElementFieldOwners(const std::string& owner) {
        if (owner.empty()) {
            return;
        }

        nativeResourceArrayElementFieldDestructors.erase(owner);
    }

    std::optional<std::string> ModuleLoweringContext::nativeResourceFieldDestroyFunction(const std::string& owner, const std::string& fieldPath) const {
        if (owner.empty() || fieldPath.empty()) {
            return std::nullopt;
        }

        const auto owners = nativeResourceFieldDestructors.find(owner);
        if (owners == nativeResourceFieldDestructors.end()) {
            return std::nullopt;
        }

        const auto field = owners->second.find(fieldPath);
        return field == owners->second.end() ? std::nullopt : std::optional<std::string>(field->second);
    }

    std::map<std::string, std::string> ModuleLoweringContext::nativeResourceFieldDestroyFunctions(const std::string& owner) const {
        const auto fields = nativeResourceFieldDestructors.find(owner);
        return fields == nativeResourceFieldDestructors.end() ? std::map<std::string, std::string>() : fields->second;
    }

    std::map<std::string, std::string> ModuleLoweringContext::nativeResourceArrayElementFieldDestroyFunctions(const std::string& owner) const {
        const auto fields = nativeResourceArrayElementFieldDestructors.find(owner);
        return fields == nativeResourceArrayElementFieldDestructors.end() ? std::map<std::string, std::string>() : fields->second;
    }

    void ModuleLoweringContext::clearNativeResourceFieldOwner(const std::string& owner, const std::string& fieldPath) {
        const auto owners = nativeResourceFieldDestructors.find(owner);
        if (owners == nativeResourceFieldDestructors.end()) {
            return;
        }

        owners->second.erase(fieldPath);
        if (owners->second.empty()) {
            nativeResourceFieldDestructors.erase(owners);
        }
    }

    void ModuleLoweringContext::clearNativeResourceFieldOwners(const std::string& owner) {
        if (owner.empty()) {
            return;
        }

        nativeResourceFieldDestructors.erase(owner);
    }

    void ModuleLoweringContext::moveNativeResourceFieldOwners(const std::string& source, const std::string& target) {
        if (source.empty() || target.empty() || source == target) {
            return;
        }

        const auto fields = nativeResourceFieldDestroyFunctions(source);
        if (fields.empty()) {
            return;
        }

        clearNativeResourceFieldOwners(source);
        registerNativeResourceFieldOwners(target, fields);
    }

    void ModuleLoweringContext::aliasAggregateOwner(const std::string& alias, const std::string& source) {
        const auto owner = resolveAggregateOwner(source);
        if (owner) {
            aggregateAliases[alias] = *owner;
        }
    }

    std::optional<std::string> ModuleLoweringContext::resolveAggregateOwner(const std::string& name) const {
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

    std::optional<std::string> ModuleLoweringContext::nativeResourceDestroyFunction(const std::string& name) const {
        const auto owner = resolveAggregateOwner(name);
        if (!owner) {
            return std::nullopt;
        }

        for (const auto& cleanup : localAggregateCleanups) {
            if (cleanup.active && cleanup.owner == *owner && cleanup.type == nullptr && !cleanup.runtimeDestroyFunction.empty()) {
                return cleanup.runtimeDestroyFunction;
            }
        }

        return std::nullopt;
    }

    void ModuleLoweringContext::deactivateAggregateOwner(const std::string& name) {
        const auto owner = resolveAggregateOwner(name);
        if (!owner) {
            return;
        }

        for (auto& cleanup : localAggregateCleanups) {
            if (cleanup.owner == *owner && cleanup.active) {
                recordCleanupEvent("cleanup.cancel", cleanup);
                emitRuntimeCleanupEvent(cleanup, "cleanup.cancel");
                cleanup.active = false;
            }
        }
    }

    void ModuleLoweringContext::deactivateAggregateOwner(int symbolId) {
        if (symbolId < 0) {
            return;
        }

        for (auto& cleanup : localAggregateCleanups) {
            if (cleanup.symbolId == symbolId && cleanup.active) {
                recordCleanupEvent("cleanup.cancel", cleanup);
                emitRuntimeCleanupEvent(cleanup, "cleanup.cancel");
                cleanup.active = false;
            }
        }
    }
#endif

} // namespace yogi::core::llvm::internal
