#include "statement_lowerer.h"

#if YOGI_HAS_LLVM
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Constants.h>
#include <llvm/IR/Function.h>
#include <llvm/IR/Type.h>

namespace yogi::core::llvm::internal {

	StatementLowerer::StatementLowerer(
		ModuleLoweringContext &context,
		TypeLowerer &types,
		ValueLowerer &values,
		VariableLowerer &variables
	)
		: context_(context),
		  types_(types),
		  values_(values),
		  variables_(variables) {}

	void StatementLowerer::lower_module_initializer() {
		auto *function_type = ::llvm::FunctionType::get(::llvm::Type::getVoidTy(context_.llvm_context), false);
		auto *function = ::llvm::Function::Create(
			function_type,
			::llvm::Function::ExternalLinkage,
			"_yogi_module_init_" + context_.module_name(),
			context_.module.get()
		);
		auto *entry = ::llvm::BasicBlock::Create(context_.llvm_context, "entry", function);
		context_.builder.SetInsertPoint(entry);
		context_.locals.clear();

		for (const auto *node: *context_.sir_module->nodes()) {
			if (!node->value_as_FunctionDeclaration()) {
				lower_statement(node);
			}
		}

		if (!context_.builder.GetInsertBlock()->getTerminator()) {
			context_.builder.CreateRetVoid();
		}

		context_.locals.clear();
	}

	void StatementLowerer::lower_entry_point(const std::vector<std::string> &module_initializers) {
		if (!context_.module_meta->is_entry()) {
			return;
		}

		auto *function_type = ::llvm::FunctionType::get(::llvm::Type::getInt32Ty(context_.llvm_context), false);
		auto *function = ::llvm::Function::Create(
			function_type,
			::llvm::Function::ExternalLinkage,
			"main",
			context_.module.get()
		);
		auto *entry = ::llvm::BasicBlock::Create(context_.llvm_context, "entry", function);
		context_.builder.SetInsertPoint(entry);

		auto *initializer_type = ::llvm::FunctionType::get(::llvm::Type::getVoidTy(context_.llvm_context), false);

		for (const auto &initializer_name: module_initializers) {
			auto *initializer = context_.module->getFunction(initializer_name);

			if (!initializer) {
				initializer = ::llvm::Function::Create(
					initializer_type,
					::llvm::Function::ExternalLinkage,
					initializer_name,
					context_.module.get()
				);
			}

			context_.builder.CreateCall(initializer);
		}

		context_.builder.CreateRet(::llvm::ConstantInt::get(::llvm::Type::getInt32Ty(context_.llvm_context), 0));
	}

	void StatementLowerer::lower_block(const Yogi::Sir::BlockStatement *block) {
		if (!block || !block->statements()) {
			return;
		}

		for (const auto *statement: *block->statements()) {
			if (context_.builder.GetInsertBlock()->getTerminator()) {
				return;
			}

			lower_statement(statement);
		}
	}

	void StatementLowerer::lower_statement(const Yogi::Sir::SirNode *node) {
		if (const auto *variable = node->value_as_VariableDeclaration()) {
			variables_.lower_variable(variable);
			return;
		}

		if (const auto *assignment = node->value_as_AssignmentExpression()) {
			values_.lower_assignment(assignment);
			return;
		}

		if (const auto *binary = node->value_as_BinaryExpression()) {
			values_.lower_binary(binary, types_.lower(binary->type()));
			return;
		}

		if (const auto *statement = node->value_as_IfStatement()) {
			lower_if(statement);
			return;
		}

		if (const auto *statement = node->value_as_ReturnStatement()) {
			lower_return(statement);
		}
	}

	void StatementLowerer::lower_return(const Yogi::Sir::ReturnStatement *statement) {
		auto *function = context_.builder.GetInsertBlock()->getParent();
		auto *return_type = function->getReturnType();

		if (return_type->isVoidTy()) {
			context_.builder.CreateRetVoid();
			return;
		}

		context_.builder.CreateRet(values_.cast(values_.lower(statement->value(), return_type), return_type));
	}

	void StatementLowerer::lower_if(const Yogi::Sir::IfStatement *statement) {
		auto *function = context_.builder.GetInsertBlock()->getParent();
		auto *condition = values_.to_boolean(values_.lower(statement->condition(), ::llvm::Type::getInt1Ty(context_.llvm_context)));
		auto *then_block = ::llvm::BasicBlock::Create(context_.llvm_context, "if.then", function);
		auto *else_block = statement->else_block()
			? ::llvm::BasicBlock::Create(context_.llvm_context, "if.else", function)
			: nullptr;
		auto *merge_block = ::llvm::BasicBlock::Create(context_.llvm_context, "if.end", function);

		context_.builder.CreateCondBr(condition, then_block, else_block ? else_block : merge_block);

		context_.builder.SetInsertPoint(then_block);
		lower_block(statement->then_block());
		if (!context_.builder.GetInsertBlock()->getTerminator()) {
			context_.builder.CreateBr(merge_block);
		}

		if (else_block) {
			context_.builder.SetInsertPoint(else_block);
			lower_block(statement->else_block());
			if (!context_.builder.GetInsertBlock()->getTerminator()) {
				context_.builder.CreateBr(merge_block);
			}
		}

		context_.builder.SetInsertPoint(merge_block);
	}

} // namespace yogi::core::llvm::internal
#endif
