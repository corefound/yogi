import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";
import { Nodes } from "@/helpers/types";
import path from "path";

export function ScannerVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        visitAllImports(node: ts.ImportDeclaration) {
            const modulePath = path.resolve(path.dirname(this.filePath), (node.moduleSpecifier as ts.StringLiteral).text) + ".ts";
            const result: any = {
                kind: Nodes.ImportCall,
                module: modulePath,
                defaultImport: null,
                namespaceImport: null,
                namedImports: [],
                sideEffectOnly: false,
            };

            // import "module";
            if (!node.importClause) {
                result.sideEffectOnly = true;
                return result;
            }

            const { name, namedBindings } = node.importClause;

            // default import: import React from "react"
            if (name) {
                result.defaultImport = name.text;
            }

            // named or namespace imports
            if (namedBindings) {
                // import * as ns from "module"
                if (ts.isNamespaceImport(namedBindings)) {
                    result.namespaceImport = namedBindings.name.text;
                }

                // import { a, b as c } from "module"
                else if (ts.isNamedImports(namedBindings)) {
                    result.namedImports = namedBindings.elements.map(el => ({
                        name: el.name.text,
                        alias: el.propertyName ? el.propertyName.text : null,
                    }));
                }
            }

            return result;
        }
    };
}