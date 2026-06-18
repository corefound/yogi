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
		const auto name = fbString(variable->name());
		const auto isGlobalVariable = context.globals.contains(name);
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
		const auto receiverReturningArrayMethod = [](const Yogi::Sir::ValueRef *value) {
			const auto *call = value ? value->call() : nullptr;
			if (!call || !call->builtin_method()) {
				return false;
			}

			const auto method = fbString(call->builtin_method());
			return method == "array.reverse" ||
				method == "array.fill" ||
				method == "array.copyWithin";
		};
		const auto isOwnedAggregateInitializer =
			variable->value() &&
			(
				values.isAggregateLiteral(variable->value()) ||
				(variable->value()->call() && !receiverReturningArrayMethod(variable->value()))
			);
		const auto isLocalStackAggregate =
			!isGlobalVariable &&
			fbString(variable->storage()) == "stack" &&
			!variable->escapes() &&
			values.isAggregateLiteral(variable->value());
		const auto isLocalOwnedHeapAggregate =
			!isGlobalVariable &&
			fbString(variable->storage()) == "stack" &&
			isAggregateType(variable->type()) &&
			isOwnedAggregateInitializer &&
			!isLocalStackAggregate;

		context.pushMemorySourceLocation(variable->position());
		auto *initializer = isLocalStackAggregate
			? values.lowerLocalAggregate(variable->value(), name)
			: values.lower(variable->value(), type, variable->type());
		context.popMemorySourceLocation();

		if (isGlobalVariable) {
			context.builder.CreateStore(
				values.cast(initializer, type, variable->type()),
				context.globals[name]
			);
			return;
		}

		auto *function = context.builder.GetInsertBlock()->getParent();
		auto *slot = context.createEntryAlloca(function, name, type);

		const auto inSwitchBody = context.switchBodyDepth > 0;
		if (inSwitchBody && (isLocalStackAggregate || isLocalOwnedHeapAggregate)) {
			auto entryIt = function->getEntryBlock().begin();
			++entryIt;
			::llvm::IRBuilder<> entryBuilder(&function->getEntryBlock(), entryIt);
			entryBuilder.CreateStore(::llvm::Constant::getNullValue(type), slot);
		}

		context.builder.CreateStore(values.cast(initializer, type, variable->type()), slot);
		context.locals[name] = slot;
		context.localTypes[name] = variable->type();
		context.localTypeKinds[name] = variable->type()->kind();

		if (isLocalStackAggregate) {
			context.registerAggregateOwner(
				name, variable->symbol_id(), variable->type(),
				initializer, false,
				inSwitchBody ? slot : nullptr
			);
		} else if (isLocalOwnedHeapAggregate) {
			context.registerAggregateOwner(
				name, variable->symbol_id(), variable->type(),
				initializer, true,
				inSwitchBody ? slot : nullptr
			);
		} else if (isAggregateType(variable->type())) {
			if (const auto *identifier = variable->value() ? variable->value()->identifier() : nullptr) {
				context.aliasAggregateOwner(name, fbString(identifier->name()));
			} else if (const auto *call = variable->value() ? variable->value()->call() : nullptr) {
				const auto *property = call->callee() ? call->callee()->property_access() : nullptr;
				const auto *receiver = property && property->object() ? property->object()->identifier() : nullptr;

				if (receiverReturningArrayMethod(variable->value()) && receiver) {
					context.aliasAggregateOwner(name, fbString(receiver->name()));
				}
			}
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
		context.clearLocalState();
		context.currentReturnType = function->return_type();
		context.pushMemoryContext(fbString(function->qualified_name()));

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
			context.popMemoryContext();
			if (returnType->isVoidTy()) {
				context.builder.CreateRetVoid();
			} else {
				context.builder.CreateRet(types.zero(returnType));
			}
		}

		context.clearLocalState();
		context.currentReturnType = nullptr;
	}

} // namespace yogi::core::llvm::internal
#endif
