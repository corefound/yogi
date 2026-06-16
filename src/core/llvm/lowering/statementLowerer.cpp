// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/lowering/statementLowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Constants.h>
#include <llvm/IR/Function.h>
#include <llvm/IR/Type.h>

#include <map>

namespace yogi::core::llvm::internal {

	namespace {
		std::string identifierName(const Yogi::Sir::ValueRef *value) {
			const auto *identifier = value ? value->identifier() : nullptr;
			return identifier ? fbString(identifier->name()) : "";
		}

		struct OwnershipState {
			std::map<std::string, ::llvm::AllocaInst *> locals;
			std::map<std::string, const Yogi::Sir::TypeRef *> localTypes;
			std::map<std::string, Yogi::Sir::TypeKind> localTypeKinds;
			std::map<std::string, std::string> aggregateAliases;
			std::vector<ModuleLoweringContext::LocalAggregateCleanup> localAggregateCleanups;
		};
	}

	StatementLowerer::StatementLowerer(
		ModuleLoweringContext &context,
		TypeLowerer &types,
		ValueLowerer &values,
		VariableLowerer &variables
	)
		: context(context),
		  types(types),
		  values(values),
		  variables(variables) {}

	void StatementLowerer::lowerModuleInitializer() {
		auto *functionType = ::llvm::FunctionType::get(::llvm::Type::getVoidTy(context.llvmContext), false);
		auto *function = ::llvm::Function::Create(
			functionType,
			::llvm::Function::ExternalLinkage,
			"_yogi_module_init_" + context.moduleName(),
			context.module.get()
		);
		auto *entry = ::llvm::BasicBlock::Create(context.llvmContext, "entry", function);
		context.builder.SetInsertPoint(entry);
		context.clearLocalState();
		context.pushMemoryContext("$module.init");

		for (const auto *node: *context.sirModule->nodes()) {
			if (!node->value_as_FunctionDeclaration()) {
				lowerStatement(node);
			}
		}

		if (!context.builder.GetInsertBlock()->hasTerminator()) {
			context.popMemoryContext();
			context.builder.CreateRetVoid();
		}

		context.clearLocalState();
	}

	void StatementLowerer::lowerModuleCleanup() {
		auto *functionType = ::llvm::FunctionType::get(::llvm::Type::getVoidTy(context.llvmContext), false);
		auto *function = ::llvm::Function::Create(
			functionType,
			::llvm::Function::ExternalLinkage,
			"_yogi_module_cleanup_" + context.moduleName(),
			context.module.get()
		);
		auto *entry = ::llvm::BasicBlock::Create(context.llvmContext, "entry", function);
		context.builder.SetInsertPoint(entry);
		context.pushMemoryContext("$module.cleanup");

		for (const auto *node: *context.sirModule->nodes()) {
			const auto *variable = node->value_as_VariableDeclaration();

			if (!variable || !context.globals.contains(fbString(variable->name()))) {
				continue;
			}

			auto *global = context.globals[fbString(variable->name())];
			auto *value = context.builder.CreateLoad(global->getValueType(), global);
			values.destroyEscapedAggregate(variable->type(), value);
			context.builder.CreateStore(::llvm::Constant::getNullValue(global->getValueType()), global);
		}

		context.popMemoryContext();
		context.builder.CreateRetVoid();
	}

