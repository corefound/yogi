import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function VariablesSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitVariableLikeDeclarations(node: any): any {
            switch (node.kind) {
                case Kinds.Statements.VariableDeclaration:
                    return this.visitVariableDeclarations(node);

                default:
                    return this.visitNode(node);
            }
        }

        public visitVariableDeclarations(node: any) {
            const value = node.value ? this.visitNode(node.value) : null;
            const context = { ...node, value };

            const { trusted } = this.declarationVariableDiagnostics(context);
            const linkageName = node.export ? this.getLinkageName(this.modulePath.relativePath, node.name) : null;
            const qualifiedName = this.getQualifiedName(this.modulePath.relativePath, node.name);

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Variable,
                name: node.name,
                linkageName,
                qualifiedName,
                type: node.type,
                mutable: node.flag.name !== "const",
                storage: Kinds.Storage.stack,
                escapes: false,
                trusted,
                node: value
            });

            return {
                ...node,
                kind: Kinds.Statements.VariableDeclaration,
                symbolId: symbol.id,
                scopeId: symbol.scopeId,
                mutable: symbol.mutable,
                storage: symbol.storage,
                escapes: symbol.escapes,

                linkageName,
                qualifiedName,

                flag: node.flag,
                export: node.export,
                type: node.type,

                trusted,
                value,
            };
        }


        public declarationVariableDiagnostics(context: any): any {
            let trusted = true;
            let value = context.value;
            if (context.value.kind == Kinds.Expressions.BinaryExpression) {
                value = this.visitBinaryExpression(context);
            }

            if (context.type.kind == Kinds.Types.UnTyped) {
                this.throwError(
                    Kinds.ErrrorsMessage.MissingType,
                    context.position,
                    context.fullSource,
                    context,
                );
            }

            if (context.flag.name != "const" && context.flag.name != "let") {
                const message = `${Helpers.RED}'${context.flag.name}'${Helpers.RESET} declarations are not allowed`;
                context.arrowLength = context.flag.name.length;
                this.throwError(
                    message,
                    context.flag.position,
                    context.fullSource,
                    context,
                    "  = use 'let' for mutable bindings\n  = use 'const' for immutable bindings",
                );
            }

            const scopeSymbol = this.resolveLocalSymbol(context.name);
            if (scopeSymbol) {
                const message = `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} is defined multiple times`;
                context.arrowLength = context.name.length;
                this.throwError(message, context.position, context.fullSource, context);
            }

            if (!this.checkDataType(context.type.kind, value)) {
                const message = `name ${Helpers.BLUE}'${context.name}'${Helpers.RESET} can only initialize values of type ${Helpers.BLUE}'${context.type.raw}'${Helpers.RESET}`;
                context.arrowLength = context.name.length + 1;
                this.throwError(message, context.position, context.fullSource, context);
            }

            return { trusted };
        }

        public checkDataType(expectedType: any, value: any): boolean {
            if (!value?.type) return false;

            return expectedType === value.type.kind;
        }
    };
}
