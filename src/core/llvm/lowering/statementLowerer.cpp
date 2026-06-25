// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/lowering/statementLowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Constants.h>
#include <llvm/IR/Function.h>
#include <llvm/IR/Instructions.h>
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

		bool isStringType(const Yogi::Sir::TypeRef *type) {
			if (!type) {
				return false;
			}

			const auto kind = type->resolved()
				? type->resolved()->kind()
				: type->kind();

			return kind == Yogi::Sir::TypeKind_string_type;
		}
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
		std::vector<::llvm::Value *> destroyedAggregates;

		for (const auto *node: *context.sirModule->nodes()) {
			const auto *variable = node->value_as_VariableDeclaration();

			if (!variable || !context.globals.contains(fbString(variable->name()))) {
				continue;
			}

			auto *global = context.globals[fbString(variable->name())];
			auto *value = context.builder.CreateLoad(global->getValueType(), global);
			if (value->getType()->isPointerTy()) {
				auto *isNull = context.builder.CreateIsNull(value);
				::llvm::Value *alreadyDestroyed = ::llvm::ConstantInt::getFalse(context.llvmContext);

				for (auto *destroyed: destroyedAggregates) {
					alreadyDestroyed = context.builder.CreateOr(
						alreadyDestroyed,
						context.builder.CreateICmpEQ(value, destroyed)
					);
				}

				auto *shouldDestroy = context.builder.CreateAnd(
					context.builder.CreateNot(isNull),
					context.builder.CreateNot(alreadyDestroyed)
				);
				auto *destroyBlock = ::llvm::BasicBlock::Create(context.llvmContext, "module.cleanup.destroy", function);
				auto *skipBlock = ::llvm::BasicBlock::Create(context.llvmContext, "module.cleanup.skip", function);

				context.builder.CreateCondBr(shouldDestroy, destroyBlock, skipBlock);
				context.builder.SetInsertPoint(destroyBlock);
				values.destroyEscapedAggregate(variable->type(), value);
				context.builder.CreateBr(skipBlock);
				context.builder.SetInsertPoint(skipBlock);
				destroyedAggregates.push_back(value);
			} else {
				values.destroyEscapedAggregate(variable->type(), value);
			}
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
			auto *result = values.lowerBinary(binary, types.lower(binary->type()), binary->type());
			if (isStringType(binary->type())) {
				values.destroyEscapedAggregate(binary->type(), result);
			}
			return;
		}

		if (const auto *conditional = node->value_as_ConditionalExpression()) {
			auto *result = values.lowerConditional(conditional, types.lower(conditional->type()), conditional->type());
			if (isStringType(conditional->type())) {
				values.destroyEscapedAggregate(conditional->type(), result);
			}
			return;
		}

		if (const auto *call = node->value_as_CallExpression()) {
			auto *result = values.lowerCall(call, types.lower(call->type()), call->type());
			if (isStringType(call->type())) {
				values.destroyEscapedAggregate(call->type(), result);
			}
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

		if (const auto *statement = node->value_as_SwitchStatement()) {
			lowerSwitch(statement);
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

			if (cleanup.cleanupSlot) {
				auto *loaded = context.builder.CreateLoad(
					::llvm::PointerType::getUnqual(context.llvmContext),
					cleanup.cleanupSlot
				);
				auto *isNull = context.builder.CreateIsNull(loaded);
				auto *currentBB = context.builder.GetInsertBlock();
				auto *function = currentBB->getParent();
				auto *cleanupBB = ::llvm::BasicBlock::Create(
					context.llvmContext, "agg.cleanup", function
				);
				auto *skipBB = ::llvm::BasicBlock::Create(
					context.llvmContext, "agg.skip", function
				);
				context.builder.CreateCondBr(isNull, skipBB, cleanupBB);
				context.builder.SetInsertPoint(cleanupBB);

				if (cleanup.heapOwned) {
					values.destroyEscapedAggregate(cleanup.type, loaded);
				} else {
					values.dropLocalAggregate(cleanup.type, loaded);
				}

				context.builder.CreateStore(
					::llvm::Constant::getNullValue(
						::llvm::cast<::llvm::AllocaInst>(cleanup.cleanupSlot)->getAllocatedType()
					),
					cleanup.cleanupSlot
				);
				context.builder.CreateBr(skipBB);
				context.builder.SetInsertPoint(skipBB);
			} else {
				if (cleanup.heapOwned) {
					values.destroyEscapedAggregate(cleanup.type, cleanup.value);
				} else {
					values.dropLocalAggregate(cleanup.type, cleanup.value);
				}
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
		breakFrames.push_back({endBlock, cleanupStart});
		lowerBlock(statement->body());
		breakFrames.pop_back();
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
			if (const auto *initializerBlock = statement->initializer()->value_as_BlockStatement()) {
				if (initializerBlock->statements()) {
					for (const auto *initializerStatement: *initializerBlock->statements()) {
						if (context.builder.GetInsertBlock()->hasTerminator()) {
							break;
						}

						lowerStatement(initializerStatement);
					}
				}
			} else {
				lowerStatement(statement->initializer());
			}
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
		breakFrames.push_back({endBlock, bodyCleanupStart});
		lowerBlock(statement->body());
		breakFrames.pop_back();
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
		if (breakFrames.empty()) {
			context.builder.CreateUnreachable();
			return;
		}

		const auto &frame = breakFrames.back();
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

	void StatementLowerer::lowerSwitch(const Yogi::Sir::SwitchStatement *statement) {
		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *discriminant = values.lower(statement->expression(), ::llvm::Type::getDoubleTy(context.llvmContext));
		auto *switchEndBB = ::llvm::BasicBlock::Create(context.llvmContext, "switch.end", function);
		const auto captureState = [&]() {
			return OwnershipState{
				context.locals,
				context.localTypes,
				context.localTypeKinds,
				context.aggregateAliases,
				context.localAggregateCleanups,
			};
		};
		const auto restoreNameState = [&](const OwnershipState &state) {
			context.locals = state.locals;
			context.localTypes = state.localTypes;
			context.localTypeKinds = state.localTypeKinds;
			context.aggregateAliases = state.aggregateAliases;
		};
		const auto incomingState = captureState();

		const auto clauses = statement->clauses();
		::flatbuffers::uoffset_t numClauses = clauses ? clauses->size() : 0;

		if (numClauses == 0) {
			context.builder.CreateBr(switchEndBB);
			context.builder.SetInsertPoint(switchEndBB);
			return;
		}

		// Build body blocks in source order.
		// Also track which source positions are case clauses vs default.
		struct ClauseInfo {
			::llvm::BasicBlock *bodyBB;
			bool isCase;
		};
		std::vector<ClauseInfo> clauseInfos;
		int defaultIndex = -1;
		clauseInfos.reserve(numClauses);

		for (::flatbuffers::uoffset_t i = 0; i < numClauses; ++i) {
			const auto *clause = clauses->Get(i);
			const auto *caseClause = clause->value_as_CaseClause();
			const bool isCase = caseClause != nullptr;
			const auto bodyLabel = isCase
				? "switch.case" + std::to_string(i) + ".body"
				: "switch.default.body";

			auto *bodyBB = ::llvm::BasicBlock::Create(context.llvmContext, bodyLabel, function);
			clauseInfos.push_back({bodyBB, isCase});

			if (!isCase) {
				defaultIndex = static_cast<int>(i);
			}
		}

		// Build check chain for case clauses only.
		// Two-pass approach: first collect all case positions and create their
		// check blocks, then wire them up (so each check knows its fallthrough
		// target at creation time).
		std::vector<::flatbuffers::uoffset_t> casePositions;
		for (::flatbuffers::uoffset_t i = 0; i < numClauses; ++i) {
			if (clauseInfos[i].isCase) {
				casePositions.push_back(i);
			}
		}

		std::vector<::llvm::BasicBlock *> checkBBs;
		for (auto pos : casePositions) {
			checkBBs.push_back(::llvm::BasicBlock::Create(
				context.llvmContext, "switch.check" + std::to_string(pos), function
			));
		}

		// Branch from entry to the first check (or directly to default/switch.end)
		// Do this BEFORE wiring checks, so the builder is still in the entry block.
		if (!checkBBs.empty()) {
			context.builder.CreateBr(checkBBs[0]);
		} else if (defaultIndex >= 0) {
			context.builder.CreateBr(clauseInfos[defaultIndex].bodyBB);
		} else {
			context.builder.CreateBr(switchEndBB);
		}

		// Wire each check block
		for (std::size_t ci = 0; ci < checkBBs.size(); ++ci) {
			auto *checkBB = checkBBs[ci];
			auto *matchBB = clauseInfos[casePositions[ci]].bodyBB;
			const auto *caseClause = clauses->Get(casePositions[ci])->value_as_CaseClause();

			// Determine fallthrough (no-match) target
			::llvm::BasicBlock *noMatchBB = switchEndBB;
			if (ci + 1 < checkBBs.size()) {
				noMatchBB = checkBBs[ci + 1];
			} else if (defaultIndex >= 0) {
				noMatchBB = clauseInfos[defaultIndex].bodyBB;
			}

			context.builder.SetInsertPoint(checkBB);
			auto *caseValue = values.lower(
				caseClause->expression(),
				::llvm::Type::getDoubleTy(context.llvmContext)
			);
			auto *cmp = context.builder.CreateFCmpOEQ(
				discriminant, caseValue, "switch.cmp" + std::to_string(casePositions[ci])
			);
			context.builder.CreateCondBr(cmp, matchBB, noMatchBB);
		}

		// Lower each clause body in source order, chaining via fall-through.
		// IMPORTANT: We process clause body statements directly (not via lowerBlock)
		// because lowerBlock emits scope cleanup at the end which would prematurely
		// clean aggregates before fallthrough (shared switch scope semantics).
		const auto switchCleanupStart = context.localAggregateCleanups.size();
		breakFrames.push_back({switchEndBB, switchCleanupStart});
		context.switchBodyDepth++;

		for (::flatbuffers::uoffset_t i = 0; i < numClauses; ++i) {
			const auto *clause = clauses->Get(i);
			auto *bodyBB = clauseInfos[i].bodyBB;

			context.builder.SetInsertPoint(bodyBB);

			const auto *body = clauseInfos[i].isCase
				? clause->value_as_CaseClause()->body()
				: clause->value_as_DefaultClause()->body();

			// Process body statements directly — no scope cleanup at block end.
			// This preserves aggregates across fallthrough boundaries.
			if (body && body->statements()) {
				for (auto *stmt : *body->statements()) {
					if (context.builder.GetInsertBlock()->hasTerminator()) {
						break;
					}
					lowerStatement(stmt);
				}
			}

			// If this clause didn't terminate, fall through to the next clause
			if (!context.builder.GetInsertBlock()->hasTerminator()) {
				if (i + 1 < numClauses) {
					context.builder.CreateBr(clauseInfos[i + 1].bodyBB);
				} else {
					context.builder.CreateBr(switchEndBB);
				}
			}
		}

		context.switchBodyDepth--;
		breakFrames.pop_back();

		// At switch.end, clean up switch-local aggregates (those created inside
		// any clause body that haven't already been cleaned by break/return).
		context.builder.SetInsertPoint(switchEndBB);
		emitLocalCleanupsFrom(switchCleanupStart);
		restoreNameState(incomingState);
	}

} // namespace yogi::core::llvm::internal
#endif
