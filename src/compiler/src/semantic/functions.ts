import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function FunctionsSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitDeclarationStatement(node: any) {
            if (node.kind !== Kinds.Statements.DeclarationStatement) {
                return null;
            }

            return node.declarations.map((declaration: any) => this.visitFunctionLikeDeclarations(Object.assign(declaration, {
                flag: {
                    name: node.flag,
                    position: node.position,
                },
                export: node.export,
                fullSource: node.source,
                source: declaration.source,
            })));
        }

        public visitFunctionLikeDeclarations(node: any): any {
            switch (node.kind) {
                case Kinds.Functions.FunctionDeclaration:
                    return this.visitFunctionDeclarations(node);

                default:
                    return this.visitNode(node);
            }
        }

        public visitFunctionDeclarations(node: any) {
            const value = node.value ? this.visitNode(node.value) : null;
            const context = Object.assign(node, { value });

            const { trusted } = this.declarationDiagnostics(context);
            const linkageName = this.getLinkageName(this.modulePath.relativePath, node.name);
            const qualifiedName = this.getQualifiedName(this.modulePath.relativePath, node.name);

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Function,
                name: node.name,
                linkageName,
                qualifiedName,
                type: node.type,
                mutable: node.flag.name !== "const",
                storage: Kinds.Storage.stack,
                escapes: false,
                trusted,
                node
            });

            const body = node.body ? this.visitNode(node.body) : null;
            return Object.assign(node, {
                kind: Kinds.Functions.FunctionDeclaration,
                linkageName,
                qualifiedName,
                symbolId: symbol.id,
                scopeId: symbol.scopeId,

                flag: node.flag,
                export: node.export,
                mutable: symbol.mutable,
                type: node.type,

                storage: symbol.storage,
                escapes: symbol.escapes,
                trusted,

                body
            });
        }

        public declarationDiagnostics(context: any): any {
            console.log(this.modulePath.relativePath)
            let trusted = true;

            if (context.type.kind == Kinds.Types.UnTyped) {
                const message = `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} is missing explicit type annotation`;
                context.arrowLength = context.name.length;

                this.throwError(
                    message,
                    context.position,
                    context.fullSource,
                    context,
                );
            }

            if (context.returnType.kind == Kinds.Types.UnTyped) {
                const message = `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} must have a return type`;
                this.throwError(
                    message,
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

            const scopeSymbol = this.resolveSymbol(context.name);
            if (scopeSymbol) {
                const message = `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} is defined multiple times`;
                context.arrowLength = context.name.length;
                this.throwError(message, context.position, context.fullSource, context);
            }

            // if (!this.checkDataType(context.type.kind, value)) {
            //     const message = `name ${Helpers.BLUE}'${context.name}'${Helpers.RESET} can only initialize values of type ${Helpers.BLUE}'${context.type.raw}'${Helpers.RESET}`;
            //     context.arrowLength = context.name.length + 1;
            //     this.throwError(message, context.position, context.fullSource, context);
            // }

            return { trusted };
        }

        public checkDataType(expectedType: any, value: any): boolean {
            if (!value?.type) return false;

            return expectedType === value.type.kind;
        }
    };
}
