import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";

export function LiteralsVisitor<TBase extends Constructor<BaseVisitor>>(Base: TBase) {
    return class extends Base {
        visitLiterals(node: ts.Node) {
            const literal = this.visitLiteral(node);
            if (literal) return literal;

            if (ts.isIdentifier(node)) {
                return {
                    kind: Kinds.Expressions.IdentifierExpression,
                    name: node.text,
                    source: node.getText(),
                    position: this.getNodePosistion(node)
                };
            }

            if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.TrueKeyword) {
                return {
                    kind: Kinds.Literals.BooleanLiteral,
                    value: node.kind === ts.SyntaxKind.TrueKeyword ? 1 : 0,
                    source: node.getText(),
                    position: this.getNodePosistion(node)
                };
            }

        }

        visitLiteral(node: ts.Node) {
            if (ts.isBinaryExpression(node)) {
                return {
                    kind: Kinds.Expressions.BinaryExpression,
                    operator: node.operatorToken.getText(),
                    left: this.visitNode(node.left),
                    right: this.visitNode(node.right),
                    source: node.getText(),
                    position: this.getNodePosistion(node)
                };
            }

            if (ts.isNumericLiteral(node)) {
                return {
                    kind: Kinds.Literals.NumberLiteral,
                    value: Number(node.text),
                    source: node.getText(),
                    position: this.getNodePosistion(node)
                };
            }

            if (ts.isStringLiteral(node)) {
                return {
                    kind: Kinds.Literals.StringLiteral,
                    value: node.text,
                    source: node.getText(),
                    position: this.getNodePosistion(node)
                };
            }

            if (node.kind === ts.SyntaxKind.NullKeyword) {
                return {
                    kind: Kinds.Literals.NullLiteral,
                    source: node.getText(),
                    position: this.getNodePosistion(node),
                    value: null
                };
            }

            return null;
        }
    };
}
