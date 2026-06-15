// Created by Brayhan De Aza on 6/15/26.
//

#include "llvm/lowering/declarationLowerer.h"

#include "llvm/lowering/statementLowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Constants.h>
#include <llvm/IR/Function.h>
#include <llvm/IR/GlobalVariable.h>
#include <llvm/IR/Type.h>

namespace yogi::core::llvm::internal {

	VariableLowerer::VariableLowerer(
		ModuleLoweringContext &context,
		TypeLowerer &types,
		ValueLowerer &values
	)
		: context(context),
		  types(types),
		  values(values) {}

	void VariableLowerer::predeclareGlobals() {
		for (const auto *node: *context.sirModule->nodes()) {
			if (const auto *variable = node->value_as_VariableDeclaration()) {
				declareGlobal(variable);
			}
		}
	}

	::llvm::GlobalVariable *VariableLowerer::declareGlobal(const Yogi::Sir::VariableDeclaration *variable) {
		const auto name = fbString(variable->qualified_name()) != ""
			? fbString(variable->qualified_name())
			: fbString(variable->name());
		const auto symbolName = "_yogi_" + sanitizeSymbol(name);
		auto *type = types.lower(variable->type());
		auto *global = context.module->getGlobalVariable(symbolName);

		if (global) {
			context.globals[fbString(variable->name())] = global;
			context.globalTypes[fbString(variable->name())] = variable->type();
			context.globalTypeKinds[fbString(variable->name())] = variable->type()->kind();
			return global;
		}

		global = new ::llvm::GlobalVariable(
			*context.module,
			type,
			false,
			variable->exported()
				? ::llvm::GlobalValue::ExternalLinkage
				: ::llvm::GlobalValue::InternalLinkage,
			types.zero(type),
			symbolName
		);

		context.globals[fbString(variable->name())] = global;
		context.globalTypes[fbString(variable->name())] = variable->type();
		context.globalTypeKinds[fbString(variable->name())] = variable->type()->kind();

		return global;
	}

	void VariableLowerer::lowerVariable(const Yogi::Sir::VariableDeclaration *variable) {
		auto *type = types.lower(variable->type());
		const auto isAggregateType = [](const Yogi::Sir::TypeRef *typeRef) {
			if (!typeRef) {
				return false;
			}

			const auto kind = typeRef->resolved()
				? typeRef->resolved()->kind()
				: typeRef->kind();

			return kind == Yogi::Sir::TypeKind_array_type ||
				kind == Yogi::Sir::TypeKind_tuple_type ||
				kind == Yogi::Sir::TypeKind_type_literal;
		};
		const auto isLocalStackAggregate =
			fbString(variable->storage()) == "stack" &&
			!variable->escapes() &&
			values.isAggregateLiteral(variable->value());
		const auto isLocalOwnedHeapAggregate =
			fbString(variable->storage()) == "stack" &&
			!variable->escapes() &&
			isAggregateType(variable->type()) &&
			variable->value() &&
			variable->value()->call();

		auto *initializer = isLocalStackAggregate
			? values.lowerLocalAggregate(variable->value(), fbString(variable->name()))
			: values.lower(variable->value(), type, variable->type());

		if (context.globals.contains(fbString(variable->name()))) {
			context.builder.CreateStore(
				values.cast(initializer, type, variable->type()),
				context.globals[fbString(variable->name())]
			);
			return;
		}

		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *slot = context.createEntryAlloca(function, fbString(variable->name()), type);
		context.builder.CreateStore(values.cast(initializer, type, variable->type()), slot);
		context.locals[fbString(variable->name())] = slot;
		context.localTypes[fbString(variable->name())] = variable->type();
		context.localTypeKinds[fbString(variable->name())] = variable->type()->kind();

		if (isLocalStackAggregate) {
			context.localAggregateCleanups.push_back({variable->type(), initializer, false});
		}

		if (isLocalOwnedHeapAggregate) {
			context.localAggregateCleanups.push_back({variable->type(), initializer, true});
		}
	}

	FunctionLowerer::FunctionLowerer(
		ModuleLoweringContext &context,
		TypeLowerer &types,
		ValueLowerer &values
	)
		: context(context),
		  types(types),
		  values(values) {}

	void FunctionLowerer::setStatementLowerer(StatementLowerer *statementLowerer) {
		statements = statementLowerer;
	}

	void FunctionLowerer::lowerFunctions() {
		for (const auto *node: *context.sirModule->nodes()) {
			if (const auto *function = node->value_as_FunctionDeclaration()) {
				lowerFunction(function);
			}
		}
	}

	void FunctionLowerer::lowerFunction(const Yogi::Sir::FunctionDeclaration *function) {
		std::vector<::llvm::Type *> parameterTypes;

		if (function->parameters()) {
			for (const auto *parameter: *function->parameters()) {
				parameterTypes.push_back(types.lower(parameter->type()));
			}
		}

		auto *returnType = types.lower(function->return_type());
		auto *functionType = ::llvm::FunctionType::get(returnType, parameterTypes, false);
		auto *llvmFunction = ::llvm::Function::Create(
			functionType,
			function->exported()
				? ::llvm::Function::ExternalLinkage
				: ::llvm::Function::InternalLinkage,
			"_yogi_fn_" + sanitizeSymbol(fbString(function->qualified_name())),
			context.module.get()
		);

		auto *entry = ::llvm::BasicBlock::Create(context.llvmContext, "entry", llvmFunction);
		context.builder.SetInsertPoint(entry);
		context.locals.clear();
		context.localTypes.clear();
		context.localTypeKinds.clear();
		context.localAggregateCleanups.clear();
		context.currentReturnType = function->return_type();

		unsigned index = 0;
		if (function->parameters()) {
			for (const auto *parameter: *function->parameters()) {
				auto *argument = llvmFunction->getArg(index++);
				argument->setName(fbString(parameter->name()));

				auto *slot = context.createEntryAlloca(
					llvmFunction,
					fbString(parameter->name()),
					argument->getType()
				);
				context.builder.CreateStore(argument, slot);
				context.locals[fbString(parameter->name())] = slot;
				context.localTypes[fbString(parameter->name())] = parameter->type();
				context.localTypeKinds[fbString(parameter->name())] = parameter->type()->kind();
			}
		}

		statements->lowerBlock(function->body());

		if (!context.builder.GetInsertBlock()->hasTerminator()) {
			statements->emitLocalCleanups();
			if (returnType->isVoidTy()) {
				context.builder.CreateRetVoid();
			} else {
				context.builder.CreateRet(types.zero(returnType));
			}
		}

		context.locals.clear();
		context.localTypes.clear();
		context.localTypeKinds.clear();
		context.localAggregateCleanups.clear();
		context.currentReturnType = nullptr;
	}

} // namespace yogi::core::llvm::internal
#endif
