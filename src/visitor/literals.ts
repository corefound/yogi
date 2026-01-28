import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";


export function LiteralsVisitor<TBase extends Constructor<BaseVisitor>>(Base: TBase) {
    return class extends Base {
        visitNode(node: ts.Node): any {
            if (ts.isBinaryExpression(node)) {
                return {
                    type: "BinaryExpression",
                    start: node.getStart(),
                    end: node.getEnd(),
                    operator: node.operatorToken.getText(),
                    left: this.visitNode(node.left),
                    right: this.visitNode(node.right),
                };
            }

            if (ts.isNumericLiteral(node)) {
                return {
                    type: "NumberLiteral",
                    start: node.getStart(),
                    end: node.getEnd(),
                    value: Number(node.text),
                    raw: node.text
                };
            }

            if (ts.isIdentifier(node)) {
                return {
                    type: "Identifier",
                    start: node.getStart(),
                    end: node.getEnd(),
                    name: node.text,
                };
            }

            if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.TrueKeyword) {
                return {
                    type: "BooleanLiteral",
                    value: node.kind === ts.SyntaxKind.TrueKeyword ? 1 : 0,
                };
            }

            if (ts.isStringLiteral(node)) {
                return {
                    type: "StringLiteral",
                    start: node.getStart(),
                    end: node.getEnd(),
                    value: node.text,
                    raw: node.text
                };
            }

            if (node.kind === ts.SyntaxKind.NullKeyword) {
                return {
                    type: "NullLiteral",
                    start: node.getStart(),
                    end: node.getEnd(),
                    value: null
                };
            }
        }
    };
}
