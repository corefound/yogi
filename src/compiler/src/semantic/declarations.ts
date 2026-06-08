import { BaseSemantic, Constructor } from "./base";
import { Kinds, Types } from "../helpers/types";

export function DeclarationsSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitDeclarationStatement(node: any) {
            if (node.kind !== Kinds.Statements.DeclarationStatement) {
                return null;
            }

            return node.declarations.map((declaration: any) =>
                this.visitVariableLikeDeclarations(Object.assign(declaration, {
                    flag: node.flag,
                    export: node.export,
                    fullSource: node.source,
                    source: declaration.source,
                }))
            );
        }

        public visitVariableLikeDeclarations(node: any): any {
            switch (node.kind) {
                case Kinds.Statements.VariableDeclaration:
                    return this.visitVariableDeclarations(node);

                default:
                    return this.visitNode(node);
            }
        }
        public visitVariableDeclarations(node: any) {
            this.declarationDiagnostics(node);

            const value = node.value ? this.visitNode(node.value) : null;
            const symbol = this.defineSymbol({
                name: node.name,
                kind: Kinds.ScopeSymbols.Variable,
                type: node.type,
                mutable: node.flag !== "const",
                storage: Kinds.Storage.stack,
                escapes: false,
            });

            return Object.assign(node, {
                kind: Kinds.Statements.VariableDeclaration,
                symbolId: symbol.id,
                scopeId: symbol.scopeId,

                flag: node.flag,
                export: node.export,
                mutable: symbol.mutable,
                type: node.type,

                storage: symbol.storage,
                escapes: symbol.escapes,

                value,
            });
        }


        public declarationDiagnostics(context: any): void {
            if (context.type.kind == Kinds.Types.UnTyped) {
                this.throwError(Kinds.ErrrorsMessage.MissingType, context.position, context.fullSource, context);
            }

            if (context.flag != "const" && context.flag != "let") {
                const message = `'${context.flag}' declarations are not allowed`
                this.throwError(message, context.position, context.fullSource, context, "  = use 'let' for mutable bindings\n  = use 'const' for immutable bindings");
            }
        }
    };
}