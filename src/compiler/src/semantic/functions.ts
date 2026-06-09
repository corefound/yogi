import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function FunctionsSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {

        public visitFunctionLikeDeclarations(node: any): any {
            switch (node.kind) {
                case Kinds.Functions.FunctionDeclaration:
                    return this.visitFunctionDeclarations(node);

                default:
                    return this.visitNode(node);
            }
        }

        public visitFunctionDeclarations(node: any) {
            const context = node;

            const { trusted } = this.declarationFunctionDiagnostics(context);

            const linkageName = node.export ? this.getLinkageName(this.modulePath.relativePath, node.name) : null;
            const qualifiedName = this.getQualifiedName(this.modulePath.relativePath, node.name);

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Function,
                name: node.name,
                linkageName,
                qualifiedName,
                type: node.type,
                mutable: node.flag.name !== "const",
                trusted,
                node,
            });

            this.enterScope();

            const body = node.body ? this.visitNode(node.body) : null;

            this.exitScope();

            return Object.assign({}, node, {
                linkageName,
                qualifiedName,

                symbolId: symbol.id,
                scopeId: symbol.scopeId,
                mutable: symbol.mutable,

                flag: node.flag,
                export: node.export,
                type: node.type,
                trusted,

                body,
            });
        }

        public declarationFunctionDiagnostics(context: any): any {
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

            const scopeSymbol = this.resolveLocalSymbol(context.name);
            if (scopeSymbol) {
                const message = `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} is defined multiple times`;
                context.arrowLength = context.name.length;
                this.throwError(message, context.position, context.fullSource, context);
            }

            if (!this.checkFunctionDataType(context.type, context)) {
                const message =
                    `name ${Helpers.BLUE}'${context.name}'${Helpers.RESET} can only initialize values of type ` +
                    `${Helpers.BLUE}'${context.type.raw}'${Helpers.RESET}`;

                context.arrowLength = context.name.length + 1;
                this.throwError(message, context.position, context.fullSource, context);
            }

            return { trusted };
        }

        public checkFunctionDataType(expectedType: any, value: any): boolean {
            if (!expectedType || !value) return false;

            const isExpectedFunction =
                expectedType.kind === Kinds.Types.FunctionType ||
                (
                    expectedType.kind === Kinds.Types.TypeReference &&
                    expectedType.name === "Function"
                );

            const isValueFunction =
                value.kind === Kinds.Functions.FunctionDeclaration ||
                value.type?.kind === Kinds.Types.FunctionType ||
                (
                    value.type?.kind === Kinds.Types.TypeReference &&
                    value.type?.name === "Function"
                );

            if (!isExpectedFunction || !isValueFunction) {
                return false;
            }

            const expectedReturnType = expectedType.returnType;
            const actualReturnType = value.returnType;

            if (!expectedReturnType || !actualReturnType) {
                return true;
            }

            return expectedReturnType.kind === actualReturnType.kind;
        }
    };
}
