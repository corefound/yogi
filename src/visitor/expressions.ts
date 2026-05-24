import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";
import { Kinds } from "@/helpers/types";


export function ExpressionVisitor<TBase extends Constructor<BaseVisitor>>(Base: TBase) {
    return class extends Base {
        visitExpression(node: ts.ExpressionStatement) {
            const expr = node.expression;

            if (ts.isBinaryExpression(expr)) {
                if (expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                    return {
                        kind: Kinds.AssignmentExpression,
                        left: this.visitNode(expr.left),
                        right: this.visitNode(expr.right)
                    };
                }

                return {
                    kind: Kinds.BinaryExpression,
                    operator: expr.operatorToken.getText(),
                    left: this.visitNode(expr.left),
                    right: this.visitNode(expr.right)
                };
            }
        }
    };
}
