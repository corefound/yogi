#include "declaration_lowerer.h"

#include "statement_lowerer.h"

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
		: context_(context),
		  types_(types),
		  values_(values) {}

	void VariableLowerer::predeclare_globals() {
		for (const auto *node: *context_.sir_module->nodes()) {
			if (const auto *variable = node->value_as_VariableDeclaration()) {
				declare_global(variable);
			}
		}
	}

	::llvm::GlobalVariable *VariableLowerer::declare_global(const Yogi::Sir::VariableDeclaration *variable) {
		const auto name = fb_string(variable->qualified_name()) != ""
			? fb_string(variable->qualified_name())
			: fb_string(variable->name());
		const auto symbolName = "_yogi_" + sanitize_symbol(name);
		auto *type = types_.lower(variable->type());
		auto *global = context_.module->getGlobalVariable(symbolName);

		if (global) {
			context_.globals[fb_string(variable->name())] = global;
			context_.globalTypes[fb_string(variable->name())] = variable->type();
			context_.globalTypeKinds[fb_string(variable->name())] = variable->type()->kind();
			return global;
		}

		global = new ::llvm::GlobalVariable(
			*context_.module,
			type,
			false,
			variable->exported()
				? ::llvm::GlobalValue::ExternalLinkage
				: ::llvm::GlobalValue::InternalLinkage,
			types_.zero(type),
			symbolName
		);

		context_.globals[fb_string(variable->name())] = global;
		context_.globalTypes[fb_string(variable->name())] = variable->type();
		context_.globalTypeKinds[fb_string(variable->name())] = variable->type()->kind();

		return global;
	}

	void VariableLowerer::lower_variable(const Yogi::Sir::VariableDeclaration *variable) {
		auto *type = types_.lower(variable->type());
		auto *initializer = values_.lower(variable->value(), type, variable->type());

		if (context_.globals.contains(fb_string(variable->name()))) {
			context_.builder.CreateStore(
				values_.cast(initializer, type, variable->type()),
				context_.globals[fb_string(variable->name())]
			);
			return;
		}

		auto *function = context_.builder.GetInsertBlock()->getParent();
		auto *slot = context_.create_entry_alloca(function, fb_string(variable->name()), type);
		context_.builder.CreateStore(values_.cast(initializer, type, variable->type()), slot);
		context_.locals[fb_string(variable->name())] = slot;
		context_.localTypes[fb_string(variable->name())] = variable->type();
		context_.localTypeKinds[fb_string(variable->name())] = variable->type()->kind();
	}

	FunctionLowerer::FunctionLowerer(
		ModuleLoweringContext &context,
		TypeLowerer &types,
		ValueLowerer &values
	)
		: context_(context),
		  types_(types),
		  values_(values) {}

	void FunctionLowerer::set_statement_lowerer(StatementLowerer *statements) {
		statements_ = statements;
	}

	void FunctionLowerer::lower_functions() {
		for (const auto *node: *context_.sir_module->nodes()) {
			if (const auto *function = node->value_as_FunctionDeclaration()) {
				lower_function(function);
			}
		}
	}

	void FunctionLowerer::lower_function(const Yogi::Sir::FunctionDeclaration *function) {
		std::vector<::llvm::Type *> parameterTypes;

		if (function->parameters()) {
			for (const auto *parameter: *function->parameters()) {
				parameterTypes.push_back(types_.lower(parameter->type()));
			}
		}

		auto *returnType = types_.lower(function->return_type());
		auto *functionType = ::llvm::FunctionType::get(returnType, parameterTypes, false);
		auto *llvm_function = ::llvm::Function::Create(
			functionType,
			function->exported()
				? ::llvm::Function::ExternalLinkage
				: ::llvm::Function::InternalLinkage,
			"_yogi_fn_" + sanitize_symbol(fb_string(function->qualified_name())),
			context_.module.get()
		);

		auto *entry = ::llvm::BasicBlock::Create(context_.llvm_context, "entry", llvm_function);
		context_.builder.SetInsertPoint(entry);
		context_.locals.clear();
		context_.localTypes.clear();
		context_.localTypeKinds.clear();
		context_.currentReturnType = function->return_type();

		unsigned index = 0;
		if (function->parameters()) {
			for (const auto *parameter: *function->parameters()) {
				auto *argument = llvm_function->getArg(index++);
				argument->setName(fb_string(parameter->name()));

				auto *slot = context_.create_entry_alloca(
					llvm_function,
					fb_string(parameter->name()),
					argument->getType()
				);
				context_.builder.CreateStore(argument, slot);
				context_.locals[fb_string(parameter->name())] = slot;
				context_.localTypes[fb_string(parameter->name())] = parameter->type();
				context_.localTypeKinds[fb_string(parameter->name())] = parameter->type()->kind();
			}
		}

		statements_->lower_block(function->body());

		if (!context_.builder.GetInsertBlock()->hasTerminator()) {
			if (returnType->isVoidTy()) {
				context_.builder.CreateRetVoid();
			} else {
				context_.builder.CreateRet(types_.zero(returnType));
			}
		}

		context_.locals.clear();
		context_.localTypes.clear();
		context_.localTypeKinds.clear();
		context_.currentReturnType = nullptr;
	}

} // namespace yogi::core::llvm::internal
#endif
