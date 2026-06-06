import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";

export function ExpressionVisitor<TBase extends Constructor<BaseVisitor>>(Base: TBase) {
    return class extends Base {
        visitExpressions(node: ts.Node): any {
            if (ts.isCallExpression(node)) return this.visitCallExpression(node);
            if (ts.isBinaryExpression(node)) return this.visitBinaryExpression(node);
            if (ts.isPrefixUnaryExpression(node)) return this.visitUnaryExpression(node);
            if (ts.isExpressionStatement(node)) return this.visitExpression(node);
            if (ts.isPropertyAccessExpression(node)) return this.visitPropertyAccessExpression(node);
        }

        visitExpression(node: ts.ExpressionStatement) {
            return this.visitNode(node.expression);
        }

        visitBinaryExpression(node: ts.BinaryExpression) {
            return {
                kind: Kinds.BinaryExpression,
                left: this.visitNode(node.left),
                operator: node.operatorToken.getText(),
                right: this.visitNode(node.right),
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        visitCallExpression(node: ts.CallExpression) {
            return {
                kind: Kinds.CallExpression,
                callee: this.visitNode(node.expression),
                arguments: node.arguments.map(arg => this.visitNode(arg)),
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        visitPropertyAccessExpression(node: ts.PropertyAccessExpression) {
            return {
                kind: Kinds.PropertyAccessExpression,
                object: this.visitNode(node.expression),
                property: node.name.getText(),
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }
    };
}