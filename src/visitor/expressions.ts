import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";
import { Kinds } from "@/helpers/types";


export function ExpressionVisitor<TBase extends Constructor<BaseVisitor>>(Base: TBase) {
    return class extends Base {
        visitExpression(node: ts.ExpressionStatement) {
            return this.visitNode(node.expression);
        }

        visitBinaryExpression(node: ts.BinaryExpression) {
            return {
                kind: Kinds.BinaryExpression,
                operator: node.operatorToken.getText(),
                left: this.visitNode(node.left),
                right: this.visitNode(node.right),
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }
    };
} 