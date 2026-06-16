// Created by Brayhan De Aza on 6/15/26.
//

#pragma once

#include "llvm/lowering/declarationLowerer.h"

#include <cstddef>
#include <string>
#include <vector>

#if YOGI_HAS_LLVM
namespace llvm {
	class BasicBlock;
}

namespace yogi::core::llvm::internal {

	class StatementLowerer {
		public:
			StatementLowerer(
				ModuleLoweringContext &context,
				TypeLowerer &types,
				ValueLowerer &values,
				VariableLowerer &variables
			);

			void lowerModuleInitializer();
			void lowerModuleCleanup();
			void lowerEntryPoint(
				const std::vector<std::string> &moduleInitializers,
				const std::vector<std::string> &moduleCleanups
			);
			void lowerBlock(const Yogi::Sir::BlockStatement *block);
			void lowerStatement(const Yogi::Sir::SirNode *node);
			void lowerReturn(const Yogi::Sir::ReturnStatement *statement);
			void lowerIf(const Yogi::Sir::IfStatement *statement);
			void lowerWhile(const Yogi::Sir::WhileStatement *statement);
			void lowerFor(const Yogi::Sir::ForStatement *statement);
			void lowerBreak(const Yogi::Sir::BreakStatement *statement);
			void lowerContinue(const Yogi::Sir::ContinueStatement *statement);
			void emitLocalCleanups();
			void emitLocalCleanupsFrom(std::size_t firstCleanup);

		private:
			struct LoopFrame {
				::llvm::BasicBlock *breakBlock;
				::llvm::BasicBlock *continueBlock;
				std::size_t breakCleanupStart;
				std::size_t continueCleanupStart;
			};

			ModuleLoweringContext &context;
			TypeLowerer &types;
			ValueLowerer &values;
			VariableLowerer &variables;
			std::vector<LoopFrame> loopFrames;
	};

} // namespace yogi::core::llvm::internal
#endif