	void StatementLowerer::lowerEntryPoint(
		const std::vector<std::string> &moduleInitializers,
		const std::vector<std::string> &moduleCleanups
	) {
		if (!context.moduleMeta->is_entry()) {
			return;
		}

		auto *functionType = ::llvm::FunctionType::get(::llvm::Type::getInt32Ty(context.llvmContext), false);
		auto *function = ::llvm::Function::Create(
			functionType,
			::llvm::Function::ExternalLinkage,
			"main",
			context.module.get()
		);
		auto *entry = ::llvm::BasicBlock::Create(context.llvmContext, "entry", function);
		context.builder.SetInsertPoint(entry);
		context.pushMemoryContext("main");

		auto *initializerType = ::llvm::FunctionType::get(::llvm::Type::getVoidTy(context.llvmContext), false);

		for (const auto &initializerName: moduleInitializers) {
			auto *initializer = context.module->getFunction(initializerName);

			if (!initializer) {
				initializer = ::llvm::Function::Create(
					initializerType,
					::llvm::Function::ExternalLinkage,
					initializerName,
					context.module.get()
				);
			}

			context.builder.CreateCall(initializer);
		}

		for (auto cleanupName = moduleCleanups.rbegin(); cleanupName != moduleCleanups.rend(); ++cleanupName) {
			auto *cleanup = context.module->getFunction(*cleanupName);

			if (!cleanup) {
				cleanup = ::llvm::Function::Create(
					initializerType,
					::llvm::Function::ExternalLinkage,
					*cleanupName,
					context.module.get()
				);
			}

			context.builder.CreateCall(cleanup);
		}

		context.popMemoryContext();
		context.builder.CreateRet(::llvm::ConstantInt::get(::llvm::Type::getInt32Ty(context.llvmContext), 0));
	}

	void StatementLowerer::lowerBlock(const Yogi::Sir::BlockStatement *block) {
		if (!block || !block->statements()) {
			return;
		}

		const auto firstCleanup = context.localAggregateCleanups.size();

		for (const auto *statement: *block->statements()) {
			if (context.builder.GetInsertBlock()->hasTerminator()) {
				return;
			}

			lowerStatement(statement);
		}

		if (!context.builder.GetInsertBlock()->hasTerminator()) {
			emitLocalCleanupsFrom(firstCleanup);
		}
	}

	void StatementLowerer::lowerStatement(const Yogi::Sir::SirNode *node) {
		if (const auto *variable = node->value_as_VariableDeclaration()) {
			variables.lowerVariable(variable);
			return;
		}

		if (const auto *assignment = node->value_as_AssignmentExpression()) {
			values.lowerAssignment(assignment);
			return;
		}

		if (const auto *binary = node->value_as_BinaryExpression()) {
			values.lowerBinary(binary, types.lower(binary->type()));
			return;
		}

		if (const auto *conditional = node->value_as_ConditionalExpression()) {
			values.lowerConditional(conditional, types.lower(conditional->type()), conditional->type());
			return;
		}

		if (const auto *call = node->value_as_CallExpression()) {
			values.lowerCall(call, types.lower(call->type()), call->type());
			return;
		}

		if (const auto *assignment = node->value_as_AggregateAssignmentExpression()) {
			values.lowerAggregateAssignment(assignment);
			return;
		}

		if (const auto *statement = node->value_as_IfStatement()) {
			lowerIf(statement);
			return;
		}

		if (const auto *statement = node->value_as_BlockStatement()) {
			lowerBlock(statement);
			return;
		}

		if (const auto *statement = node->value_as_WhileStatement()) {
			lowerWhile(statement);
			return;
		}

		if (const auto *statement = node->value_as_ForStatement()) {
			lowerFor(statement);
			return;
		}

		if (const auto *statement = node->value_as_BreakStatement()) {
			lowerBreak(statement);
			return;
		}

		if (const auto *statement = node->value_as_ContinueStatement()) {
			lowerContinue(statement);
			return;
		}

		if (const auto *statement = node->value_as_ReturnStatement()) {
			lowerReturn(statement);
		}
	}

	void StatementLowerer::lowerReturn(const Yogi::Sir::ReturnStatement *statement) {
		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *returnType = function->getReturnType();

		if (returnType->isVoidTy()) {
			emitLocalCleanups();
			context.popMemoryContext();
			context.builder.CreateRetVoid();
			return;
		}

		context.pushMemorySourceLocation(statement->position());
		auto *returnValue = values.cast(
			values.lower(statement->value(), returnType, context.currentReturnType),
			returnType,
			context.currentReturnType
		);
		context.popMemorySourceLocation();

		const auto returnedName = identifierName(statement->value());
		if (!returnedName.empty()) {
			context.deactivateAggregateOwner(returnedName);
		}

		emitLocalCleanups();
		context.popMemoryContext();
		context.builder.CreateRet(returnValue);
	}

