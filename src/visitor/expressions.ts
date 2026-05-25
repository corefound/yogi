import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";
import { Kinds } from "@/helpers/types";


export function ExpressionVisitor<TBase extends Constructor<BaseVisitor>>(Base: TBase) {
    return class extends Base {
        visitExpression(node: ts.ExpressionStatement) {
            console.log(node.getText())
            const { expression } = node;
            if (ts.isBinaryExpression(expression)) {
                return {
                    kind: Kinds.BinaryExpression,
                    operator: expression.operatorToken.getText(),
                    left: this.visitNode(expression.left),
                    right: this.visitNode(expression.right)
                };
            }
        }
    };
} 