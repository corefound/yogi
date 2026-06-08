import { BaseSemantic, Constructor } from "./base";
import { Kinds, Types } from "../helpers/types";

export function DeclarationsSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitDeclarationStatement(node: any) {
            if (node.kind !== Kinds.Statements.DeclarationStatement) {
                return null;
            }

            return node.declarations.map((declaration: any) =>
                this.visitVariableLikeDeclarations(declaration, {
                    flag: node.flag,
                    export: node.export,
                    source: node.source,
                    position: node.position,
                })
            );
        }

        public visitVariableLikeDeclarations(node: any, context: Types.DeclarationContext): any {
            switch (node.kind) {
                case Kinds.Statements.VariableDeclaration:
                    return this.visitVariableDeclarations(node, context);

                default:
                    return this.visitNode(node);
            }
        }
        public visitVariableDeclarations(node: any, context: Types.DeclarationContext) {
            const value = node.value ? this.visitNode(node.value) : null;
            const type = this.resolveVariableType(node.type, value);

            const symbol = this.defineSymbol({
                name: node.name,
                kind: Kinds.ScopeSymbols.Variable,
                type,
                mutable: context.flag !== "const",
                storage: Kinds.Storage.stack,
                escapes: false,
            });

            return {
                kind: Kinds.Statements.VariableDeclaration,

                symbolId: symbol.id,
                scopeId: symbol.scopeId,

                name: node.name,

                flag: context.flag,
                export: context.export,
                mutable: symbol.mutable,

                type,
                value,

                storage: symbol.storage,
                escapes: symbol.escapes,

                source: node.source,
                position: node.position,

                declarationSource: context.source,
                declarationPosition: context.position,
            };
        }
        public resolveVariableType(declaredType: any, value: any) {
            if (declaredType && declaredType.kind !== Kinds.Types.UnTyped) {
                return declaredType;
            }

            if (value?.type) {
                return value.type;
            }

            return {
                kind: Kinds.Types.UnTyped,
                raw: null,
            };
        }
    };
}