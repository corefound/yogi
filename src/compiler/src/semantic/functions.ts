import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";
import { Types } from "../helpers/types";

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

            if (node.export) {
                this.exportSymbol(symbol);
            }

            this.enterScope();

            const params = (node.params ?? []).map((param: any) => {
                return this.visitFunctionParameterDeclaration(node, param);
            });

            if (node.declare === true || node.ambient === true || !node.body) {
                const effectSummary = this.createEmptyFunctionEffectSummary(params, node.returnType);
                symbol.effectSummary = undefined;
                symbol.node = {
                    ...node,
                    params,
                    effectSummary,
                };

                this.exitScope();
                return null;
            }

            const body = this.visitFunctionBody(node.body);

            const functionContext = {
                ...node,
                params,
                body,
            };

            const effectSummary = this.analyzeAggregateEscapes(functionContext);
            symbol.effectSummary = effectSummary;
            symbol.node = {
                ...functionContext,
                effectSummary,
            };
            this.functionEffectSummaries.set(symbol.id, effectSummary);
            this.validateFunctionReturnType(functionContext);

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

                params,
                body,
                effectSummary,
            };
        }

        public visitFunctionParameterDeclaration(functionNode: any, param: any): any {
            if (!param.type || param.type.kind === Kinds.Types.UnTyped) {
                const message =
                    `parameter ${Helpers.RED}'${param.name}'${Helpers.RESET} is missing explicit type annotation`;

                param.arrowLength = param.name?.length ?? 1;

                this.throwError(
                    message,
                    param.position,
                    functionNode.fullSource ?? functionNode.source ?? param.source,
                    param,
                );
            }

            const localSymbol = this.resolveLocalSymbol(param.name);

            if (localSymbol) {
                const message =
                    `parameter ${Helpers.RED}'${param.name}'${Helpers.RESET} is defined multiple times`;

                param.arrowLength = param.name?.length ?? 1;

                this.throwError(
                    message,
                    param.position,
                    functionNode.fullSource ?? functionNode.source ?? param.source,
                    param,
                );
            }

            const qualifiedName = this.getQualifiedName(
                this.modulePath.relativePath,
                `${functionNode.name}:${param.name}`,
            );

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Parameter,
                name: param.name,
                linkageName: null,
                qualifiedName,
                type: param.type,
                declaredType: param.type,
                mutable: true,
                storage: Kinds.Storage.stack,
                escapes: false,
                trusted: true,
                node: param,
            });

            this.setAggregateOwner(symbol, null);

            return {
                ...param,
                symbolId: symbol.id,
                scopeId: symbol.scopeId,
                mutable: symbol.mutable,
                storage: symbol.storage,
                trusted: symbol.trusted,
            };
        }

        public visitReturnStatement(node: any): any {
            const value = node.value ? this.visitNode(node.value) : null;

            if (value && this.isAggregateType(value.type)) {
                this.markAggregateExpressionMoved(
                    value,
                    "it was returned and ownership moved to the caller",
                    node,
                );
            }

            return {
                ...node,
                kind: Kinds.Statements.ReturnStatement,
                value,
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

        public validateFunctionReturnType(functionNode: any): void {
            const expectedReturnType = functionNode.returnType;

            if (!expectedReturnType || expectedReturnType.kind === Kinds.Types.UnTyped) {
                return;
            }

            const returnStatements = this.findFunctionReturnStatements(functionNode.body);

            if (expectedReturnType.kind === Kinds.Types.VoidType) {
                const invalidReturn = returnStatements.find((returnStatement: any) => {
                    return returnStatement.value;
                });

                if (invalidReturn) {
                    this.throwInvalidFunctionReturnError(functionNode, invalidReturn);
                }

                return;
            }

            if (returnStatements.length === 0) {
                const message =
                    `function ${Helpers.BLUE}'${functionNode.name}'${Helpers.RESET} must return a value of type ` +
                    `${Helpers.BLUE}'${expectedReturnType.raw}'${Helpers.RESET}`;

                functionNode.arrowLength = functionNode.name?.length ?? 1;
                this.throwError(
                    message,
                    functionNode.position,
                    functionNode.fullSource ?? functionNode.source,
                    functionNode,
                );
            }

            for (const returnStatement of returnStatements) {
                const actualType = this.getExpressionType(returnStatement.value);

                if (!actualType || !this.isTypeAssignable(expectedReturnType, actualType)) {
                    this.throwInvalidFunctionReturnError(functionNode, returnStatement);
                }
            }
        }

        public createEmptyFunctionEffectSummary(params: any[], returnType: any): Types.Sir.SemanticFunctionEffectSummary {
            return {
                parameterEffects: (params ?? []).map((_: any, index: number) => ({
                    index,
                    returns: false,
                    stores: false,
                    escapes: false,
                    mutates: false,
                    consumes: false,
                })),
                returnsAggregate: this.isAggregateType(returnType),
            };
        }

        public analyzeAggregateEscapes(functionNode: any): Types.Sir.SemanticFunctionEffectSummary {
            const declarations = new Map<string, any>();
            const aliases = new Map<string, Set<string>>();
            const escaping = new Set<string>();
            const returned = new Set<string>();
            const stored = new Set<string>();
            const mutated = new Set<string>();
            const propertyStores: Array<{ root: string | null; value: string | null }> = [];
            const paramKeys: Array<string | null> = (functionNode.params ?? []).map((param: any) => {
                const key = this.getDeclarationKey(param);

                if (key) {
                    declarations.set(key, param);
                }

                return key;
            });

            const addAlias = (target: string | null, source: string | null): void => {
                if (!target || !source || target === source) return;

                if (!aliases.has(target)) {
                    aliases.set(target, new Set());
                }

                aliases.get(target)!.add(source);
            };

            const addEscapingIdentifier = (value: any): void => {
                const key = this.getAggregateIdentifierKey(value);
                if (key) escaping.add(key);
            };

            const addReturnedIdentifier = (value: any): void => {
                const key = this.getAggregateIdentifierKey(value);
                if (!key) return;
                returned.add(key);
                escaping.add(key);
            };

            const addStoredIdentifier = (value: any): void => {
                const key = this.getAggregateIdentifierKey(value);
                if (!key) return;
                stored.add(key);
                escaping.add(key);
            };

            const addMutatedIdentifier = (value: any): void => {
                const key = this.getAggregateIdentifierKey(value);
                if (key) mutated.add(key);
            };

            const visit = (node: any): void => {
                if (!node) return;

                if (Array.isArray(node)) {
                    for (const child of node) visit(child);
                    return;
                }

                if (node.kind === Kinds.Statements.VariableDeclaration) {
                    const key = this.getDeclarationKey(node);

                    if (key) declarations.set(key, node);

                    if (this.isAggregateType(node.type)) {
                        addAlias(key, this.getAggregateIdentifierKey(node.value));
                    }

                    visit(node.value);
                    return;
                }

                if (node.kind === Kinds.Expressions.AssignmentExpression) {
                    const left = node.left;
                    const right = node.right;
                    const leftKey = this.getAggregateIdentifierKey(left);
                    const rightKey = this.getAggregateIdentifierKey(right);

                    if (this.isGlobalIdentifier(left)) {
                        addStoredIdentifier(right);
                    } else {
                        addAlias(leftKey, rightKey);
                    }

                    visit(right);
                    return;
                }

                if (node.kind === "AggregateAssignmentExpression") {
                    const root = this.getAggregateRootExpression(node.target);

                    if (this.isGlobalIdentifier(root)) {
                        addStoredIdentifier(node.right);
                    } else {
                        addMutatedIdentifier(root);
                        propertyStores.push({
                            root: this.getAggregateIdentifierKey(root),
                            value: this.getAggregateIdentifierKey(node.right),
                        });
                    }

                    visit(node.target);
                    visit(node.right);
                    return;
                }

                if (node.kind === Kinds.Statements.ReturnStatement) {
                    addReturnedIdentifier(node.value);
                    visit(node.value);
                    return;
                }

                if (node.kind === Kinds.Expressions.CallExpression) {
                    if (
                        node.builtinMethod === "array.push" ||
                        (
                            node.callee?.kind === Kinds.Expressions.PropertyAccessExpression &&
                            node.callee?.property === "push"
                        )
                    ) {
                        addMutatedIdentifier(node.callee?.object);
                        visit(node.callee?.object);
                        visit(node.arguments);
                        return;
                    }

                    const summary = this.getCallEffectSummary(node);
                    const argumentsList = node.arguments ?? [];

                    for (let index = 0; index < argumentsList.length; index++) {
                        const argument = argumentsList[index];
                        const effect = summary?.parameterEffects?.[index];

                        if (!summary || node.external === true) {
                            addEscapingIdentifier(argument);
                        } else {
                            if (effect?.escapes === true) {
                                addEscapingIdentifier(argument);
                            }

                            if (effect?.mutates === true) {
                                addMutatedIdentifier(argument);
                            }
                        }

                        visit(argument);
                    }

                    visit(node.callee);
                    return;
                }

                for (const value of Object.values(node)) {
                    if (value && typeof value === "object") {
                        visit(value);
                    }
                }
            };

            visit(functionNode.body);

            let changed = true;
            while (changed) {
                changed = false;

                for (const [target, sources] of aliases.entries()) {
                    if (!escaping.has(target)) continue;

                    for (const source of sources) {
                        if (!escaping.has(source)) {
                            escaping.add(source);
                            changed = true;
                        }
                    }
                }

                for (const [target, sources] of aliases.entries()) {
                    if (!returned.has(target)) continue;

                    for (const source of sources) {
                        if (!returned.has(source)) {
                            returned.add(source);
                            changed = true;
                        }
                    }
                }

                for (const [target, sources] of aliases.entries()) {
                    if (!stored.has(target)) continue;

                    for (const source of sources) {
                        if (!stored.has(source)) {
                            stored.add(source);
                            changed = true;
                        }
                    }
                }

                for (const [target, sources] of aliases.entries()) {
                    if (!mutated.has(target)) continue;

                    for (const source of sources) {
                        if (!mutated.has(source)) {
                            mutated.add(source);
                            changed = true;
                        }
                    }
                }

                for (const store of propertyStores) {
                    if (!store.root || !store.value || !escaping.has(store.root)) {
                        continue;
                    }

                    if (!escaping.has(store.value)) {
                        escaping.add(store.value);
                        stored.add(store.value);
                        changed = true;
                    }
                }
            }

            for (const key of escaping) {
                const declaration = declarations.get(key);

                if (!declaration || !this.isAggregateType(declaration.type)) {
                    continue;
                }

                declaration.escapes = true;
                declaration.storage = Kinds.Storage.heap;
            }

            return {
                parameterEffects: paramKeys.map((key, index) => ({
                    index,
                    returns: key ? returned.has(key) : false,
                    stores: key ? stored.has(key) : false,
                    escapes: key ? escaping.has(key) : false,
                    mutates: key ? mutated.has(key) : false,
                    consumes: false,
                })),
                returnsAggregate: this.isAggregateType(functionNode.returnType),
            };
        }

        public getCallEffectSummary(node: any): Types.Sir.SemanticFunctionEffectSummary | null {
            if (node.effectSummary) {
                return node.effectSummary;
            }

            if (typeof node.symbolId === "number" && node.symbolId >= 0) {
                return this.functionEffectSummaries.get(node.symbolId) ?? null;
            }

            const calleeName =
                node.callee?.value ??
                node.callee?.name ??
                node.callee?.raw;
            const symbol = calleeName ? this.resolveSymbol(calleeName) : null;

            return symbol?.effectSummary ?? null;
        }

        public getDeclarationKey(node: any): string | null {
            if (typeof node?.symbolId === "number" && node.symbolId >= 0) {
                return `symbol:${node.symbolId}`;
            }

            if (typeof node?.name === "string" && typeof node?.scopeId === "number") {
                return `scope:${node.scopeId}:${node.name}`;
            }

            return null;
        }

        public getAggregateIdentifierKey(node: any): string | null {
            if (!node || node.kind !== Kinds.Expressions.IdentifierExpression) {
                return null;
            }

            if (!this.isAggregateType(node.type)) {
                return null;
            }

            if (typeof node.symbolId === "number" && node.symbolId >= 0) {
                return `symbol:${node.symbolId}`;
            }

            const name = node.value ?? node.name ?? node.raw;
            if (typeof name === "string" && typeof node.scopeId === "number") {
                return `scope:${node.scopeId}:${name}`;
            }

            return null;
        }

        public isGlobalIdentifier(node: any): boolean {
            return (
                node?.kind === Kinds.Expressions.IdentifierExpression &&
                node.scopeId === 0
            );
        }

        public getAggregateRootExpression(node: any): any {
            if (!node) return null;

            if (node.kind === Kinds.Expressions.IdentifierExpression) {
                return node;
            }

            if (
                node.kind === Kinds.Expressions.PropertyAccessExpression ||
                node.kind === Kinds.Expressions.ElementAccessExpression
            ) {
                return this.getAggregateRootExpression(node.object);
            }

            return null;
        }

        public throwInvalidFunctionReturnError(functionNode: any, returnStatement: any): never {
            const expectedReturnType = functionNode.returnType;
            const actualType = this.getExpressionType(returnStatement.value);
            const valueNode = returnStatement.value ?? returnStatement;
            const valueText =
                valueNode.source ??
                valueNode.raw ??
                returnStatement.source ??
                "return";
            const message =
                `function ${Helpers.BLUE}'${functionNode.name}'${Helpers.RESET} must return a value of type ` +
                `${Helpers.BLUE}'${expectedReturnType.raw}'${Helpers.RESET}` +
                (actualType?.raw ? `, got ${Helpers.RED}'${actualType.raw}'${Helpers.RESET}` : "");

            valueNode.arrowLength = valueText.length || 1;

            this.throwError(
                message,
                valueNode.position ?? returnStatement.position ?? functionNode.position,
                functionNode.fullSource ?? functionNode.source ?? returnStatement.source ?? valueText,
                valueNode,
            );

            throw new Error(message);
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
