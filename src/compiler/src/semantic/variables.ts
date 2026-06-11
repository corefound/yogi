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

            const linkageName = node.export
                ? this.getLinkageName(this.modulePath.relativePath, node.name)
                : null;

            const qualifiedName = this.getQualifiedName(
                this.modulePath.relativePath,
                node.name,
            );

            const flagName = this.getDeclarationFlagName(node.flag);

            const isAmbient =
                node.declare === true ||
                node.ambient === true;

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Variable,
                name: node.name,
                linkageName,
                qualifiedName,
                type: node.type,

                mutable: flagName !== "const",
                storage: isAmbient ? null : Kinds.Storage.stack,

                escapes: false,
                trusted,

                declare: isAmbient,
                ambient: isAmbient,
                emit: !isAmbient,

                node: value,
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

                flag: flagName,
                export: node.export ?? false,

                declare: isAmbient,
                ambient: isAmbient,
                emit: !isAmbient,

                type: node.type,

                trusted,
                value,
            };
        }

        public getDeclarationFlagName(flag: any): string {
            if (!flag) return "";

            if (typeof flag === "string") {
                return flag;
            }

            if (typeof flag.name === "string") {
                return flag.name;
            }

            if (typeof flag.raw === "string") {
                return flag.raw;
            }

            return String(flag);
        }
        public declarationVariableDiagnostics(context: any): any {
            let trusted = true;
            let value = context.value;

            const isAmbient =
                context.declare === true ||
                context.ambient === true;

            const source =
                context.fullSource ??
                context.source ??
                context.raw;

            const flagName = this.getDeclarationFlagName(context.flag);

            if (flagName !== "const" && flagName !== "let") {
                const message =
                    `${Helpers.RED}'${flagName}'${Helpers.RESET} declarations are not allowed`;

                context.arrowLength = flagName.length || 1;

                this.throwError(
                    message,
                    context.position,
                    source,
                    context,
                    "  = use 'let' for mutable bindings\n  = use 'const' for immutable bindings",
                );
            }

            if (isAmbient && context.value) {
                const message =
                    `${Helpers.RED}'declare'${Helpers.RESET} declarations cannot have an initializer`;

                context.arrowLength = context.name?.length ?? 1;

                this.throwError(
                    message,
                    context.position,
                    source,
                    context,
                );
            }

            if (!context.value && !isAmbient) {
                const message =
                    `${Helpers.RED}'${context.name}'${Helpers.RESET} must be initialized.`;

                context.arrowLength = context.name?.length ?? 1;

                this.throwError(
                    message,
                    context.position,
                    source,
                    context,
                );
            }

            if (context.value?.kind === Kinds.Expressions.BinaryExpression) {
                value = this.visitBinaryExpression(context);
            }

            if (!context.type || context.type.kind === Kinds.Types.UnTyped) {
                this.throwError(
                    Kinds.ErrrorsMessage.MissingType,
                    context.position,
                    source,
                    context,
                );
            }

            const scopeSymbol = this.resolveLocalSymbol(context.name);

            if (scopeSymbol) {
                const message =
                    `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} is defined multiple times`;

                context.arrowLength = context.name?.length ?? 1;

                this.throwError(
                    message,
                    context.position,
                    source,
                    context,
                );
            }

            if (!isAmbient && !this.checkDataType(context.type.kind, value)) {
                const message =
                    `name ${Helpers.BLUE}'${context.name}'${Helpers.RESET} can only initialize values of type ` +
                    `${Helpers.BLUE}'${context.type.raw}'${Helpers.RESET}`;

                this.throwError(
                    message,
                    context.position,
                    source,
                    context,
                );
            }

            return { trusted };
        }
        public checkDataType(expectedType: any, value: any): boolean {
            if (!value?.type) return false;

            return expectedType === value.type.kind;
        }
    };
}