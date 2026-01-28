import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";


export function ExpressionVisitor<TBase extends Constructor<BaseVisitor>>(Base: TBase) {
    return class extends Base {
        visitExpression(node: ts.ExpressionStatement) {
            return this.visitNode(node.expression);
        }
    };
}
