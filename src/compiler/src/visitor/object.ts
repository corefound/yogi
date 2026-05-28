import ts from "@/ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";

export function DictionaryVisitor<TBase extends Constructor<BaseVisitor>>(Base: TBase) {
    return class extends Base {
        visitDictionary(node: ts.ObjectLiteralExpression) {
            return {
                kind: Kinds.DictionaryDeclaration,
                properties: node.properties.map(property => {
                    if (!ts.isPropertyAssignment(property)) {
                        return null;
                    }

                    return {
                        kind: Kinds.DictionaryProperty,
                        key: property.name.getText(),
                        value: this.visitNode(property.initializer),
                        source: node.getFullText(),
                        position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
                    };
                }).filter(Boolean)
            };
        }
    };
}