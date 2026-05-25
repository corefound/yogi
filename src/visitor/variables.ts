import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";
import { Kinds } from "@/helpers/types";

export function VariableVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {

        visitVariableDeclaration(node: ts.VariableStatement) {
            const declarationList = node.declarationList;
            const flag = declarationList.flags & ts.NodeFlags.Const
                ? "const"
                : declarationList.flags & ts.NodeFlags.Let
                    ? "let"
                    : "var";

            const isExported = node.modifiers?.some(
                m => m.kind === ts.SyntaxKind.ExportKeyword
            ) ?? false;

            return {
                kind: Kinds.DeclarationStatement,
                flag,
                export: isExported,
                declarations: declarationList.declarations.map(
                    (decl) => this.transformDeclaration(decl)
                )
            };
        }

        transformDeclaration(decl: ts.VariableDeclaration) {
            const name = decl.name.getText();
            const initializer = decl.initializer;

            if (!initializer) {
                return {
                    kind: Kinds.VariableDeclaration,
                    name,
                    type: decl.type?.getText() ?? "any",
                    value: null
                };
            }

            // ----------------------------
            // DICTIONARY (OBJECT LITERAL)
            // ----------------------------
            if (ts.isObjectLiteralExpression(initializer)) {
                return {
                    kind: Kinds.DictionaryDeclaration,
                    name,
                    type: "dictionary",
                    properties: initializer.properties.flatMap(
                        (prop: ts.ObjectLiteralElementLike) => {
                            if (!ts.isPropertyAssignment(prop)) {
                                return [];
                            }

                            return [{
                                kind: Kinds.DictionaryProperty,
                                key: prop.name.getText(),
                                value: this.visitNode(prop.initializer)
                            }];
                        }
                    )
                };
            }

            // ----------------------------
            // DEFAULT VARIABLE
            // ----------------------------
            const value = this.visitNode(initializer);

            return {
                kind: Kinds.VariableDeclaration,
                name,
                type: decl.type?.getText() ?? this.inferPrimitiveType(initializer),
                value
            };
        }

        inferPrimitiveType(initializer: ts.Expression): string {
            switch (initializer.kind) {
                case ts.SyntaxKind.NumericLiteral:
                    return "number";

                case ts.SyntaxKind.StringLiteral:
                    return "string";

                case ts.SyntaxKind.TrueKeyword:
                case ts.SyntaxKind.FalseKeyword:
                    return "boolean";

                case ts.SyntaxKind.NullKeyword:
                    return "null";

                default:
                    return "any";
            }
        }

        visitAssignment(node: ts.BinaryExpression) {
            return {
                kind: Kinds.VariableReassignment,
                name: node.left.getText(),
                value: this.visitNode(node.right)
            };
        }
    };
}