	void StatementLowerer::emitLocalCleanups() {
		emitLocalCleanupsFrom(0);
	}

	void StatementLowerer::emitLocalCleanupsFrom(std::size_t firstCleanup) {
		if (firstCleanup >= context.localAggregateCleanups.size()) {
			return;
		}

		for (auto index = context.localAggregateCleanups.size(); index > firstCleanup; --index) {
			const auto &cleanup = context.localAggregateCleanups[index - 1];
			if (!cleanup.active) {
				continue;
			}

			if (cleanup.heapOwned) {
				values.destroyEscapedAggregate(cleanup.type, cleanup.value);
			} else {
				values.dropLocalAggregate(cleanup.type, cleanup.value);
			}
		}

		context.localAggregateCleanups.resize(firstCleanup);
	}

	void StatementLowerer::lowerIf(const Yogi::Sir::IfStatement *statement) {
		const auto captureState = [&]() {
			return OwnershipState{
				context.locals,
				context.localTypes,
				context.localTypeKinds,
				context.aggregateAliases,
				context.localAggregateCleanups,
			};
		};
		const auto restoreState = [&](const OwnershipState &state) {
			context.locals = state.locals;
			context.localTypes = state.localTypes;
			context.localTypeKinds = state.localTypeKinds;
			context.aggregateAliases = state.aggregateAliases;
			context.localAggregateCleanups = state.localAggregateCleanups;
		};
		const auto mergeState = [&](const OwnershipState &base, const std::vector<OwnershipState> &reachableStates) {
			auto merged = base;

			for (std::size_t cleanupIndex = 0; cleanupIndex < merged.localAggregateCleanups.size(); ++cleanupIndex) {
				for (const auto &state: reachableStates) {
					if (cleanupIndex >= state.localAggregateCleanups.size()) {
						merged.localAggregateCleanups[cleanupIndex].active = false;
						continue;
					}

					if (!state.localAggregateCleanups[cleanupIndex].active) {
						merged.localAggregateCleanups[cleanupIndex].active = false;
					}
				}
			}

			return merged;
		};

		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *condition = values.toBoolean(values.lower(statement->condition(), ::llvm::Type::getInt1Ty(context.llvmContext)));
		auto *thenBlock = ::llvm::BasicBlock::Create(context.llvmContext, "if.then", function);
		auto *elseBlock = statement->else_block()
			? ::llvm::BasicBlock::Create(context.llvmContext, "if.else", function)
			: nullptr;
		auto *mergeBlock = ::llvm::BasicBlock::Create(context.llvmContext, "if.end", function);
		const auto incomingState = captureState();
		std::vector<OwnershipState> reachableStates;

		context.builder.CreateCondBr(condition, thenBlock, elseBlock ? elseBlock : mergeBlock);

		context.builder.SetInsertPoint(thenBlock);
		restoreState(incomingState);
		lowerBlock(statement->then_block());
		if (!context.builder.GetInsertBlock()->hasTerminator()) {
			context.builder.CreateBr(mergeBlock);
			reachableStates.push_back(captureState());
		}

		if (elseBlock) {
			context.builder.SetInsertPoint(elseBlock);
			restoreState(incomingState);
			lowerBlock(statement->else_block());
			if (!context.builder.GetInsertBlock()->hasTerminator()) {
				context.builder.CreateBr(mergeBlock);
				reachableStates.push_back(captureState());
			}
		} else {
			reachableStates.push_back(incomingState);
		}

		context.builder.SetInsertPoint(mergeBlock);
		if (reachableStates.empty()) {
			context.builder.CreateUnreachable();
			restoreState(incomingState);
			return;
		}

		restoreState(mergeState(incomingState, reachableStates));
	}

