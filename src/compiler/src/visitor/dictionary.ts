import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds, Types } from "../helpers/types";

export function DictionaryVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {


        visitDictionaryDeclaration(declaration: ts.VariableDeclaration) {
            const name = declaration.name.getText();
            const init = declaration.initializer;

            if (!init || !ts.isObjectLiteralExpression(init)) {
                return null;
            }

            const dictionaryAst = this.visitDictionaryLiteral(init);

            return {
                kind: Kinds.DictionaryDeclaration,
                name,
                type: declaration.type?.getText() ?? "dictionary",
                properties: dictionaryAst.properties,
                source: declaration.getFullText(),
                position: declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.pos),
            };
        }


        visitDictionaryLiteral(node: ts.ObjectLiteralExpression) {
            const properties = node.properties.flatMap(prop => {
                if (!ts.isPropertyAssignment(prop)) return [];

                return [{
                    kind: Kinds.DictionaryProperty,
                    key: this.getDictionaryKey(prop.name),
                    type: this.visitType(prop.initializer),
                    value: this.visitNode(prop.initializer),
                    source: prop.getFullText(),
                    position: prop.getSourceFile().getLineAndCharacterOfPosition(prop.pos),
                }];
            });

            return {
                kind: Kinds.DictionaryExpression,
                // type: "dictionary",
                type: this.visitType(node),

                properties,
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        getDictionaryKey(name: ts.PropertyName): string {
            if (ts.isIdentifier(name)) return name.text;
            if (ts.isStringLiteral(name)) return name.text;
            if (ts.isNumericLiteral(name)) return name.text;
            if (ts.isComputedPropertyName(name)) return name.expression.getText();

            return name.getText();
        }

    };
}