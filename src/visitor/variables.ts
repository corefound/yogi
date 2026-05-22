import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";
import { Nodes } from "@/helpers/types";

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

            const declarations = declarationList.declarations.map(
                (declaration: ts.VariableDeclaration) => {
                    const initializer = declaration.initializer ? this.visitNode(declaration.initializer) : null;

                    // Explicit TS type
                    let type = declaration.type?.getText() ?? "any";

                    // Infer type from initializer if type is not specified
                    if (type === "any" && declaration.initializer) {
                        switch (declaration.initializer.kind) {
                            case ts.SyntaxKind.TrueKeyword:
                            case ts.SyntaxKind.FalseKeyword:
                                type = "boolean";
                                break;

                            case ts.SyntaxKind.NumericLiteral:
                                type = "number";
                                break;

                            case ts.SyntaxKind.StringLiteral:
                                type = "string";
                                break;

                            case ts.SyntaxKind.NullKeyword:
                                type = "null";
                                break;

                            default:
                                type = "any";
                                break;
                        }
                    }

                    return {
                        kind: "Variable",
                        name: declaration.name.getText(),
                        flag,
                        type,
                        value: initializer
                    };
                }
            );

            return {
                kind: "VariableStatement",
                export: isExported,
                declarations
            };
        }
    }
}
