import { BaseSemantic, Constructor } from "./base";
import { Kinds, Types } from "../helpers/types";
import { Helpers } from "../helpers";

export function ModulesSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitModuleStatement(node: any): any {
            switch (node.kind) {
                case Kinds.Modules.ImportCall:
                    return this.visitImportDeclaration(node);

                case Kinds.Modules.ExportCall:
                    return this.visitExportDeclaration(node);

                default:
                    return null;
            }
        }

        public visitImportDeclaration(node: any): any {
            const importedModule = this.modules.get(node.module);

            if (!importedModule) {
                const message =
                    `cannot find module ${Helpers.RED}'${node.specifier ?? node.module}'${Helpers.RESET}`;

                node.arrowLength = (node.specifier ?? node.module ?? "").length || 1;

                this.throwError(
                    message,
                    node.position,
                    node.source,
                    node,
                );
            }

            if (node.sideEffectOnly) {
                return [];
            }

            if (node.defaultImport) {
                this.bindImportedSymbol(node, importedModule, "default", node.defaultImport);
            }

            if (node.namespaceImport) {
                this.bindNamespaceImport(node, importedModule);
            }

            for (const importSpecifier of node.namedImports ?? []) {
                const importedName = importSpecifier.alias ?? importSpecifier.name;
                const localName = importSpecifier.name;

                this.bindImportedSymbol(node, importedModule, importedName, localName);
            }

            return [];
        }

        public bindNamespaceImport(node: any, importedModule: Types.SemanticModuleInfo): void {
            const localName = node.namespaceImport;
            const existing = this.resolveLocalSymbol(localName);

            if (existing) {
                const message =
                    `the name ${Helpers.RED}'${localName}'${Helpers.RESET} is defined multiple times`;

                node.arrowLength = localName.length;

                this.throwError(message, node.position, node.source, node);
            }

            this.defineSymbol({
                kind: Kinds.ScopeSymbols.Variable,
                name: localName,
                linkageName: null,
                qualifiedName: this.getQualifiedName(this.modulePath.relativePath, localName),
                type: {
                    kind: Kinds.Types.AnyType,
                    raw: "any",
                    module: importedModule.relativePath,
                },
                mutable: false,
                storage: null,
                escapes: false,
                trusted: true,
                node,
            });
        }

        public bindImportedSymbol(
            node: any,
            importedModule: Types.SemanticModuleInfo,
            importedName: string,
            localName: string,
        ): void {
            const exportedSymbol = importedModule.exports.get(importedName);

            if (!exportedSymbol) {
                const message =
                    `module ${Helpers.BLUE}'${importedModule.relativePath}'${Helpers.RESET} has no exported member ` +
                    `${Helpers.RED}'${importedName}'${Helpers.RESET}`;

                node.arrowLength = importedName.length || 1;

                this.throwError(
                    message,
                    node.position,
                    node.source,
                    node,
                    `  = exported members: ${this.formatExportedMembers(importedModule)}`,
                );
            }

            const existing = this.resolveLocalSymbol(localName);

            if (existing) {
                const message =
                    `the name ${Helpers.RED}'${localName}'${Helpers.RESET} is defined multiple times`;

                node.arrowLength = localName.length || 1;

                this.throwError(message, node.position, node.source, node);
            }

            this.defineSymbol({
                kind: exportedSymbol.kind,
                name: localName,
                linkageName: exportedSymbol.linkageName ?? null,
                qualifiedName: exportedSymbol.qualifiedName ?? this.getQualifiedName(importedModule.relativePath, importedName),
                type: exportedSymbol.type,
                mutable: false,
                storage: null,
                escapes: false,
                trusted: true,
                node,
            });
        }

        public visitExportDeclaration(node: any): any {
            if (node.module) {
                return this.visitReExportDeclaration(node);
            }

            for (const exportSpecifier of node.namedImports ?? []) {
                const localName = exportSpecifier.alias ?? exportSpecifier.name;
                const exportedName = exportSpecifier.name;
                const symbol = this.resolveSymbol(localName);

                if (!symbol) {
                    const message =
                        `cannot export unknown symbol ${Helpers.RED}'${localName}'${Helpers.RESET}`;

                    node.arrowLength = localName.length || 1;

                    this.throwError(message, node.position, node.source, node);
                }

                this.exportedSymbols.set(exportedName, {
                    name: exportedName,
                    kind: symbol.kind,
                    type: symbol.type,
                    mutable: symbol.mutable,
                    linkageName: symbol.linkageName ?? null,
                    qualifiedName: symbol.qualifiedName,
                    sourcePath: this.modulePath.relativePath,
                });
            }

            return [];
        }

        public visitReExportDeclaration(node: any): any {
            const importedModule = this.modules.get(node.module);

            if (!importedModule) {
                const message =
                    `cannot find module ${Helpers.RED}'${node.specifier ?? node.module}'${Helpers.RESET}`;

                node.arrowLength = (node.specifier ?? node.module ?? "").length || 1;

                this.throwError(message, node.position, node.source, node);
            }

            if (!node.namedImports?.length) {
                for (const [name, symbol] of importedModule.exports.entries()) {
                    this.exportedSymbols.set(name, symbol);
                }

                return [];
            }

            for (const exportSpecifier of node.namedImports ?? []) {
                const importedName = exportSpecifier.alias ?? exportSpecifier.name;
                const exportedName = exportSpecifier.name;
                const symbol = importedModule.exports.get(importedName);

                if (!symbol) {
                    const message =
                        `module ${Helpers.BLUE}'${importedModule.relativePath}'${Helpers.RESET} has no exported member ` +
                        `${Helpers.RED}'${importedName}'${Helpers.RESET}`;

                    node.arrowLength = importedName.length || 1;

                    this.throwError(
                        message,
                        node.position,
                        node.source,
                        node,
                        `  = exported members: ${this.formatExportedMembers(importedModule)}`,
                    );
                }

                this.exportedSymbols.set(exportedName, {
                    ...symbol,
                    name: exportedName,
                });
            }

            return [];
        }

        public formatExportedMembers(module: Types.SemanticModuleInfo): string {
            const names = [...module.exports.keys()].sort();

            return names.length ? names.join(", ") : "<none>";
        }
    };
}
