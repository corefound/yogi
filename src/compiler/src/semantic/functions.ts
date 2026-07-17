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
                declare: node.declare === true,
                ambient: node.ambient === true || node.declare === true,
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

            const previousReturnType = this.currentFunctionReturnType;
            this.currentFunctionReturnType = node.returnType;
            const body = this.visitFunctionBody(node.body);
            this.currentFunctionReturnType = previousReturnType;

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

            if (node.export) {
                this.exportSymbol(symbol);
            }

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

            this.validateTypeUsages(param.type, functionNode.fullSource ?? functionNode.source ?? param.source);

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
                mutable: param.mutable ?? true,
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
            let value = node.value ? this.visitNode(node.value) : null;
            const expectedReturnType = this.currentFunctionReturnType;
            this.rejectPersistentFunctionExpressions(
                value,
                node.fullSource ?? node.source,
                node,
                "be returned from a function",
            );

            if (
                value &&
                expectedReturnType &&
                this.canReadThroughPointer(expectedReturnType, value.type)
            ) {
                value = this.createImplicitPointerReadThrough(
                    value,
                    expectedReturnType,
                    node.fullSource ?? node.source,
                );
            }

            value = this.materializeBorrowedViewForEscape(
                value,
                node.fullSource ?? node.source,
                node,
            );
            this.rejectReturningLocalPointerDerivedValue(value, node);
            this.rejectReturningLocalDereferencedAggregate(value, node);

            if (expectedReturnType && this.rejectsImplicitObjectContractConversion(expectedReturnType, value)) {
                this.throwImplicitObjectContractConversionError(
                    expectedReturnType,
                    value,
                    node.fullSource ?? node.source,
                    node,
                );
            }

            if (expectedReturnType && value && (
                value.kind === Kinds.Collections.DictionaryExpression ||
                value.kind === Kinds.Collections.ArrayExpression
            )) {
                this.validateAggregateAssignment(
                    expectedReturnType,
                    value,
                    { name: "return value", position: node.position },
                    node.fullSource ?? node.source,
                );
            }

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

        public materializeBorrowedViewForEscape(value: any, source: string, node: any): any {
            if (!value) {
                return value;
            }

            if (value.kind === Kinds.Collections.DictionaryExpression) {
                let changed = false;
                const properties = (value.properties ?? []).map((property: any) => {
                    const materialized = this.materializeBorrowedViewForEscape(
                        property.value,
                        source,
                        property.value ?? node,
                    );

                    if (materialized !== property.value) {
                        changed = true;
                    }

                    return {
                        ...property,
                        value: materialized,
                        type: materialized?.type ?? property.type,
                    };
                });

                return changed ? { ...value, properties } : value;
            }

            if (value.kind === Kinds.Collections.ArrayExpression) {
                let changed = false;
                const elements = (value.elements ?? []).map((element: any) => {
                    const materialized = this.materializeBorrowedViewForEscape(element, source, element ?? node);

                    if (materialized !== element) {
                        changed = true;
                    }

                    return materialized;
                });

                return changed ? { ...value, elements } : value;
            }

            if (!this.shouldMaterializeBorrowedViewForEscape(value)) {
                return value;
            }

            const valueSource = value.source ?? "view";
            const position = value.position ?? node.position;
            const copyCallee = {
                kind: Kinds.Expressions.PropertyAccessExpression,
                object: value,
                property: "copy",
                optional: false,
                type: value.type,
                source: `${valueSource}.copy`,
                position,
            };

            return {
                kind: Kinds.Expressions.CallExpression,
                callee: copyCallee,
                arguments: [],
                argumentEffects: [],
                type: {
                    ...value.type,
                    readonly: false,
                },
                external: false,
                builtinMethod: "array.copy",
                source: `${valueSource}.copy()`,
                fullSource: source,
                position,
                materializedBorrowedView: true,
            };
        }

        public shouldMaterializeBorrowedViewForEscape(value: any): boolean {
            if (!value || value.borrowedView !== true) {
                return false;
            }

            const sourceName =
                value.borrowedViewSourceName ??
                this.borrowedViewRootName(value) ??
                (this as any).getAggregateRootIdentifier(value);
            const sourceSymbol = sourceName ? this.resolveSymbol(sourceName) : null;

            return sourceSymbol?.storage === Kinds.Storage.stack;
        }

        public prepareBorrowedViewForEscapingStorage(value: any, source: string, node: any, reason: string): any {
            if (!value) {
                return value;
            }

            if (value.kind === Kinds.Collections.DictionaryExpression) {
                let changed = false;
                let promoted = false;
                const properties = (value.properties ?? []).map((property: any) => {
                    const prepared = this.prepareBorrowedViewForEscapingStorage(
                        property.value,
                        source,
                        property.value ?? node,
                        `${reason} through property '${property.key ?? property.name ?? "member"}'`,
                    );

                    if (prepared !== property.value) {
                        changed = true;
                    }

                    if (prepared?.borrowedViewOwnerPromoted === true) {
                        promoted = true;
                    }

                    return {
                        ...property,
                        value: prepared,
                        type: prepared?.type ?? property.type,
                    };
                });

                return changed || promoted
                    ? {
                        ...value,
                        properties,
                        borrowedViewOwnerPromoted: promoted,
                    }
                    : value;
            }

            if (value.kind === Kinds.Collections.ArrayExpression) {
                let changed = false;
                let promoted = false;
                const elements = (value.elements ?? []).map((element: any, index: number) => {
                    const prepared = this.prepareBorrowedViewForEscapingStorage(
                        element,
                        source,
                        element ?? node,
                        `${reason} through element ${index}`,
                    );

                    if (prepared !== element) {
                        changed = true;
                    }

                    if (prepared?.borrowedViewOwnerPromoted === true) {
                        promoted = true;
                    }

                    return prepared;
                });

                return changed || promoted
                    ? {
                        ...value,
                        elements,
                        borrowedViewOwnerPromoted: promoted,
                    }
                    : value;
            }

            if (
                value.kind === Kinds.Expressions.IdentifierExpression &&
                value.borrowedView !== true
            ) {
                const promoted = this.promoteBorrowedViewGraphForEscape(value, reason);

                if (promoted) {
                    return {
                        ...value,
                        borrowedViewGraphOwnerPromoted: true,
                    };
                }
            }

            if (this.promoteBorrowedViewOwnerForEscape(value, reason)) {
                return {
                    ...value,
                    borrowedViewOwnerPromoted: true,
                };
            }

            return this.materializeBorrowedViewForEscape(value, source, node);
        }

        public borrowedViewGraph(value: any): { sourceNames: string[]; aggregateSymbolIds: number[] } {
            const sourceNames = new Set<string>();
            const aggregateSymbolIds = new Set<number>();
            const visit = (current: any): void => {
                if (!current) {
                    return;
                }

                if (Array.isArray(current)) {
                    current.forEach(visit);
                    return;
                }

                if (current.borrowedView === true) {
                    const sourceName =
                        current.borrowedViewSourceName ??
                        this.borrowedViewRootName(current) ??
                        (this as any).getAggregateRootIdentifier(current);

                    if (sourceName) {
                        sourceNames.add(sourceName);
                    }
                }

                if (current.kind === Kinds.Expressions.IdentifierExpression) {
                    const name = current.value ?? current.name ?? current.raw;
                    const symbol = name ? this.resolveSymbol(name) : null;

                    if (!symbol) {
                        return;
                    }

                    if (symbol.borrowedViewSourceName) {
                        sourceNames.add(symbol.borrowedViewSourceName);
                    }

                    for (const sourceName of symbol.borrowedViewGraphSourceNames ?? []) {
                        sourceNames.add(sourceName);
                    }

                    for (const symbolId of symbol.borrowedViewGraphAggregateSymbolIds ?? []) {
                        aggregateSymbolIds.add(symbolId);
                    }

                    if (
                        this.isAggregateType(symbol.type) &&
                        symbol.borrowedView !== true &&
                        (
                            (symbol.borrowedViewGraphSourceNames?.length ?? 0) > 0 ||
                            (symbol.borrowedViewGraphAggregateSymbolIds?.length ?? 0) > 0
                        )
                    ) {
                        aggregateSymbolIds.add(symbol.id);
                    }

                    return;
                }

                if (current.kind === Kinds.Collections.DictionaryExpression) {
                    for (const property of current.properties ?? []) {
                        visit(property.value);
                    }
                    return;
                }

                if (current.kind === Kinds.Collections.ArrayExpression) {
                    for (const element of current.elements ?? []) {
                        visit(element);
                    }
                    return;
                }

                if (
                    current.kind === Kinds.Expressions.PropertyAccessExpression ||
                    current.kind === Kinds.Expressions.ElementAccessExpression
                ) {
                    visit(current.object);
                    return;
                }

                if (current.kind === Kinds.Expressions.DereferenceExpression) {
                    visit(current.target);
                }
            };

            visit(value);

            return {
                sourceNames: [...sourceNames],
                aggregateSymbolIds: [...aggregateSymbolIds],
            };
        }

        public promoteBorrowedViewGraphForEscape(value: any, reason: string): boolean {
            const graph = this.borrowedViewGraph(value);
            const visited = new Set<number>();
            let promoted = false;

            const promoteSourceName = (sourceName: string): void => {
                if (this.promoteBorrowedViewSourceNameForEscape(sourceName, reason)) {
                    promoted = true;
                }
            };

            const promoteAggregateSymbol = (symbolId: number): void => {
                if (visited.has(symbolId)) {
                    return;
                }

                visited.add(symbolId);
                const symbol = this.getSymbolById(symbolId);

                if (!symbol || !this.isAggregateType(symbol.type)) {
                    return;
                }

                if (symbol.storage === Kinds.Storage.stack) {
                    symbol.escapes = true;
                    symbol.borrowedViewGraphEscaped = true;
                    promoted = true;
                }

                for (const sourceName of symbol.borrowedViewGraphSourceNames ?? []) {
                    promoteSourceName(sourceName);
                }

                for (const nestedSymbolId of symbol.borrowedViewGraphAggregateSymbolIds ?? []) {
                    promoteAggregateSymbol(nestedSymbolId);
                }
            };

            for (const sourceName of graph.sourceNames) {
                promoteSourceName(sourceName);
            }

            for (const symbolId of graph.aggregateSymbolIds) {
                promoteAggregateSymbol(symbolId);
            }

            return promoted;
        }

        public promoteBorrowedViewOwnerForEscape(value: any, reason: string): boolean {
            if (!this.shouldMaterializeBorrowedViewForEscape(value)) {
                return false;
            }

            const sourceName =
                value.borrowedViewSourceName ??
                this.borrowedViewRootName(value) ??
                (this as any).getAggregateRootIdentifier(value);

            return sourceName
                ? this.promoteBorrowedViewSourceNameForEscape(sourceName, reason)
                : false;
        }

        public promoteBorrowedViewSourceNameForEscape(sourceName: string, reason: string): boolean {
            const sourceSymbol = sourceName ? this.resolveSymbol(sourceName) : null;

            if (!sourceSymbol || sourceSymbol.storage !== Kinds.Storage.stack) {
                return false;
            }

            sourceSymbol.escapes = true;
            sourceSymbol.borrowedViewOwnerPromoted = true;
            sourceSymbol.borrowedViewOwnerPromotionReasons = [
                ...(sourceSymbol.borrowedViewOwnerPromotionReasons ?? []),
                reason,
            ];

            return true;
        }

        public rejectEscapingLocalFixedShapeView(value: any, node: any): void {
            if (!value || value.kind !== Kinds.Expressions.ElementAccessExpression) return;

            const objectType = this.resolveType(value.object?.declaredType ?? value.object?.type);
            const resultType = this.resolveType(value.type);
            const consumed = value.indices?.length ?? (value.index ? 1 : 0);
            const shape = objectType?.shape ?? [];

            if (
                objectType?.kind !== Kinds.Types.ArrayType ||
                objectType.fixed !== true ||
                consumed >= shape.length ||
                resultType?.kind !== Kinds.Types.ArrayType
            ) {
                return;
            }

            const rootName = this.borrowedViewRootName(value.object);
            const rootSymbol = rootName ? this.resolveSymbol(rootName) : null;

            if (
                rootSymbol?.kind !== Kinds.ScopeSymbols.Variable ||
                rootSymbol.storage !== Kinds.Storage.stack
            ) {
                return;
            }

            value.arrowLength = value.source?.length ?? 1;
            this.throwError(
                `cannot return borrowed slice from local fixed-shape array ${Helpers.RED}'${rootName}'${Helpers.RESET}`,
                value.position ?? node.position,
                node.fullSource ?? node.source,
                value,
                "  = partial indexing returns a borrowed view tied to the source array lifetime\n  = use '.copy()' to return an owned array copy explicitly",
            );
        }

        public rejectReturningLocalPointerDerivedValue(value: any, node: any): void {
            if (!value || !this.isPointerType(value.type)) return;

            const rootSymbol = this.pointerReturnRootSymbol(value);

            if (
                !rootSymbol ||
                rootSymbol.kind === Kinds.ScopeSymbols.Parameter ||
                rootSymbol.storage !== Kinds.Storage.stack
            ) {
                return;
            }

            const rootName = rootSymbol.name ?? this.pointerReturnRootName(value) ?? "local";
            value.arrowLength = value.source?.length ?? 1;
            this.throwError(
                `cannot return pointer or pointer view derived from local storage ${Helpers.RED}'${rootName}'${Helpers.RESET}`,
                value.position ?? node.position,
                node.fullSource ?? node.source,
                value,
                "  = returned pointers must be derived from a parameter or longer-lived storage",
            );
        }

        public rejectReturningLocalDereferencedAggregate(value: any, node: any): void {
            if (
                !value ||
                value.kind !== Kinds.Expressions.DereferenceExpression ||
                !this.isAggregateType(value.type)
            ) {
                return;
            }

            const rootSymbol = this.pointerReturnRootSymbol(value);

            if (
                !rootSymbol ||
                rootSymbol.kind === Kinds.ScopeSymbols.Parameter ||
                rootSymbol.storage !== Kinds.Storage.stack
            ) {
                return;
            }

            const rootName = rootSymbol.name ?? value.rootName ?? "local";
            value.arrowLength = value.source?.length ?? 1;
            this.throwError(
                `cannot return borrowed dereference derived from local storage ${Helpers.RED}'${rootName}'${Helpers.RESET}`,
                value.position ?? node.position,
                node.fullSource ?? node.source,
                value,
                "  = return an owned copy or borrow from a parameter with an explicit lifetime summary",
            );
        }

        public pointerReturnRootSymbol(value: any): Types.SymbolInfo | null {
            const rootSymbolId =
                value?.rootSymbolId ??
                value?.pointerRootSymbolId;

            if (typeof rootSymbolId === "number" && rootSymbolId >= 0) {
                return this.getSymbolById(rootSymbolId);
            }

            const rootName = this.pointerReturnRootName(value);
            return rootName ? this.resolveSymbol(rootName) : null;
        }

        public pointerReturnRootName(value: any): string | null {
            if (!value) return null;

            if (value.pointerRootName || value.rootName) {
                return value.pointerRootName ?? value.rootName;
            }

            if (value.kind === Kinds.Expressions.IdentifierExpression) {
                return value.value ?? value.name ?? value.raw ?? null;
            }

            if (value.kind === Kinds.Expressions.AddressOfExpression) {
                return value.rootName ?? value.pointerRootName ?? this.borrowedViewRootName(value.target);
            }

            if (
                value.kind === Kinds.Expressions.ElementAccessExpression ||
                value.kind === Kinds.Expressions.PropertyAccessExpression
            ) {
                return this.pointerReturnRootName(value.object) ?? this.borrowedViewRootName(value.object);
            }

            if (value.kind === Kinds.Expressions.DereferenceExpression) {
                return value.rootName ?? value.pointerRootName ?? this.pointerReturnRootName(value.target);
            }

            return null;
        }

        public borrowedViewRootName(node: any): string | null {
            if (!node) return null;

            if (node.kind === Kinds.Expressions.IdentifierExpression) {
                return node.value ?? node.name ?? node.raw ?? null;
            }

            if (
                node.kind === Kinds.Expressions.PropertyAccessExpression ||
                node.kind === Kinds.Expressions.ElementAccessExpression
            ) {
                return this.borrowedViewRootName(node.object);
            }

            if (node.kind === Kinds.Expressions.DereferenceExpression) {
                return node.borrowedViewSourceName ?? node.rootName ?? this.borrowedViewRootName(node.target);
            }

            return null;
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

            if (!context.regular && this.currentScope.parent !== null) {
                const message =
                    `local function value ${Helpers.RED}'${context.name}'${Helpers.RESET} is not supported yet`;

                context.arrowLength = context.name?.length ?? 1;
                this.throwError(
                    message,
                    context.position,
                    context.fullSource ?? context.source,
                    context,
                    "  = module-level named callbacks are supported\n  = inline callbacks passed directly to array methods are supported\n  = persistent closures need an explicit capture lifetime model first",
                );
            }

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

            this.validateTypeUsages(context.returnType, context.fullSource ?? context.source);

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

        public rejectPersistentFunctionExpressions(value: any, source: string, node: any, reason: string): void {
            const visit = (current: any): void => {
                if (!current) {
                    return;
                }

                if (Array.isArray(current)) {
                    current.forEach(visit);
                    return;
                }

                if (current.kind === Kinds.Functions.FunctionExpression) {
                    current.arrowLength = current.source?.length ?? 1;
                    this.throwError(
                        `function expression cannot ${reason}`,
                        current.position ?? node.position,
                        source ?? current.source ?? node.source,
                        current,
                        "  = inline callbacks are supported only when passed directly to array methods\n  = storing or returning callbacks requires a real closure object and capture lifetime summary\n  = borrowed views captured by persistent closures are rejected until that ownership model exists",
                    );
                }

                if (current.kind === Kinds.Collections.DictionaryExpression) {
                    for (const property of current.properties ?? []) {
                        visit(property.value);
                    }
                    return;
                }

                if (current.kind === Kinds.Collections.ArrayExpression) {
                    for (const element of current.elements ?? []) {
                        visit(element);
                    }
                    return;
                }

                if (current.kind === Kinds.Expressions.ConditionalExpression) {
                    visit(current.whenTrue);
                    visit(current.whenFalse);
                    return;
                }
            };

            visit(value);
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
                    invalidations: [] as Types.Sir.SemanticArrayInvalidationEffect[],
                })),
                returnsAggregate: this.isAggregateType(returnType),
                returnBorrow: {
                    ownership: "owned",
                    parameterIndex: -1,
                    readonlyFollowsParameter: false,
                    viewShape: [],
                    accessPath: [],
                },
            };
        }

        public analyzeAggregateEscapes(functionNode: any): Types.Sir.SemanticFunctionEffectSummary {
            const declarations = new Map<string, any>();
            const aliases = new Map<string, Set<string>>();
            const escaping = new Set<string>();
            const returned = new Set<string>();
            const stored = new Set<string>();
            const mutated = new Set<string>();
            const pointerMutated = new Set<string>();
            const arrayInvalidations = new Map<string, any[]>();
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

            const getPointerIdentifierKey = (value: any): string | null => {
                if (!value || value.kind !== Kinds.Expressions.IdentifierExpression) {
                    return null;
                }

                if (!this.isPointerType(value.type)) {
                    return null;
                }

                if (typeof value.symbolId === "number" && value.symbolId >= 0) {
                    return `symbol:${value.symbolId}`;
                }

                const name = value.value ?? value.name ?? value.raw;
                if (typeof name === "string" && typeof value.scopeId === "number") {
                    return `scope:${value.scopeId}:${name}`;
                }

                return null;
            };

            const getAggregateOrPointerIdentifierKey = (value: any): string | null => {
                return this.getAggregateIdentifierKey(value) ?? getPointerIdentifierKey(value);
            };

            const addMutatedIdentifier = (value: any): void => {
                const key = getAggregateOrPointerIdentifierKey(value);
                if (key) mutated.add(key);
            };

            const addPointerMutatedIdentifier = (value: any): void => {
                const key = getPointerIdentifierKey(value);
                if (key) pointerMutated.add(key);
            };

            const addArrayInvalidationIdentifier = (value: any, effect: any): void => {
                const key = getAggregateOrPointerIdentifierKey(value);
                addArrayInvalidationKey(key, effect);
            };

            const addArrayInvalidationKey = (key: string | null, effect: any): void => {
                if (!key || !effect) return;

                if (!arrayInvalidations.has(key)) {
                    arrayInvalidations.set(key, []);
                }

                const effects = arrayInvalidations.get(key)!;
                const signature = JSON.stringify(effect);
                if (!effects.some((existing: any) => JSON.stringify(existing) === signature)) {
                    effects.push(effect);
                }
            };

            const arrayInvalidationEffectFromMethod = (methodName: string | null | undefined, args: any[], maybe: boolean): any | null => {
                switch (methodName) {
                    case "array.shift":
                    case "shift":
                        return { kind: "shift", maybe };

                    case "array.pop":
                    case "pop":
                        return { kind: "pop", maybe };

                    case "array.splice":
                    case "splice": {
                        const start = this.literalIndexValue(args[0]);
                        const deleteCount = args[1] ? this.literalIndexValue(args[1]) : null;

                        if (
                            typeof start !== "number" ||
                            !Number.isInteger(start) ||
                            (
                                args[1] &&
                                (
                                    typeof deleteCount !== "number" ||
                                    !Number.isInteger(deleteCount)
                                )
                            )
                        ) {
                            return null;
                        }

                        return {
                            kind: "splice",
                            start,
                            deleteCount: args[1] ? deleteCount : null,
                            maybe,
                        };
                    }

                    default:
                        return null;
                }
            };

            const visit = (node: any, context: { maybe: boolean } = { maybe: false }): void => {
                if (!node) return;

                if (Array.isArray(node)) {
                    for (const child of node) visit(child, context);
                    return;
                }

                if (node.kind === Kinds.Statements.IfStatement) {
                    visit(node.condition, context);
                    visit(node.then, { maybe: true });
                    visit(node.else, { maybe: true });
                    return;
                }

                if (
                    node.kind === Kinds.Statements.WhileStatement ||
                    node.kind === Kinds.Statements.ForStatement ||
                    node.kind === Kinds.Statements.SwitchStatement
                ) {
                    visit(node.condition, context);
                    visit(node.initializer, context);
                    visit(node.expression, context);
                    visit(node.body, { maybe: true });
                    visit(node.clauses, { maybe: true });
                    visit(node.incrementor, { maybe: true });
                    return;
                }

                if (node.kind === Kinds.Statements.VariableDeclaration) {
                    const key = this.getDeclarationKey(node);

                    if (key) declarations.set(key, node);

                    if (this.isAggregateType(node.type)) {
                        addAlias(key, this.getAggregateIdentifierKey(node.value));
                    }

                    visit(node.value, context);
                    return;
                }

                if (node.kind === Kinds.Expressions.AssignmentExpression) {
                    const left = node.left;
                    const right = node.right;
                    const leftKey = this.getAggregateIdentifierKey(left);
                    const rightKey = this.getAggregateIdentifierKey(right);

                    if (
                        leftKey &&
                        this.isDynamicArrayType(left?.declaredType ?? left?.type) &&
                        right?.kind === Kinds.Collections.ArrayExpression
                    ) {
                        addArrayInvalidationIdentifier(left, {
                            kind: "replace",
                            newLength: right.elements?.length ?? 0,
                            maybe: context.maybe,
                        });
                    }

                    if (this.isGlobalIdentifier(left)) {
                        addStoredIdentifier(right);
                    } else {
                        addAlias(leftKey, rightKey);
                    }

                    visit(right, context);
                    return;
                }

                if (node.kind === "AggregateAssignmentExpression") {
                    if (node.target?.kind === Kinds.Expressions.DereferenceExpression) {
                        addPointerMutatedIdentifier(node.target.target);
                        visit(node.target, context);
                        visit(node.right, context);
                        return;
                    }

                    const root = this.getAggregateRootExpression(node.target);
                    const targetObjectType = node.target?.object?.declaredType ?? node.target?.object?.type;
                    const rootType = root?.declaredType ?? root?.type;

                    if (
                        targetObjectType?.kind === Kinds.Types.PointerType ||
                        rootType?.kind === Kinds.Types.PointerType ||
                        node.target?.pointerAccess === true
                    ) {
                        addPointerMutatedIdentifier(root);
                        visit(node.target, context);
                        visit(node.right, context);
                        return;
                    }

                    if (this.isGlobalIdentifier(root)) {
                        addStoredIdentifier(node.right);
                    } else {
                        addMutatedIdentifier(root);
                        propertyStores.push({
                            root: this.getAggregateIdentifierKey(root),
                            value: this.getAggregateIdentifierKey(node.right),
                        });
                    }

                    visit(node.target, context);
                    visit(node.right, context);
                    return;
                }

                if (node.kind === Kinds.Statements.ReturnStatement) {
                    addReturnedIdentifier(node.value);
                    visit(node.value, context);
                    return;
                }

                if (node.kind === Kinds.Expressions.CallExpression) {
                    const mutatingArrayMethods = new Set([
                        "array.push",
                        "array.pop",
                        "array.shift",
                        "array.unshift",
                        "array.reverse",
                        "array.fill",
                        "array.copyWithin",
                        "array.splice",
                    ]);
                    const mutatingPropertyMethods = new Set([
                        "push",
                        "pop",
                        "shift",
                        "unshift",
                        "reverse",
                        "fill",
                        "copyWithin",
                        "splice",
                    ]);

                    if (
                        mutatingArrayMethods.has(node.builtinMethod) ||
                        (
                            node.callee?.kind === Kinds.Expressions.PropertyAccessExpression &&
                            mutatingPropertyMethods.has(node.callee?.property)
                        )
                    ) {
                        addMutatedIdentifier(node.callee?.object);
                        const effect = arrayInvalidationEffectFromMethod(
                            node.builtinMethod ?? node.callee?.property,
                            node.arguments ?? [],
                            context.maybe,
                        );
                        if (effect) {
                            addArrayInvalidationIdentifier(node.callee?.object, effect);
                        }
                        visit(node.callee?.object, context);
                        visit(node.arguments, context);
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

                            for (const invalidation of effect?.invalidations ?? []) {
                                addArrayInvalidationIdentifier(argument, {
                                    ...invalidation,
                                    maybe: context.maybe || invalidation.maybe === true,
                                });
                            }
                        }

                        visit(argument, context);
                    }

                    visit(node.callee, context);
                    return;
                }

                for (const value of Object.values(node)) {
                    if (value && typeof value === "object") {
                        visit(value, context);
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
                    if (!pointerMutated.has(target)) continue;

                    for (const source of sources) {
                        if (!pointerMutated.has(source)) {
                            pointerMutated.add(source);
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

                for (const [target, sources] of aliases.entries()) {
                    const effects = arrayInvalidations.get(target);
                    if (!effects?.length) continue;

                    for (const source of sources) {
                        const previousCount = arrayInvalidations.get(source)?.length ?? 0;
                        for (const effect of effects) {
                            addArrayInvalidationKey(source, effect);
                        }

                        if ((arrayInvalidations.get(source)?.length ?? 0) !== previousCount) {
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
                    mutates: key ? (mutated.has(key) || pointerMutated.has(key)) : false,
                    consumes: false,
                    invalidations: key ? arrayInvalidations.get(key) ?? [] : [],
                })),
                returnsAggregate: this.isAggregateType(functionNode.returnType),
                returnBorrow: this.analyzeReturnBorrowSummary(functionNode),
            };
        }

        public analyzeReturnBorrowSummary(functionNode: any): Types.Sir.SemanticReturnBorrowSummary {
            const owned: Types.Sir.SemanticReturnBorrowSummary = {
                ownership: "owned",
                parameterIndex: -1,
                readonlyFollowsParameter: false,
                viewShape: [],
                accessPath: [],
            };
            const returnStatements = this.findFunctionReturnStatements(functionNode.body);
            const borrowedReturns = returnStatements
                .map((returnStatement: any) => this.getReturnBorrowFromValue(returnStatement.value, functionNode))
                .filter((summary: any) => summary !== null);

            if (!borrowedReturns.length) {
                return owned;
            }

            const first = borrowedReturns[0];
            const conflicting = borrowedReturns.find((summary: any) => {
                return summary.parameterIndex !== first.parameterIndex;
            });

            if (conflicting) {
                const value = returnStatements.find((returnStatement: any) => {
                    const summary = this.getReturnBorrowFromValue(returnStatement.value, functionNode);
                    return summary?.parameterIndex === conflicting.parameterIndex;
                })?.value;
                const message =
                    `cannot summarize borrowed return for function ${Helpers.BLUE}'${functionNode.name}'${Helpers.RESET} ` +
                    `because return paths borrow from different parameters`;

                if (value) {
                    value.arrowLength = value.source?.length ?? 1;
                }

                this.throwError(
                    message,
                    value?.position ?? functionNode.position,
                    functionNode.fullSource ?? functionNode.source ?? value?.source,
                    value ?? functionNode,
                    "  = return a view borrowed from a single parameter or use '.copy()' for an owned result",
                );
            }

            const sameAccessPath = borrowedReturns.every((summary: any) => {
                const accessPath = summary.accessPath ?? [];
                const firstAccessPath = first.accessPath ?? [];

                return (
                    accessPath.length === firstAccessPath.length &&
                    accessPath.every((part: string, index: number) => part === firstAccessPath[index])
                );
            });

            return {
                ...first,
                accessPath: sameAccessPath ? first.accessPath ?? [] : ["[?]"],
            };
        }

        public getReturnBorrowFromValue(value: any, functionNode: any): Types.Sir.SemanticReturnBorrowSummary | null {
            if (!value || (!this.isAggregateType(value.type) && !this.isPointerType(value.type))) {
                return null;
            }

            if (this.isPointerType(value.type)) {
                return this.getReturnBorrowFromPointerValue(value, functionNode);
            }

            if (value.kind === Kinds.Expressions.DereferenceExpression && value.borrowedView === true) {
                return this.getReturnBorrowFromDereference(value, functionNode);
            }

            if (value.kind === Kinds.Expressions.ElementAccessExpression) {
                return this.getReturnBorrowFromElementAccess(value, functionNode);
            }

            if (value.kind === Kinds.Expressions.CallExpression) {
                return this.getReturnBorrowFromCall(value, functionNode);
            }

            return null;
        }

        public getReturnBorrowFromDereference(value: any, functionNode: any): Types.Sir.SemanticReturnBorrowSummary | null {
            const rootName = value.borrowedViewSourceName ?? value.rootName ?? this.pointerReturnRootName(value.target);
            const parameterIndex = this.functionParameterIndex(functionNode, rootName);

            if (parameterIndex < 0) {
                return null;
            }

            return {
                ownership: "borrowed",
                parameterIndex,
                readonlyFollowsParameter: true,
                viewShape: this.borrowedReturnViewShape(value.type),
                accessPath: this.pointerReturnAccessPath(value),
            };
        }

        public getReturnBorrowFromPointerValue(value: any, functionNode: any): Types.Sir.SemanticReturnBorrowSummary | null {
            if (value.kind === Kinds.Expressions.CallExpression) {
                return this.getReturnBorrowFromCall(value, functionNode);
            }

            const rootName = this.pointerReturnRootName(value);
            const parameterIndex = this.functionParameterIndex(functionNode, rootName);

            if (parameterIndex < 0) {
                return null;
            }

            return {
                ownership: "borrowed",
                parameterIndex,
                readonlyFollowsParameter: true,
                viewShape: this.borrowedReturnViewShape(value.type),
                accessPath: this.pointerReturnAccessPath(value),
            };
        }

        public getReturnBorrowFromElementAccess(value: any, functionNode: any): Types.Sir.SemanticReturnBorrowSummary | null {
            if (value.borrowedView !== true) {
                return null;
            }

            const rootName = this.borrowedViewRootName(value.object);
            const parameterIndex = this.functionParameterIndex(functionNode, rootName);

            if (parameterIndex < 0) {
                return null;
            }

            return {
                ownership: "borrowed",
                parameterIndex,
                readonlyFollowsParameter: true,
                viewShape: this.borrowedReturnViewShape(value.type),
                accessPath: this.aggregateReturnAccessPath(value),
            };
        }

        public getReturnBorrowFromCall(value: any, functionNode: any): Types.Sir.SemanticReturnBorrowSummary | null {
            const callBorrow = value.effectSummary?.returnBorrow;

            if (callBorrow?.ownership !== "borrowed") {
                return null;
            }

            const argument = value.arguments?.[callBorrow.parameterIndex];
            const rootName = this.borrowedViewRootName(argument);
            const parameterIndex = this.functionParameterIndex(functionNode, rootName);

            if (parameterIndex < 0) {
                return null;
            }

            return {
                ownership: "borrowed",
                parameterIndex,
                readonlyFollowsParameter: true,
                viewShape: this.borrowedReturnViewShape(value.type),
                accessPath: [
                    ...this.pointerReturnAccessPath(argument),
                    ...(callBorrow.accessPath ?? []),
                ],
            };
        }

        public pointerReturnAccessPath(value: any): string[] {
            if (!value) return [];

            if (Array.isArray(value.pointerAccessPath)) {
                return [...value.pointerAccessPath];
            }

            if (Array.isArray(value.accessPath)) {
                return [...value.accessPath];
            }

            if (value.kind === Kinds.Expressions.CallExpression) {
                const callBorrow = value.effectSummary?.returnBorrow;
                if (callBorrow?.ownership === "borrowed") {
                    const argument = value.arguments?.[callBorrow.parameterIndex];
                    return [
                        ...this.pointerReturnAccessPath(argument),
                        ...(callBorrow.accessPath ?? []),
                    ];
                }
            }

            if (
                value.kind === Kinds.Expressions.PropertyAccessExpression ||
                value.kind === Kinds.Expressions.ElementAccessExpression
            ) {
                return this.aggregateReturnAccessPath(value);
            }

            if (value.kind === Kinds.Expressions.AddressOfExpression) {
                return this.pointerReturnAccessPath(value.target);
            }

            if (value.kind === Kinds.Expressions.DereferenceExpression) {
                return this.pointerReturnAccessPath(value.target);
            }

            return [];
        }

        public aggregateReturnAccessPath(value: any): string[] {
            if (!value) return [];

            if (Array.isArray(value.pointerAccessPath)) {
                return [...value.pointerAccessPath];
            }

            if (Array.isArray(value.accessPath)) {
                return [...value.accessPath];
            }

            return [];
        }

        public functionParameterIndex(functionNode: any, name: string | null): number {
            if (!name) {
                return -1;
            }

            return (functionNode.params ?? []).findIndex((param: any) => param.name === name);
        }

        public borrowedReturnViewShape(type: any): number[] {
            const resolvedType = this.resolveType(type);
            const arrayType = resolvedType?.kind === Kinds.Types.PointerType
                ? this.resolveType(resolvedType.elementType ?? resolvedType.pointee)
                : resolvedType;

            if (arrayType?.kind !== Kinds.Types.ArrayType || arrayType.fixed !== true) {
                return [];
            }

            return Array.isArray(arrayType.shape) ? arrayType.shape : [];
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

            return symbol?.effectSummary ?? symbol?.node?.effectSummary ?? null;
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

            if (node.kind === Kinds.Statements.IfStatement || node.kind === Kinds.ControlFlow.IfStatement) {
                return [
                    ...this.findFunctionReturnStatements(node.then),
                    ...this.findFunctionReturnStatements(node.else),
                ];
            }

            if (node.kind === Kinds.Statements.SwitchStatement) {
                return (node.clauses ?? []).flatMap(
                    (clause: any) => this.findFunctionReturnStatements(clause.body),
                );
            }

            return [];
        }
    };
}
