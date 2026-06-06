import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";

export function ConditionalVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {

        visitIfStatement(node: ts.IfStatement) {
            return {
                kind: Kinds.IfStatement,
                condition: this.visitNode(node.expression),
                then: this.visitConditionalStatement(node.thenStatement),
                else: node.elseStatement
                    ? this.visitConditionalStatement(node.elseStatement)
                    : null,
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        visitConditionalStatement(statement: ts.Statement) {
            if (ts.isBlock(statement)) {
                return this.visitBlockStatement(statement);
            }

            return {
                kind: Kinds.BlockStatement,
                statements: [
                    this.visitNode(statement)
                ],
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
    };
}