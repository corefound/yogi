import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";

export function VariableVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        visitVariableDeclaration(node: ts.VariableStatement, storage: string = "stack") {
            const { declarations, flags } = node.declarationList;
            return {
                kind: "VariableDeclaration",
                ...declarations?.map((declaration: ts.VariableDeclaration) => {
                    const flag = flags & ts.NodeFlags.Const ? "const" : flags & ts.NodeFlags.Let ? "let" : "var"
                    let dataType = declaration.type ? declaration.type.getText() : 'any'

                    if (flag === 'const') {
                        switch (true) {
                            case dataType === 'boolean':
                            case declaration?.initializer?.kind === ts.SyntaxKind.FalseKeyword && dataType === 'any':
                            case declaration?.initializer?.kind === ts.SyntaxKind.TrueKeyword && dataType === 'any':
                                dataType = 'i1'
                                break;

                            case declaration?.initializer?.kind === ts.SyntaxKind.NumericLiteral && dataType === 'any':
                                dataType = 'i64'
                                break;

                            case declaration?.initializer?.kind === ts.SyntaxKind.StringLiteral && dataType === 'any':
                            case dataType === 'string':
                                dataType = 'str'
                                break;

                            case declaration?.initializer?.kind === ts.SyntaxKind.NullKeyword && dataType === 'any':
                                dataType = 'i8'
                                break;

                            default:
                                dataType = 'any'
                                break;
                        }
                    }

                    return {
                        flag,
                        name: declaration.name.getText(),
                        type: dataType,
                        storage,
                        value: declaration.initializer ? this.visitNode(declaration.initializer) : null
                    };

                }).at(0)
            };
        }
    }
}
