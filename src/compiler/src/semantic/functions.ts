import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function FunctionsSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitRegularFunctionDeclarations(node: any): any {
            switch (node.kind) {
                case Kinds.Functions.FunctionDeclaration:
                    return this.visitFunctionDeclarations(node);

                default:
                    return this.visitChildren(node);
            }
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
            const { trusted } = this.declarationFunctionDiagnostics(node);

            const linkageName = node.export
                ? this.getLinkageName(this.modulePath.relativePath, node.name)
                : null;

            const qualifiedName = this.getQualifiedName(
                this.modulePath.relativePath,
                node.name,
            );

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Function,
                name: node.name,
                linkageName,
                qualifiedName,
                type: node.type,
                mutable: node.flag?.name !== "const",
                trusted,
                node,
            });

            this.enterScope();

            const body = this.visitFunctionBody(node.body);

            const functionContext = {
                ...node,
                body,
            };

            if (!this.checkFunctionReturnType(functionContext)) {
                const message =
                    `function ${Helpers.BLUE}'${node.name}'${Helpers.RESET} must return a value of type ` +
                    `${Helpers.BLUE}'${node.returnType.raw}'${Helpers.RESET}`;

                node.arrowLength = node.name.length;
                this.throwError(message, node.position, node.fullSource, node);
            }

            this.exitScope();

            return {
                ...node,
                linkageName,
                qualifiedName,

                symbolId: symbol.id,
                scopeId: symbol.scopeId,
                mutable: symbol.mutable,

                flag: node.flag,
                export: node.export,
                trusted,

                body,
            };
        }

        public visitFunctionBody(node: any): any {
            if (!node) return null;

            if (node.kind === Kinds.Statements.BlockStatement) {
                return {
                    ...node,
                    statements: this.visitNode(node.statements),
                };
            }

            return this.visitNode(node);
        }

        public declarationFunctionDiagnostics(context: any): any {
            let trusted = true;

            if (!context.regular && context.type.kind === Kinds.Types.UnTyped) {
                const message =
                    `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} is missing explicit type annotation`;

                context.arrowLength = context.name.length;
                this.throwError(message, context.position, context.fullSource, context);
            }

            if (context.returnType.kind === Kinds.Types.UnTyped) {
                const message =
                    `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} must have a return type`;

                context.arrowLength = context.name.length;
                this.throwError(message, context.position, context.fullSource, context);
            }

            if (
                !context.regular &&
                context.flag.name !== "const" &&
                context.flag.name !== "let"
            ) {
                const message =
                    `${Helpers.RED}'${context.flag.name}'${Helpers.RESET} declarations are not allowed`;

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
                const message =
                    `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} is defined multiple times`;

                context.arrowLength = context.name.length;
                this.throwError(message, context.position, context.fullSource, context);
            }

            if (!context.regular && !this.checkFunctionDataType(context.type, context)) {
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

        public checkFunctionReturnType(functionNode: any): boolean {
            const expectedReturnType = functionNode.returnType;

            if (!expectedReturnType || expectedReturnType.kind === Kinds.Types.UnTyped) {
                return false;
            }

            const returnStatements = this.findFunctionReturnStatements(functionNode.body);

            if (expectedReturnType.kind === Kinds.Types.VoidType) {
                return returnStatements.every((returnStatement: any) => {
                    return !returnStatement.value;
                });
            }

            if (returnStatements.length === 0) {
                return false;
            }

            return returnStatements.every((returnStatement: any) => {
                const actualType = this.getExpressionType(returnStatement.value);

                if (!actualType) return false;

                return actualType.kind === expectedReturnType.kind;
            });
        }

        public getExpressionType(node: any): any {
            if (!node) return null;

            return node.type ?? null;
        }

        public findFunctionReturnStatements(node: any): any[] {
            if (!node) return [];

            if (Array.isArray(node)) {
                return node.flatMap((child) => this.findFunctionReturnStatements(child));
            }

            if (node.kind === Kinds.Statements.ReturnStatement) {
                return [node];
            }

            if (node.kind === Kinds.Statements.BlockStatement) {
                return this.findFunctionReturnStatements(node.statements);
            }

            return [];
        }
    };
}