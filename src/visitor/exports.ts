import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";
import { Nodes } from "@/helpers/types";
import path from "path";

export function ExportsVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        visitExports = (stmt: ts.Statement) => {
            if (ts.isExportDeclaration(stmt)) {
                return this.visitExportDeclaration(stmt);
            }

            // 2. export const / let / var ...
            if (ts.isVariableStatement(stmt)) {
                if (stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                    return this.visitExportedVariable(stmt);
                }
            }

            return null;
        }

        visitExportDeclaration(node: ts.ExportDeclaration) {
            const moduleSpecifier = node.moduleSpecifier
                ? (node.moduleSpecifier as ts.StringLiteral).text
                : null;

            const modulePath = moduleSpecifier ? path.resolve(path.dirname(this.filePath), moduleSpecifier) + ".ts" : null;

            const result: any = {
                kind: Nodes.ExportCall,
                module: modulePath,

                // export * from "x"
                namespaceImport: node.exportClause && ts.isNamespaceExport(node.exportClause)
                    ? node.exportClause.name.text
                    : null,

                // export { a, b } from "x"
                namedImports: [],

                defaultImport: null,

                sideEffectOnly: !node.exportClause && !!moduleSpecifier
            };

            // Handle: export { a, b } from "x"
            if (node.exportClause && ts.isNamedExports(node.exportClause)) {
                result.namedImports = node.exportClause.elements.map((el) => ({
                    name: el.name.text,
                    alias: el.propertyName ? el.propertyName.text : null
                }));
            }

            // Handle: export * from "x"
            if (node.exportClause && ts.isNamespaceExport(node.exportClause)) {
                result.namespaceImport = node.exportClause.name.text;
            }

            return result;
        }

        visitExportedVariable(node: ts.VariableStatement) {
            const isExported = node.modifiers?.some(
                m => m.kind === ts.SyntaxKind.ExportKeyword
            );

            if (!isExported) return null;

            const declarations = node.declarationList.declarations.map((decl) => {
                const name = (decl.name as ts.Identifier).text;

                return {
                    kind: Nodes.ExportVariable,
                    name,
                    value: decl.initializer ? decl.initializer.getText() : null,
                };
            });

            return {
                kind: Nodes.ExportVariableStatement,
                declarations
            };
        }
    };
}