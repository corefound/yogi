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
                    type: "identifier",
                    value: node.text,
                    source: node.getText(),
                    fullSource: node.parent.getFullText(),
                    position: this.getNodePosistion(node)
                };
            }

            if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.TrueKeyword) {
                return {
                    kind: Kinds.Literals.BooleanLiteral,
                    type: "boolean",
                    value: node.kind === ts.SyntaxKind.TrueKeyword ? "true" : "false",
                    source: node.getText(),
                    position: this.getNodePosistion(node)
                };
            }
        }

        visitLiteral(node: ts.Node) {
            if (ts.isNumericLiteral(node)) {
                return {
                    kind: Kinds.Literals.NumberLiteral,
                    type: "number",
                    value: Number(node.text),
                    source: node.getText(),
                    position: this.getNodePosistion(node)
                };
            }

            if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
                return {
                    kind: Kinds.Literals.StringLiteral,
                    type: "string",
                    value: node.text,
                    source: node.getText(),
                    position: this.getNodePosistion(node)
                };
            }

            if (node.kind === ts.SyntaxKind.NullKeyword) {
                return {
                    kind: Kinds.Literals.NullLiteral,
                    type: "null",
                    source: node.getText(),
                    position: this.getNodePosistion(node),
                    value: null
                };
            }

            return null;
        }
    };
}
