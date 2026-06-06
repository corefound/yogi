import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";

export function ConditionalVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {

        visitConditionals(node: ts.Node): any {
            if (ts.isIfStatement(node)) {
                return this.visitIfStatement(node)
            };

            if (ts.isSwitchStatement(node)) {
                return this.visitSwitchStatement(node);
            };

            if (ts.isBreakStatement(node)) {
                return this.visitBreakStatement(node);
            };
        }

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

        visitSwitchStatement(node: ts.SwitchStatement) {
            return {
                kind: Kinds.SwitchStatement,
                expression: this.visitNode(node.expression),
                cases: node.caseBlock.clauses.map(clause => this.visitSwitchClause(clause)),
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        visitSwitchClause(clause: ts.CaseOrDefaultClause) {
            if (ts.isCaseClause(clause)) {
                return {
                    kind: Kinds.CaseClause,
                    expression: this.visitNode(clause.expression),
                    statements: clause.statements.map(statement => this.visitNode(statement)),
                    source: clause.getFullText(),
                    position: clause.getSourceFile().getLineAndCharacterOfPosition(clause.pos),
                };
            }

            return {
                kind: Kinds.DefaultClause,
                statements: clause.statements.map(statement => this.visitNode(statement)),
                source: clause.getFullText(),
                position: clause.getSourceFile().getLineAndCharacterOfPosition(clause.pos),
            };
        }

        visitBreakStatement(node: ts.BreakStatement) {
            return {
                kind: Kinds.BreakStatement,
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }
    };
}