	void StatementLowerer::lowerWhile(const Yogi::Sir::WhileStatement *statement) {
		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *conditionBlock = ::llvm::BasicBlock::Create(context.llvmContext, "while.cond", function);
		auto *bodyBlock = ::llvm::BasicBlock::Create(context.llvmContext, "while.body", function);
		auto *endBlock = ::llvm::BasicBlock::Create(context.llvmContext, "while.end", function);
		const auto cleanupStart = context.localAggregateCleanups.size();

		context.builder.CreateBr(conditionBlock);

		context.builder.SetInsertPoint(conditionBlock);
		auto *condition = values.toBoolean(values.lower(statement->condition(), ::llvm::Type::getInt1Ty(context.llvmContext)));
		context.builder.CreateCondBr(condition, bodyBlock, endBlock);

		context.builder.SetInsertPoint(bodyBlock);
		loopFrames.push_back({
			endBlock,
			conditionBlock,
			cleanupStart,
			cleanupStart,
		});
		lowerBlock(statement->body());
		loopFrames.pop_back();

		if (!context.builder.GetInsertBlock()->hasTerminator()) {
			context.builder.CreateBr(conditionBlock);
		}

		context.builder.SetInsertPoint(endBlock);
		emitLocalCleanupsFrom(cleanupStart);
	}

	void StatementLowerer::lowerFor(const Yogi::Sir::ForStatement *statement) {
		const auto loopScopeStart = context.localAggregateCleanups.size();

		if (statement->initializer()) {
			lowerStatement(statement->initializer());
		}

		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *conditionBlock = ::llvm::BasicBlock::Create(context.llvmContext, "for.cond", function);
		auto *bodyBlock = ::llvm::BasicBlock::Create(context.llvmContext, "for.body", function);
		auto *incrementBlock = ::llvm::BasicBlock::Create(context.llvmContext, "for.inc", function);
		auto *endBlock = ::llvm::BasicBlock::Create(context.llvmContext, "for.end", function);
		const auto bodyCleanupStart = context.localAggregateCleanups.size();

		context.builder.CreateBr(conditionBlock);

		context.builder.SetInsertPoint(conditionBlock);
		if (statement->condition() && statement->condition()->kind()) {
			auto *condition = values.toBoolean(values.lower(statement->condition(), ::llvm::Type::getInt1Ty(context.llvmContext)));
			context.builder.CreateCondBr(condition, bodyBlock, endBlock);
		} else {
			context.builder.CreateBr(bodyBlock);
		}

		context.builder.SetInsertPoint(bodyBlock);
		loopFrames.push_back({
			endBlock,
			incrementBlock,
			bodyCleanupStart,
			bodyCleanupStart,
		});
		lowerBlock(statement->body());
		loopFrames.pop_back();

		if (!context.builder.GetInsertBlock()->hasTerminator()) {
			context.builder.CreateBr(incrementBlock);
		}

		context.builder.SetInsertPoint(incrementBlock);
		if (statement->incrementor() && statement->incrementor()->kind()) {
			values.lower(statement->incrementor(), nullptr);
		}
		if (!context.builder.GetInsertBlock()->hasTerminator()) {
			context.builder.CreateBr(conditionBlock);
		}

		context.builder.SetInsertPoint(endBlock);
		emitLocalCleanupsFrom(loopScopeStart);
	}

	void StatementLowerer::lowerBreak(const Yogi::Sir::BreakStatement *) {
		if (loopFrames.empty()) {
			context.builder.CreateUnreachable();
			return;
		}

		const auto frame = loopFrames.back();
		emitLocalCleanupsFrom(frame.breakCleanupStart);
		context.builder.CreateBr(frame.breakBlock);
	}

	void StatementLowerer::lowerContinue(const Yogi::Sir::ContinueStatement *) {
		if (loopFrames.empty()) {
			context.builder.CreateUnreachable();
			return;
		}

		const auto frame = loopFrames.back();
		emitLocalCleanupsFrom(frame.continueCleanupStart);
		context.builder.CreateBr(frame.continueBlock);
	}

} // namespace yogi::core::llvm::internal
#endif
