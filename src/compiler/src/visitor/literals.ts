import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";
import * as Nodes from "../nodes";



export function LiteralsVisitor<TBase extends Constructor<BaseVisitor>>(Base: TBase) {
    return class extends Base {
        visitLiterals(node: ts.Node) {
            const literal = this.visitLiteral(node);
            if (literal) return literal;

            if (ts.isIdentifier(node)) {
                return {
                    kind: Kinds.Identifier,
                    name: node.text,
                    source: node.getFullText(),
                    position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
                };
            }

            if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.TrueKeyword) {
                return {
                    kind: Kinds.BooleanLiteral,
                    value: node.kind === ts.SyntaxKind.TrueKeyword ? 1 : 0,
                    source: node.getFullText(),
                    position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
                };
            }

        }

        visitLiteral(node: ts.Node) {
            if (ts.isBinaryExpression(node)) {
                return {
                    kind: Kinds.BinaryExpression,
                    operator: node.operatorToken.getText(),
                    left: this.visitNode(node.left),
                    right: this.visitNode(node.right),
                    source: node.getFullText(),
                    position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
                };
            }

            if (ts.isNumericLiteral(node)) {
                return {
                    kind: Kinds.NumberLiteral,
                    value: Number(node.text),
                    source: node.getFullText(),
                    position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
                };
            }

            if (ts.isStringLiteral(node)) {
                return {
                    kind: Kinds.StringLiteral,
                    value: node.text,
                    source: node.getFullText(),
                    position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
                };
            }

            if (node.kind === ts.SyntaxKind.NullKeyword) {
                return {
                    kind: Kinds.NullLiteral,
                    source: node.getFullText(),
                    position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
                    value: null
                };
            }

            return null;
        }
    };
}
