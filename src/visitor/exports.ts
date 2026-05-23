import ts from "typescript";
import path from "path";
import { BaseVisitor, Constructor } from "@/visitor/base";
import { Nodes } from "@/helpers/types";

export function ExportsVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        visitExports = (stmt: ts.Statement) => {
            if (ts.isExportDeclaration(stmt)) {
                return this.visitExportDeclaration(stmt);
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
    };
}