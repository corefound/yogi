import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds, Types } from "../helpers/types";

export function ArrayVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {


        visitArrayDeclaration(declaration: ts.VariableDeclaration) {
            const name = declaration.name.getText();
            const init = declaration.initializer;

            if (!init || !ts.isArrayLiteralExpression(init)) {
                return null;
            }

            const arrayAst = this.visitArrayLiteral(init);

            return {
                kind: Kinds.ArrayDeclaration,
                name,
                type: this.visitType(declaration.type),
                value: arrayAst.elements,
                source: declaration.getFullText(),
                position: declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.pos),
            };
        }

        visitArrayLiteral(node: ts.ArrayLiteralExpression) {
            const elements = node.elements.map(element => this.visitNode(element));
            return {
                kind: Kinds.ArrayExpression,
                elements,
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }
    };
}