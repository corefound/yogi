import ts from "typescript";

export class Helpers {
    static nodeToObject(node: ts.Node, checker: ts.TypeChecker): any {
        // Handle VariableStatement (const/let/var declarations)
        if (ts.isVariableStatement(node)) {
            const declarationList = node.declarationList;
            return {
                type: "VariableDeclaration",
                start: node.getStart(),
                end: node.getEnd(),
                declarations: declarationList.declarations.map(decl => {
                    const type = checker.getTypeAtLocation(decl);
                    const typeString = checker.typeToString(type);
                    const varKind = declarationList.flags & ts.NodeFlags.Const ? "const" : declarationList.flags & ts.NodeFlags.Let ? "let" : "var"

                    return {
                        start: decl.getStart(),
                        end: decl.getEnd(),
                        varKind,
                        identifier: {
                            start: decl.name.getStart(),
                            end: decl.name.getEnd(),
                            name: decl.name.getText(),
                            dataType: decl.type ? decl.type.getText() : typeString // Use explicit type or inferred type
                        },
                        init: decl.initializer ? {
                            type: ts.SyntaxKind[decl.initializer.kind],
                            start: decl.initializer.getStart(),
                            end: decl.initializer.getEnd(),
                            value: decl.initializer.getText(),
                            raw: decl.initializer.getText()
                        } : null
                    };
                }).at(0)
            };
        }

        // Add more node types as needed
        return {
            type: ts.SyntaxKind[node.kind],
            start: node.getStart(),
            end: node.getEnd()
        };
    }

    static inferDataType(node: ts.Node, checker: ts.TypeChecker): string {
        const type = checker.getTypeAtLocation(node);
        return checker.typeToString(type);
    }

}

