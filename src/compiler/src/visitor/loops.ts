import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";

export function LoopVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        visitLoops(node: ts.Node) {
            if (ts.isWhileStatement(node)) {
                return this.visitWhileStatement(node);
            }

            if (ts.isForStatement(node)) {
                return this.visitForStatement(node);
            }

            if (ts.isBreakStatement(node)) {
                return this.visitBreakStatement(node);
            }

            if (ts.isContinueStatement(node)) {
                return this.visitContinueStatement(node);
            }
        }

        visitWhileStatement(node: ts.WhileStatement) {
            return {
                kind: Kinds.WhileStatement,
                condition: this.visitNode(node.expression),
                body: this.visitLoopBody(node.statement),
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        visitForStatement(node: ts.ForStatement) {
            return {
                kind: Kinds.ForStatement,
                initializer: node.initializer
                    ? this.visitForInitializer(node.initializer)
                    : null,
                condition: node.condition
                    ? this.visitNode(node.condition)
                    : null,
                incrementor: node.incrementor
                    ? this.visitNode(node.incrementor)
                    : null,
                body: this.visitLoopBody(node.statement),
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        visitForInitializer(initializer: ts.ForInitializer) {
            if (ts.isVariableDeclarationList(initializer)) {
                return {
                    kind: Kinds.DeclarationStatement,
                    flag: initializer.flags & ts.NodeFlags.Const
                        ? "const"
                        : initializer.flags & ts.NodeFlags.Let
                            ? "let"
                            : "var",
                    export: false,
                    declarations: initializer.declarations.map(decl =>
                        this.transformDeclaration(decl)
                    ),
                    source: initializer.getFullText(),
                    position: initializer.getSourceFile().getLineAndCharacterOfPosition(initializer.pos),
                };
            }

            return this.visitNode(initializer);
        }

        visitLoopBody(statement: ts.Statement) {
            if (ts.isBlock(statement)) {
                return this.visitBlockStatement(statement);
            }

            return {
                kind: Kinds.BlockStatement,
                statements: [this.visitNode(statement)],
                source: statement.getFullText(),
                position: statement.getSourceFile().getLineAndCharacterOfPosition(statement.pos),
            };
        }

        visitBlockStatement(block: ts.Block) {
            return {
                kind: Kinds.BlockStatement,
                statements: block.statements.map(statement => this.visitNode(statement)),
                source: block.getFullText(),
                position: block.getSourceFile().getLineAndCharacterOfPosition(block.pos),
            };
        }

        visitBreakStatement(node: ts.BreakStatement) {
            return {
                kind: Kinds.BreakStatement,
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        visitContinueStatement(node: ts.ContinueStatement) {
            return {
                kind: Kinds.ContinueStatement,
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }
    };
}