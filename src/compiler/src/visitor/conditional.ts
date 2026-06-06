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
                kind: Kinds.ControlFlow.IfStatement,
                condition: this.visitNode(node.expression),
                then: this.visitConditionalStatement(node.thenStatement),
                else: node.elseStatement
                    ? this.visitConditionalStatement(node.elseStatement)
                    : null,
                source: node.getText(),
                position: this.getNodePosistion(node)
            };
        }

        visitConditionalStatement(statement: ts.Statement) {
            if (ts.isBlock(statement)) {
                return this.visitBlockStatement(statement);
            }

            return {
                kind: Kinds.Statements.BlockStatement,
                statements: [
                    this.visitNode(statement)
                ],
                source: statement.getText(),
                position: this.getNodePosistion(statement)
            };
        }

        visitBlockStatement(block: ts.Block) {
            return {
                kind: Kinds.Statements.BlockStatement,
                statements: block.statements.map(statement => this.visitNode(statement)),
                source: block.getText(),
                position: this.getNodePosistion(block),
            };
        }

        visitSwitchStatement(node: ts.SwitchStatement) {
            return {
                kind: Kinds.ControlFlow.SwitchStatement,
                expression: this.visitNode(node.expression),
                cases: node.caseBlock.clauses.map(clause => this.visitSwitchClause(clause)),
                source: node.getText(),
                position: this.getNodePosistion(node)
            };
        }

        visitSwitchClause(clause: ts.CaseOrDefaultClause) {
            if (ts.isCaseClause(clause)) {
                return {
                    kind: Kinds.ControlFlow.CaseClause,
                    expression: this.visitNode(clause.expression),
                    statements: clause.statements.map(statement => this.visitNode(statement)),
                    source: clause.getText(),
                    position: this.getNodePosistion(clause)
                };
            }

            return {
                kind: Kinds.ControlFlow.DefaultClause,
                statements: clause.statements.map(statement => this.visitNode(statement)),
                source: clause.getText(),
                position: this.getNodePosistion(clause)
            };
        }

        visitBreakStatement(node: ts.BreakStatement) {
            return {
                kind: Kinds.ControlFlow.BreakStatement,
                source: node.getText(),
                position: this.getNodePosistion(node)
            };
        }
    };
}