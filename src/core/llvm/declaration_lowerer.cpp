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
		const auto symbol_name = "_yogi_" + sanitize_symbol(name);
		auto *type = types_.lower(variable->type());
		auto *global = context_.module->getGlobalVariable(symbol_name);

		if (global) {
			context_.globals[fb_string(variable->name())] = global;
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
			symbol_name
		);

		context_.globals[fb_string(variable->name())] = global;

		return global;
	}

	void VariableLowerer::lower_variable(const Yogi::Sir::VariableDeclaration *variable) {
		auto *type = types_.lower(variable->type());
		auto *initializer = values_.lower(variable->value(), type);

		if (context_.globals.contains(fb_string(variable->name()))) {
			context_.builder.CreateStore(values_.cast(initializer, type), context_.globals[fb_string(variable->name())]);
			return;
		}

		auto *function = context_.builder.GetInsertBlock()->getParent();
		auto *slot = context_.create_entry_alloca(function, fb_string(variable->name()), type);
		context_.builder.CreateStore(values_.cast(initializer, type), slot);
		context_.locals[fb_string(variable->name())] = slot;
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
		std::vector<::llvm::Type *> parameter_types;

		if (function->parameters()) {
			for (const auto *parameter: *function->parameters()) {
				parameter_types.push_back(types_.lower(parameter->type()));
			}
		}

		auto *return_type = types_.lower(function->return_type());
		auto *function_type = ::llvm::FunctionType::get(return_type, parameter_types, false);
		auto *llvm_function = ::llvm::Function::Create(
			function_type,
			function->exported()
				? ::llvm::Function::ExternalLinkage
				: ::llvm::Function::InternalLinkage,
			"_yogi_fn_" + sanitize_symbol(fb_string(function->qualified_name())),
			context_.module.get()
		);

		auto *entry = ::llvm::BasicBlock::Create(context_.llvm_context, "entry", llvm_function);
		context_.builder.SetInsertPoint(entry);
		context_.locals.clear();

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
			}
		}

		statements_->lower_block(function->body());

		if (!context_.builder.GetInsertBlock()->getTerminator()) {
			if (return_type->isVoidTy()) {
				context_.builder.CreateRetVoid();
			} else {
				context_.builder.CreateRet(types_.zero(return_type));
			}
		}

		context_.locals.clear();
	}

} // namespace yogi::core::llvm::internal
#endif
