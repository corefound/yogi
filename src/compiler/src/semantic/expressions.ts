import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function ExpressionsSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitCastExpression(node: any): any {
            const expression = this.visitNode(node.expression);
            const targetType = this.toSerializableType(node.type);

            if (!targetType || targetType.kind === Kinds.Types.UnTyped) {
                this.throwError(
                    Kinds.ErrrorsMessage.MissingType,
                    node.position,
                    node.fullSource ?? node.source,
                    node,
                );
            }

            const sourceType = expression?.type;
            const sourceAllowsCast =
                sourceType?.kind === Kinds.Types.AnyType ||
                sourceType?.kind === Kinds.Types.UnknownType;

            const targetAllowsCast =
                targetType.kind === Kinds.Types.AnyType ||
                targetType.kind === Kinds.Types.UnknownType;

            const structurallyRelated =
                this.isTypeAssignable(targetType, sourceType) ||
                this.isTypeAssignable(sourceType, targetType);

            if (!sourceAllowsCast && !targetAllowsCast && !structurallyRelated) {
                const message =
                    `cannot cast value of type ${Helpers.RED}'${sourceType?.raw ?? "unknown"}'${Helpers.RESET} to ` +
                    `${Helpers.RED}'${targetType.raw ?? "unknown"}'${Helpers.RESET}`;

                node.arrowLength = node.source?.length ?? 1;

                this.throwError(
                    message,
                    node.position,
                    node.fullSource ?? node.source,
                    node,
                );
            }

            return {
                ...expression,
                type: targetType,
                cast: {
                    explicit: true,
                    from: sourceType,
                    to: targetType,
                    source: node.source,
                    position: node.position,
                },
            };
        }

        public visitSatisfiesExpression(node: any): any {
            const expression = this.visitNode(node.expression);
            const targetType = this.toSerializableType(node.type);

            if (!this.isTypeAssignable(targetType, expression?.type)) {
                const message =
                    `value of type ${Helpers.RED}'${expression?.type?.raw ?? "unknown"}'${Helpers.RESET} does not satisfy ` +
                    `${Helpers.RED}'${targetType?.raw ?? "unknown"}'${Helpers.RESET}`;

                node.arrowLength = node.source?.length ?? 1;
                this.throwError(message, node.position, node.fullSource ?? node.source, node);
            }

            return {
                ...expression,
                satisfies: {
                    type: targetType,
                    source: node.source,
                    position: node.position,
                },
            };
        }

        public visitNonNullExpression(node: any): any {
            const expression = this.visitNode(node.expression);
            const type = this.removeNullishFromType(expression?.type);

            return {
                ...expression,
                type,
                nonNull: {
                    source: node.source,
                    position: node.position,
                },
            };
        }

        public visitConditionalExpression(node: any): any {
            const condition = this.visitNode(node.condition);

            if (condition?.type?.kind !== Kinds.Types.BooleanType) {
                const message =
                    `conditional expression condition must be ${Helpers.RED}'boolean'${Helpers.RESET}`;

                node.arrowLength = node.condition?.source?.length ?? 1;
                this.throwError(message, node.condition?.position ?? node.position, node.fullSource ?? node.source, node.condition ?? node);
            }

            const whenTrue = this.visitNode(node.whenTrue);
            const whenFalse = this.visitNode(node.whenFalse);
            const type = this.commonConditionalType(whenTrue?.type, whenFalse?.type);

            if (!type) {
                const message =
                    `conditional branches have incompatible types ` +
                    `${Helpers.RED}'${whenTrue?.type?.raw ?? "unknown"}'${Helpers.RESET} and ` +
                    `${Helpers.RED}'${whenFalse?.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                node.arrowLength = node.source?.length ?? 1;
                this.throwError(message, node.position, node.fullSource ?? node.source, node);
            }

            const knownCondition = this.constantBooleanValue(condition);

            if (knownCondition !== null) {
                const selected = knownCondition ? whenTrue : whenFalse;

                return {
                    ...selected,
                    source: node.source,
                    position: node.position,
                    conditional: {
                        condition,
                        whenTrue,
                        whenFalse,
                    },
                };
            }

            return {
                ...node,
                kind: Kinds.Expressions.ConditionalExpression,
                condition,
                whenTrue,
                whenFalse,
                type,
            };
        }

        public visitCallExpression(node: any): any {
            if (node.callee?.kind === Kinds.Expressions.PropertyAccessExpression) {
                return this.visitBuiltinMethodCall(node);
            }

            const callee = this.visitNode(node.callee);
            const args = (node.arguments ?? []).map((argument: any) => this.visitNode(argument));

            if (callee?.kind !== Kinds.Expressions.IdentifierExpression) {
                const message = `only direct function calls are supported for now`;
                node.arrowLength = node.callee?.source?.length ?? node.source?.length ?? 1;
                this.throwError(message, node.position, node.fullSource ?? node.source, node);
            }

            const calleeName = callee.value ?? callee.name ?? callee.raw;
            const symbol = this.resolveSymbol(calleeName);

            if (!symbol || symbol.kind !== Kinds.ScopeSymbols.Function) {
                const message = `${Helpers.RED}'${calleeName}'${Helpers.RESET} is not a callable function`;
                callee.arrowLength = calleeName?.length ?? 1;
                this.throwError(message, callee.position ?? node.position, node.fullSource ?? node.source, callee);
            }

            const parameters = symbol.node?.params ?? [];

            if (args.length !== parameters.length) {
                const message =
                    `function ${Helpers.BLUE}'${calleeName}'${Helpers.RESET} expects ` +
                    `${Helpers.BLUE}'${parameters.length}'${Helpers.RESET} argument(s), got ` +
                    `${Helpers.RED}'${args.length}'${Helpers.RESET}`;

                node.arrowLength = node.source?.length ?? calleeName?.length ?? 1;
                this.throwError(message, node.position, node.fullSource ?? node.source, node);
            }

            for (let index = 0; index < args.length; index++) {
                const expectedType = parameters[index]?.type;
                const pointerPointeeType = this.pointerPointeeType(args[index]?.type);
                const forcePrintReadThrough =
                    symbol.node?.builtinMethod === "print" &&
                    pointerPointeeType &&
                    !this.isAggregateType(pointerPointeeType);

                if (
                    forcePrintReadThrough ||
                    this.canReadThroughPointer(expectedType, args[index]?.type)
                ) {
                    args[index] = this.createImplicitPointerReadThrough(
                        args[index],
                        forcePrintReadThrough
                            ? pointerPointeeType
                            : expectedType,
                        node.fullSource ?? node.source,
                    );
                }

                const actualType = args[index]?.type;

                if (this.rejectsImplicitObjectContractConversion(expectedType, args[index])) {
                    this.throwImplicitObjectContractConversionError(
                        expectedType,
                        args[index],
                        node.fullSource ?? node.source,
                        node,
                    );
                }

                const resolvedExpected = this.resolveType(expectedType);
                let validatedByAggregate = false;

                if (args[index].kind === Kinds.Collections.DictionaryExpression) {
                    if (this.isObjectLikeType(resolvedExpected)) {
                        this.validateObjectLiteralAssignment(
                            resolvedExpected,
                            args[index],
                            { name: `argument ${index + 1} of '${calleeName}'`, position: args[index].position },
                            node.fullSource ?? node.source,
                        );
                        validatedByAggregate = true;
                    }
                }

                if (args[index].kind === Kinds.Collections.ArrayExpression) {
                    if (
                        resolvedExpected?.kind === Kinds.Types.ArrayType ||
                        resolvedExpected?.kind === Kinds.Types.TupleType
                    ) {
                        this.validateAggregateAssignment(
                            expectedType,
                            args[index],
                            { name: `argument ${index + 1} of '${calleeName}'`, position: args[index].position },
                            node.fullSource ?? node.source,
                        );
                        validatedByAggregate = true;
                    }
                }

                if (!validatedByAggregate && !this.isTypeAssignable(expectedType, actualType)) {
                    const resolvedExpected = this.resolveType(expectedType);
                    const resolvedActual = this.resolveType(actualType);
                    const expectedIsPointer = resolvedExpected?.kind === Kinds.Types.PointerType;
                    const actualIsPointer = resolvedActual?.kind === Kinds.Types.PointerType;

                    if (expectedIsPointer || actualIsPointer) {
                        const message = actualIsPointer && !expectedIsPointer
                            ? this.pointerReadThroughMismatchMessage(expectedType, actualType)
                            : `expected ${Helpers.BLUE}'${expectedType?.raw ?? resolvedExpected?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                                `${Helpers.RED}'${actualType?.raw ?? resolvedActual?.raw ?? "unknown"}'${Helpers.RESET}`;
                        const help = expectedIsPointer && args[index]?.kind === Kinds.Expressions.IdentifierExpression
                            ? `  = pass '&${args[index].name ?? args[index].value ?? args[index].raw}'`
                            : undefined;

                        args[index].arrowLength = args[index].source?.length ?? 1;
                        this.throwError(
                            message,
                            args[index].position ?? node.position,
                            node.fullSource ?? node.source,
                            args[index],
                            help,
                        );
                    }

                    const message =
                        `argument ${Helpers.BLUE}'${index + 1}'${Helpers.RESET} of ` +
                        `${Helpers.BLUE}'${calleeName}'${Helpers.RESET} must be ` +
                        `${Helpers.BLUE}'${expectedType?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                        `${Helpers.RED}'${actualType?.raw ?? "unknown"}'${Helpers.RESET}`;

                    args[index].arrowLength = args[index].source?.length ?? 1;
                    this.throwError(message, args[index].position ?? node.position, node.fullSource ?? node.source, args[index]);
                }
            }

            const returnType = this.toSerializableType(symbol.node?.returnType ?? {
                kind: Kinds.Types.UnknownType,
                raw: "unknown",
            });
            const returnIsPointer = this.isPointerType(returnType);
            const effectSummary = symbol.effectSummary ?? symbol.node?.effectSummary ?? null;
            const external = symbol.ambient === true || symbol.declare === true || !effectSummary;
            if (!external) {
                args.forEach((argument: any, index: number) => {
                    const expectedType = parameters[index]?.type;
                    const expectedIsPointer = this.isPointerType(expectedType);
                    const effect = effectSummary?.parameterEffects?.[index];

                    if (
                        expectedIsPointer &&
                        effect?.mutates === true &&
                        argument?.pointerPermission === "readonly"
                    ) {
                        const parameterName = parameters[index]?.name ?? `argument ${index + 1}`;
                        const rootName = argument.pointerRootName ?? "unknown";
                        argument.arrowLength = argument.source?.length ?? 1;
                        this.throwError(
                            `function ${Helpers.BLUE}'${calleeName}'${Helpers.RESET} may mutate pointer parameter ` +
                            `${Helpers.BLUE}'${parameterName}'${Helpers.RESET}, but argument ` +
                            `${Helpers.RED}'${argument.source ?? rootName}'${Helpers.RESET} points to const storage`,
                            argument.position ?? node.position,
                            node.fullSource ?? node.source,
                            argument,
                        );
                    }
                });
            }
            const argumentEffects = args.map((_: any, index: number) => {
                const effect = effectSummary?.parameterEffects?.[index];

                return {
                    index,
                    escapes: external ? this.isAggregateType(parameters[index]?.type) : effect?.escapes === true,
                    mutates: effect?.mutates === true,
                    consumes: effect?.consumes === true,
                };
            });

            argumentEffects.forEach((effect: any, index: number) => {
                const argument = args[index];

                if (!argument || !this.isAggregateType(argument.type)) {
                    return;
                }

                if (effect.consumes === true || effect.escapes === true) {
                    const reason = external
                        ? `it was passed to unknown/external function '${calleeName}'`
                        : `function '${calleeName}' may retain or return that parameter`;

                    this.markAggregateExpressionMoved(argument, reason, argument);
                }
            });

            const returnBorrow = effectSummary?.returnBorrow;
            const borrowedReturnParameterIndex =
                returnBorrow?.ownership === "borrowed"
                    ? returnBorrow.parameterIndex
                    : -1;
            const borrowedReturnArgument =
                typeof borrowedReturnParameterIndex === "number" &&
                    borrowedReturnParameterIndex >= 0 &&
                    borrowedReturnParameterIndex < args.length
                    ? args[borrowedReturnParameterIndex]
                    : null;
            const borrowedReturnInfo = borrowedReturnArgument && !returnIsPointer
                ? this.borrowedArrayReadonlyInfo(
                    borrowedReturnArgument,
                    this.resolveType(borrowedReturnArgument.declaredType ?? borrowedReturnArgument.type),
                )
                : null;
            const borrowedReturnPointerInfo = borrowedReturnArgument && returnIsPointer
                ? this.borrowedPointerReturnInfo(borrowedReturnArgument)
                : null;

            return {
                ...node,
                kind: Kinds.Expressions.CallExpression,
                callee,
                arguments: args,
                argumentEffects,
                type: returnType,
                symbolId: symbol.id,
                linkageName: symbol.linkageName ?? null,
                qualifiedName: symbol.qualifiedName,
                external,
                effectSummary,
                builtinMethod: symbol.node?.builtinMethod,
                borrowedView: borrowedReturnInfo !== null,
                borrowedViewReadonly: borrowedReturnInfo
                    ? borrowedReturnInfo.borrowedViewReadonly || borrowedReturnInfo.readonly
                    : false,
                borrowedViewSourceName: borrowedReturnInfo?.sourceName ?? null,
                pointerRootName: borrowedReturnPointerInfo?.rootName ?? null,
                pointerRootSymbolId: borrowedReturnPointerInfo?.rootSymbolId,
                pointerAccessPath: borrowedReturnPointerInfo?.accessPath ?? [],
                pointerPermission: borrowedReturnPointerInfo?.permission,
            };
        }

        /**
         * Handles built-in array methods: push, pop, at.
         * Each method is validated according to its signature and constraints.
         * 
         * - push(element: T): number - mutates array, returns new length
         * - pop(): T | undefined - mutates array, returns element
         * - at(index: number): T | undefined - non-mutating, returns element
         */
        public visitBuiltinMethodCall(node: any): any {
            const rawCallee = node.callee;
            const receiver = this.visitNode(rawCallee.object);
            const receiverType = this.resolveType(receiver?.declaredType ?? receiver?.type);
            const methodName = rawCallee.property;
            const callbackMethods = new Set([
                "forEach",
                "map",
                "filter",
                "some",
                "every",
                "find",
                "findIndex",
                "findLast",
                "findLastIndex",
                "flatMap",
                "reduce",
                "reduceRight",
                "sort",
                "toSorted",
            ]);
            const args = (node.arguments ?? []).map((argument: any, index: number) => {
                if (callbackMethods.has(methodName) && index === 0 && argument?.kind === Kinds.Functions.FunctionExpression) {
                    return argument;
                }

                return this.visitNode(argument);
            });
            const source = node.fullSource ?? node.source ?? rawCallee.source;

            if (receiverType?.kind === Kinds.Types.StringType) {
                const methodHandlers: Record<string, () => any> = {
                    slice: () => this.validateAndCreateStringSliceCall(node, rawCallee, receiver, methodName, args, source),
                    substring: () => this.validateAndCreateStringSliceCall(node, rawCallee, receiver, methodName, args, source),
                    includes: () => this.validateAndCreateStringSearchCall(node, rawCallee, receiver, methodName, args, source, "boolean"),
                    startsWith: () => this.validateAndCreateStringSearchCall(node, rawCallee, receiver, methodName, args, source, "boolean"),
                    endsWith: () => this.validateAndCreateStringSearchCall(node, rawCallee, receiver, methodName, args, source, "boolean"),
                    indexOf: () => this.validateAndCreateStringSearchCall(node, rawCallee, receiver, methodName, args, source, "number"),
                    lastIndexOf: () => this.validateAndCreateStringSearchCall(node, rawCallee, receiver, methodName, args, source, "number"),
                    charAt: () => this.validateAndCreateStringIndexCall(node, rawCallee, receiver, methodName, args, source, "string"),
                    charCodeAt: () => this.validateAndCreateStringIndexCall(node, rawCallee, receiver, methodName, args, source, "number"),
                    concat: () => this.validateAndCreateStringConcatCall(node, rawCallee, receiver, methodName, args, source),
                    repeat: () => this.validateAndCreateStringRepeatCall(node, rawCallee, receiver, methodName, args, source),
                    padStart: () => this.validateAndCreateStringPadCall(node, rawCallee, receiver, methodName, args, source),
                    padEnd: () => this.validateAndCreateStringPadCall(node, rawCallee, receiver, methodName, args, source),
                    toUpperCase: () => this.validateAndCreateStringTransformCall(node, rawCallee, receiver, methodName, args, source),
                    toLowerCase: () => this.validateAndCreateStringTransformCall(node, rawCallee, receiver, methodName, args, source),
                    trim: () => this.validateAndCreateStringTransformCall(node, rawCallee, receiver, methodName, args, source),
                    trimStart: () => this.validateAndCreateStringTransformCall(node, rawCallee, receiver, methodName, args, source),
                    trimEnd: () => this.validateAndCreateStringTransformCall(node, rawCallee, receiver, methodName, args, source),
                };

                if (!methodHandlers[methodName]) {
                    const message = `string method ${Helpers.RED}'${methodName}'${Helpers.RESET} is not supported`;
                    rawCallee.arrowLength = methodName?.length ?? rawCallee.source?.length ?? 1;
                    this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
                }

                return methodHandlers[methodName]();
            }

            // Validate receiver is an array or tuple
            if (receiverType?.kind !== Kinds.Types.ArrayType && receiverType?.kind !== Kinds.Types.TupleType) {
                const message =
                    `method ${Helpers.RED}'${methodName}'${Helpers.RESET} does not exist on type ` +
                    `${Helpers.RED}'${receiverType?.raw ?? "unknown"}'${Helpers.RESET}`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            // Dispatch table for built-in array methods
            const methodHandlers: Record<string, () => any> = {
                push: () => this.validateAndCreatePushCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                pop: () => this.validateAndCreatePopCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                at: () => this.validateAndCreateAtCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                copy: () => this.validateAndCreateCopyCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                shift: () => this.validateAndCreateShiftCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                unshift: () => this.validateAndCreateUnshiftCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                includes: () => this.validateAndCreateSearchCall(node, rawCallee, receiver, receiverType, methodName, args, source, "boolean"),
                indexOf: () => this.validateAndCreateSearchCall(node, rawCallee, receiver, receiverType, methodName, args, source, "number"),
                lastIndexOf: () => this.validateAndCreateSearchCall(node, rawCallee, receiver, receiverType, methodName, args, source, "number"),
                reverse: () => this.validateAndCreateReverseCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                slice: () => this.validateAndCreateSliceCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                concat: () => this.validateAndCreateConcatCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                fill: () => this.validateAndCreateFillCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                copyWithin: () => this.validateAndCreateCopyWithinCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                splice: () => this.validateAndCreateSpliceCall(node, rawCallee, receiver, receiverType, methodName, args, source, true),
                toReversed: () => this.validateAndCreateToReversedCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                toSpliced: () => this.validateAndCreateSpliceCall(node, rawCallee, receiver, receiverType, methodName, args, source, false),
                with: () => this.validateAndCreateWithCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                join: () => this.validateAndCreateJoinCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                toString: () => this.validateAndCreateToStringCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                toLocaleString: () => this.validateAndCreateToStringCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                sort: () => this.validateAndCreateSortCall(node, rawCallee, receiver, receiverType, methodName, args, source, true),
                toSorted: () => this.validateAndCreateSortCall(node, rawCallee, receiver, receiverType, methodName, args, source, false),
                flat: () => this.validateAndCreateFlatCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                keys: () => this.validateAndCreateIteratorArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                values: () => this.validateAndCreateIteratorArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                entries: () => this.validateAndCreateIteratorArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                forEach: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                map: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                filter: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                some: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                every: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                find: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                findIndex: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                findLast: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                findLastIndex: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                flatMap: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                reduce: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
                reduceRight: () => this.validateAndCreateCallbackArrayCall(node, rawCallee, receiver, receiverType, methodName, args, source),
            };

            if (!methodHandlers[methodName]) {
                const message =
                    `array method ${Helpers.RED}'${methodName}'${Helpers.RESET} is not supported`;

                rawCallee.arrowLength = methodName?.length ?? rawCallee.source?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            return methodHandlers[methodName]();
        }

        /**
         * Validates and creates a push() call expression.
         * push(element: T): number - mutates array, returns length
         */
        public validateAndCreatePushCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            const pushRoot = this.getAggregateRootIdentifier(receiver);
            const pushSymbol = pushRoot ? this.resolveSymbol(pushRoot) : null;
            receiverType = this.resolveType(pushSymbol?.declaredType ?? receiverType);

            // Tuples have fixed length; push is not allowed
            if (receiverType?.kind === Kinds.Types.TupleType) {
                const message =
                    `tuple method ${Helpers.RED}'push'${Helpers.RESET} is not supported because tuple length is fixed`;

                rawCallee.arrowLength = rawCallee.source?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            if (receiverType?.kind === Kinds.Types.ArrayType && receiverType.fixed === true) {
                const message =
                    `cannot call size-changing method ${Helpers.RED}'push'${Helpers.RESET} on fixed-size array ` +
                    `${Helpers.BLUE}'${receiverType.raw ?? "array"}'${Helpers.RESET}`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            // Validate receiver is mutable
            const root = pushRoot;
            const symbol = pushSymbol;

            if (root && symbol?.mutable !== true) {
                const message =
                    `cannot mutate ${Helpers.RED}'${root ?? rawCallee.source}'${Helpers.RESET} because it is immutable`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            // Validate receiver is not readonly
            if (this.isReadonlyType(receiverType)) {
                const message =
                    `cannot call mutating method ${Helpers.RED}'push'${Helpers.RESET} on readonly array`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            this.assertNoLivePointerIntoDynamicContainer(root, symbol, methodName, source, rawCallee);

            // Validate argument count
            if (args.length !== 1) {
                const message =
                    `array method ${Helpers.BLUE}'push'${Helpers.RESET} expects ` +
                    `${Helpers.BLUE}'1'${Helpers.RESET} argument, got ${Helpers.RED}'${args.length}'${Helpers.RESET}`;

                node.arrowLength = node.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, node.position, source, node);
            }

            // Validate argument type matches element type
            const elementType = receiverType.elementType;
            const actualType = args[0]?.type;

            if (!this.isTypeAssignable(elementType, actualType)) {
                const message =
                    `array method ${Helpers.BLUE}'push'${Helpers.RESET} expects ` +
                    `${Helpers.BLUE}'${elementType?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                    `${Helpers.RED}'${actualType?.raw ?? "unknown"}'${Helpers.RESET}`;

                args[0].arrowLength = args[0].source?.length ?? 1;
                this.throwError(message, args[0].position ?? node.position, source, args[0]);
            }

            return {
                ...node,
                kind: Kinds.Expressions.CallExpression,
                callee: {
                    ...rawCallee,
                    object: receiver,
                    type: {
                        kind: Kinds.Types.FunctionType,
                        raw: "Function",
                    },
                },
                arguments: args,
                argumentEffects: [
                    {
                        index: 0,
                        escapes: false,
                        mutates: true,
                        consumes: false,
                    },
                ],
                type: {
                    kind: Kinds.Types.NumberType,
                    raw: "number",
                },
                external: false,
                builtinMethod: "array.push",
            };
        }

        /**
         * Validates and creates a pop() call expression.
         * pop(): T | undefined - mutates array, returns element
         */
        public validateAndCreatePopCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            const popRoot = this.getAggregateRootIdentifier(receiver);
            const popSymbol = popRoot ? this.resolveSymbol(popRoot) : null;
            receiverType = this.resolveType(popSymbol?.declaredType ?? receiverType);

            // Tuples have fixed length; pop is not allowed
            if (receiverType?.kind === Kinds.Types.TupleType) {
                const message =
                    `tuple method ${Helpers.RED}'pop'${Helpers.RESET} is not supported because tuple length is fixed`;

                rawCallee.arrowLength = rawCallee.source?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            if (receiverType?.kind === Kinds.Types.ArrayType && receiverType.fixed === true) {
                const message =
                    `cannot call size-changing method ${Helpers.RED}'pop'${Helpers.RESET} on fixed-size array ` +
                    `${Helpers.BLUE}'${receiverType.raw ?? "array"}'${Helpers.RESET}`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            // Validate receiver is mutable
            const root = popRoot;
            const symbol = popSymbol;

            if (root && symbol?.mutable !== true) {
                const message =
                    `cannot mutate ${Helpers.RED}'${root ?? rawCallee.source}'${Helpers.RESET} because it is immutable`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            // Validate receiver is not readonly
            if (this.isReadonlyType(receiverType)) {
                const message =
                    `cannot call mutating method ${Helpers.RED}'pop'${Helpers.RESET} on readonly array`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            this.assertNoLivePointerIntoDynamicContainer(root, symbol, methodName, source, rawCallee);

            // pop() takes no arguments
            if (args.length !== 0) {
                const message =
                    `array method ${Helpers.BLUE}'pop'${Helpers.RESET} expects ` +
                    `${Helpers.BLUE}'0'${Helpers.RESET} arguments, got ${Helpers.RED}'${args.length}'${Helpers.RESET}`;

                node.arrowLength = node.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, node.position, source, node);
            }

            // pop() returns T | undefined
            const elementType = receiverType.elementType;
            const returnType = {
                kind: Kinds.Types.UnionType,
                types: [elementType, { kind: Kinds.Types.UndefinedType, raw: "undefined" }],
                raw: `${elementType?.raw ?? "unknown"} | undefined`,
            };

            return {
                ...node,
                kind: Kinds.Expressions.CallExpression,
                callee: {
                    ...rawCallee,
                    object: receiver,
                    type: {
                        kind: Kinds.Types.FunctionType,
                        raw: "Function",
                    },
                },
                arguments: args,
                argumentEffects: [],
                type: returnType,
                external: false,
                builtinMethod: "array.pop",
            };
        }

        /**
         * Validates and creates an at() call expression.
         * at(index: number): T | undefined - non-mutating, returns element
         */
        public validateAndCreateAtCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            // at() takes exactly one argument (index)
            if (args.length !== 1) {
                const message =
                    `array method ${Helpers.BLUE}'at'${Helpers.RESET} expects ` +
                    `${Helpers.BLUE}'1'${Helpers.RESET} argument, got ${Helpers.RED}'${args.length}'${Helpers.RESET}`;

                node.arrowLength = node.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, node.position, source, node);
            }

            // Validate index argument is a number
            const indexType = args[0]?.type;
            if (this.resolveType(indexType)?.kind !== Kinds.Types.NumberType) {
                const message =
                    `array method ${Helpers.BLUE}'at'${Helpers.RESET} expects ` +
                    `${Helpers.BLUE}'number'${Helpers.RESET} index, got ` +
                    `${Helpers.RED}'${indexType?.raw ?? "unknown"}'${Helpers.RESET}`;

                args[0].arrowLength = args[0].source?.length ?? 1;
                this.throwError(message, args[0].position ?? node.position, source, args[0]);
            }

            const returnType = this.arrayAtReturnType(receiver, receiverType, args[0]);

            return {
                ...node,
                kind: Kinds.Expressions.CallExpression,
                callee: {
                    ...rawCallee,
                    object: receiver,
                    type: {
                        kind: Kinds.Types.FunctionType,
                        raw: "Function",
                    },
                },
                arguments: args,
                argumentEffects: [],
                type: returnType,
                external: false,
                builtinMethod: "array.at",
            };
        }

        public arrayAtReturnType(receiver: any, receiverType: any, index: any): any {
            const fallback = this.arrayElementOrUndefinedType(receiverType);
            const indexValue = this.literalIndexValue(index);

            if (typeof indexValue !== "number" || !Number.isInteger(indexValue)) {
                return fallback;
            }

            if (receiverType?.kind === Kinds.Types.TupleType) {
                const elements = receiverType.elements ?? [];
                const normalized = indexValue < 0 ? elements.length + indexValue : indexValue;

                if (normalized >= 0 && normalized < elements.length) {
                    return elements[normalized];
                }

                return fallback;
            }

            const literalLength = this.arrayLiteralLength(receiver);
            if (literalLength === null) {
                return fallback;
            }

            const normalized = indexValue < 0 ? literalLength + indexValue : indexValue;
            if (normalized >= 0 && normalized < literalLength) {
                return this.arrayReadableElementType(receiverType);
            }

            return fallback;
        }

        public arrayLiteralLength(receiver: any): number | null {
            if (!receiver) {
                return null;
            }

            if (receiver.kind === Kinds.Collections.ArrayExpression) {
                return receiver.elements?.length ?? 0;
            }

            const root = this.getAggregateRootIdentifier(receiver);
            const symbol = root ? this.resolveSymbol(root) : null;
            const node = symbol?.node;

            if (node?.kind === Kinds.Collections.ArrayExpression) {
                return node.elements?.length ?? 0;
            }

            return null;
        }

        public arrayReadableElementType(receiverType: any): any {
            if (receiverType?.kind === Kinds.Types.ArrayType) {
                return receiverType.elementType;
            }

            if (receiverType?.kind === Kinds.Types.TupleType) {
                return this.createUnionType(receiverType.elements ?? []);
            }

            return { kind: Kinds.Types.UnknownType, raw: "unknown" };
        }

        public arrayReturnType(receiverType: any): any {
            const elementType = this.arrayReadableElementType(receiverType);

            return {
                kind: Kinds.Types.ArrayType,
                raw: `${elementType?.raw ?? "unknown"}[]`,
                elementType,
                readonly: false,
            };
        }

        public arrayElementOrUndefinedType(receiverType: any): any {
            const elementType = this.arrayReadableElementType(receiverType);

            return {
                kind: Kinds.Types.UnionType,
                types: [elementType, { kind: Kinds.Types.UndefinedType, raw: "undefined" }],
                raw: `${elementType?.raw ?? "unknown"} | undefined`,
            };
        }

        public validateArrayMethodArgumentCount(node: any, methodName: string, args: any[], source: string, min: number, max: number): void {
            if (args.length >= min && args.length <= max) {
                return;
            }

            const expected = min === max ? `${min}` : `${min}-${max}`;
            const noun = min === max && min === 1 ? "argument" : "arguments";
            const message =
                `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} expects ` +
                `${Helpers.BLUE}'${expected}'${Helpers.RESET} ${noun}, got ${Helpers.RED}'${args.length}'${Helpers.RESET}`;

            node.arrowLength = node.source?.length ?? methodName?.length ?? 1;
            this.throwError(message, node.position, source, node);
        }

        public validateNumberArrayMethodArgument(node: any, methodName: string, argument: any, source: string, label: string): void {
            const argumentType = argument?.type;

            if (this.resolveType(argumentType)?.kind === Kinds.Types.NumberType) {
                return;
            }

            const message =
                `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} expects ` +
                `${Helpers.BLUE}'number'${Helpers.RESET} ${label}, got ` +
                `${Helpers.RED}'${argumentType?.raw ?? "unknown"}'${Helpers.RESET}`;

            argument.arrowLength = argument.source?.length ?? 1;
            this.throwError(message, argument.position ?? node.position, source, argument);
        }

        public validateMutableArrayReceiver(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, source: string): void {
            if (receiverType?.kind === Kinds.Types.TupleType) {
                const message =
                    `tuple method ${Helpers.RED}'${methodName}'${Helpers.RESET} is not supported because tuple length is fixed`;

                rawCallee.arrowLength = rawCallee.source?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            const sizeChangingMethods = new Set(["push", "pop", "shift", "unshift", "splice"]);
            if (
                receiverType?.kind === Kinds.Types.ArrayType &&
                receiverType.fixed === true &&
                sizeChangingMethods.has(methodName)
            ) {
                const message =
                    `cannot call size-changing method ${Helpers.RED}'${methodName}'${Helpers.RESET} on fixed-size array ` +
                    `${Helpers.BLUE}'${receiverType.raw ?? "array"}'${Helpers.RESET}`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            const root = this.getAggregateRootIdentifier(receiver);
            const symbol = root ? this.resolveSymbol(root) : null;
            const readonlyInfo = this.borrowedArrayReadonlyInfo(receiver, receiverType);

            if (root && symbol?.mutable !== true) {
                const message =
                    `cannot mutate ${Helpers.RED}'${root ?? rawCallee.source}'${Helpers.RESET} because it is immutable`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            if (readonlyInfo.borrowedViewReadonly) {
                this.throwReadonlyBorrowedViewMutationError(receiver, rawCallee, source, root, readonlyInfo.sourceName);
            }

            if (this.isReadonlyType(receiverType)) {
                const message =
                    `cannot call mutating method ${Helpers.RED}'${methodName}'${Helpers.RESET} on readonly array`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            const structuralArrayMethods = new Set(["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "resize", "clear"]);
            if (structuralArrayMethods.has(methodName)) {
                this.assertNoLivePointerIntoDynamicContainer(root, symbol, methodName, source, rawCallee);
            }
        }

        public createArrayBuiltinCall(node: any, rawCallee: any, receiver: any, args: any[], type: any, methodName: string, argumentEffects: any[] = []): any {
            return {
                ...node,
                kind: Kinds.Expressions.CallExpression,
                callee: {
                    ...rawCallee,
                    object: receiver,
                    type: {
                        kind: Kinds.Types.FunctionType,
                        raw: "Function",
                    },
                },
                arguments: args,
                argumentEffects,
                type,
                external: false,
                builtinMethod: `array.${methodName}`,
            };
        }

        public createStringBuiltinCall(node: any, rawCallee: any, receiver: any, args: any[], type: any, methodName: string): any {
            return {
                ...node,
                kind: Kinds.Expressions.CallExpression,
                callee: {
                    ...rawCallee,
                    object: receiver,
                    type: {
                        kind: Kinds.Types.FunctionType,
                        raw: "Function",
                    },
                },
                arguments: args,
                argumentEffects: [],
                type,
                external: false,
                builtinMethod: `string.${methodName}`,
            };
        }

        public validateStringMethodArgumentCount(node: any, methodName: string, args: any[], source: string, min: number, max: number): void {
            if (args.length >= min && args.length <= max) {
                return;
            }

            const expected = min === max ? `${min}` : `${min}-${max}`;
            const noun = min === max && min === 1 ? "argument" : "arguments";
            const message =
                `string method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} expects ` +
                `${Helpers.BLUE}'${expected}'${Helpers.RESET} ${noun}, got ${Helpers.RED}'${args.length}'${Helpers.RESET}`;

            node.arrowLength = node.source?.length ?? methodName?.length ?? 1;
            this.throwError(message, node.position, source, node);
        }

        public validateStringMethodNumberArgument(node: any, methodName: string, argument: any, source: string, label: string): void {
            const argumentType = argument?.type;

            if (this.resolveType(argumentType)?.kind === Kinds.Types.NumberType) {
                return;
            }

            const message =
                `string method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} expects ` +
                `${Helpers.BLUE}'number'${Helpers.RESET} ${label}, got ` +
                `${Helpers.RED}'${argumentType?.raw ?? "unknown"}'${Helpers.RESET}`;

            argument.arrowLength = argument.source?.length ?? 1;
            this.throwError(message, argument.position ?? node.position, source, argument);
        }

        public validateStringMethodStringArgument(node: any, methodName: string, argument: any, source: string, label: string): void {
            const argumentType = argument?.type;

            if (this.resolveType(argumentType)?.kind === Kinds.Types.StringType) {
                return;
            }

            const message =
                `string method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} expects ` +
                `${Helpers.BLUE}'string'${Helpers.RESET} ${label}, got ` +
                `${Helpers.RED}'${argumentType?.raw ?? "unknown"}'${Helpers.RESET}`;

            argument.arrowLength = argument.source?.length ?? 1;
            this.throwError(message, argument.position ?? node.position, source, argument);
        }

        public validateAndCreateStringSliceCall(node: any, rawCallee: any, receiver: any, methodName: string, args: any[], source: string): any {
            this.validateStringMethodArgumentCount(node, methodName, args, source, 0, 2);

            args.forEach((argument: any) => {
                this.validateStringMethodNumberArgument(node, methodName, argument, source, "index");
            });

            return this.createStringBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                { kind: Kinds.Types.StringType, raw: "string" },
                methodName,
            );
        }

        public validateAndCreateStringSearchCall(
            node: any,
            rawCallee: any,
            receiver: any,
            methodName: string,
            args: any[],
            source: string,
            returnKind: "boolean" | "number",
        ): any {
            this.validateStringMethodArgumentCount(node, methodName, args, source, 1, 2);
            this.validateStringMethodStringArgument(node, methodName, args[0], source, "search value");

            if (args[1]) {
                this.validateStringMethodNumberArgument(node, methodName, args[1], source, "position");
            }

            return this.createStringBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                returnKind === "boolean"
                    ? { kind: Kinds.Types.BooleanType, raw: "boolean" }
                    : { kind: Kinds.Types.NumberType, raw: "number" },
                methodName,
            );
        }

        public validateAndCreateStringIndexCall(
            node: any,
            rawCallee: any,
            receiver: any,
            methodName: string,
            args: any[],
            source: string,
            returnKind: "string" | "number",
        ): any {
            this.validateStringMethodArgumentCount(node, methodName, args, source, 0, 1);

            if (args[0]) {
                this.validateStringMethodNumberArgument(node, methodName, args[0], source, "index");
            }

            return this.createStringBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                returnKind === "string"
                    ? { kind: Kinds.Types.StringType, raw: "string" }
                    : { kind: Kinds.Types.NumberType, raw: "number" },
                methodName,
            );
        }

        public validateAndCreateStringConcatCall(node: any, rawCallee: any, receiver: any, methodName: string, args: any[], source: string): any {
            args.forEach((argument: any) => {
                this.validateStringMethodStringArgument(node, methodName, argument, source, "argument");
            });

            return this.createStringBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                { kind: Kinds.Types.StringType, raw: "string" },
                methodName,
            );
        }

        public validateAndCreateStringRepeatCall(node: any, rawCallee: any, receiver: any, methodName: string, args: any[], source: string): any {
            this.validateStringMethodArgumentCount(node, methodName, args, source, 1, 1);
            this.validateStringMethodNumberArgument(node, methodName, args[0], source, "count");

            return this.createStringBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                { kind: Kinds.Types.StringType, raw: "string" },
                methodName,
            );
        }

        public validateAndCreateStringPadCall(node: any, rawCallee: any, receiver: any, methodName: string, args: any[], source: string): any {
            this.validateStringMethodArgumentCount(node, methodName, args, source, 1, 2);
            this.validateStringMethodNumberArgument(node, methodName, args[0], source, "target length");

            if (args[1]) {
                this.validateStringMethodStringArgument(node, methodName, args[1], source, "pad string");
            }

            return this.createStringBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                { kind: Kinds.Types.StringType, raw: "string" },
                methodName,
            );
        }

        public validateAndCreateStringTransformCall(node: any, rawCallee: any, receiver: any, methodName: string, args: any[], source: string): any {
            this.validateStringMethodArgumentCount(node, methodName, args, source, 0, 0);

            return this.createStringBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                { kind: Kinds.Types.StringType, raw: "string" },
                methodName,
            );
        }

        public validateAndCreateShiftCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateMutableArrayReceiver(node, rawCallee, receiver, receiverType, methodName, source);
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 0, 0);

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                this.arrayElementOrUndefinedType(receiverType),
                methodName,
            );
        }

        public validateAndCreateUnshiftCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateMutableArrayReceiver(node, rawCallee, receiver, receiverType, methodName, source);

            const elementType = this.arrayReadableElementType(receiverType);

            args.forEach((argument: any) => {
                const actualType = argument?.type;

                if (!this.isTypeAssignable(elementType, actualType)) {
                    const message =
                        `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} expects ` +
                        `${Helpers.BLUE}'${elementType?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                        `${Helpers.RED}'${actualType?.raw ?? "unknown"}'${Helpers.RESET}`;

                    argument.arrowLength = argument.source?.length ?? 1;
                    this.throwError(message, argument.position ?? node.position, source, argument);
                }
            });

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                { kind: Kinds.Types.NumberType, raw: "number" },
                methodName,
                args.map((_: any, index: number) => ({
                    index,
                    escapes: false,
                    mutates: true,
                    consumes: false,
                })),
            );
        }

        public validateAndCreateSearchCall(
            node: any,
            rawCallee: any,
            receiver: any,
            receiverType: any,
            methodName: string,
            args: any[],
            source: string,
            returnKind: "boolean" | "number",
        ): any {
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 1, 2);

            const elementType = this.arrayReadableElementType(receiverType);
            const searchType = args[0]?.type;

            if (!this.isTypeAssignable(elementType, searchType)) {
                const message =
                    `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} expects ` +
                    `${Helpers.BLUE}'${elementType?.raw ?? "unknown"}'${Helpers.RESET} search value, got ` +
                    `${Helpers.RED}'${searchType?.raw ?? "unknown"}'${Helpers.RESET}`;

                args[0].arrowLength = args[0].source?.length ?? 1;
                this.throwError(message, args[0].position ?? node.position, source, args[0]);
            }

            if (args[1]) {
                this.validateNumberArrayMethodArgument(node, methodName, args[1], source, "fromIndex");
            }

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                returnKind === "boolean"
                    ? { kind: Kinds.Types.BooleanType, raw: "boolean" }
                    : { kind: Kinds.Types.NumberType, raw: "number" },
                methodName,
            );
        }

        public validateAndCreateReverseCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateMutableArrayReceiver(node, rawCallee, receiver, receiverType, methodName, source);
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 0, 0);

            return this.createArrayBuiltinCall(node, rawCallee, receiver, args, receiverType, methodName);
        }

        public validateAndCreateSliceCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 0, 2);

            args.forEach((argument: any) => {
                this.validateNumberArrayMethodArgument(node, methodName, argument, source, "index");
            });

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                this.arrayReturnType(receiverType),
                methodName,
            );
        }

        public validateAndCreateCopyCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 0, 0);

            if (receiverType?.kind !== Kinds.Types.ArrayType) {
                const message =
                    `array method ${Helpers.BLUE}'copy'${Helpers.RESET} is only supported on arrays`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                {
                    ...receiverType,
                    readonly: false,
                },
                methodName,
            );
        }

        public validateArrayElementValue(node: any, methodName: string, argument: any, elementType: any, source: string, label = "value"): void {
            const actualType = argument?.type;

            if (this.isTypeAssignable(elementType, actualType)) {
                return;
            }

            const message =
                `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} expects ` +
                `${Helpers.BLUE}'${elementType?.raw ?? "unknown"}'${Helpers.RESET} ${label}, got ` +
                `${Helpers.RED}'${actualType?.raw ?? "unknown"}'${Helpers.RESET}`;

            argument.arrowLength = argument.source?.length ?? 1;
            this.throwError(message, argument.position ?? node.position, source, argument);
        }

        public validateConcatArgument(node: any, methodName: string, argument: any, elementType: any, source: string): void {
            const actualType = this.resolveType(argument?.type);

            if (actualType?.kind === Kinds.Types.ArrayType) {
                if (this.isTypeAssignable(elementType, actualType.elementType)) {
                    return;
                }
            } else if (actualType?.kind === Kinds.Types.TupleType) {
                const compatible = (actualType.elements ?? []).every((item: any) => {
                    return this.isTypeAssignable(elementType, item);
                });

                if (compatible) {
                    return;
                }
            } else if (this.isTypeAssignable(elementType, actualType)) {
                return;
            }

            const message =
                `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} expects ` +
                `${Helpers.BLUE}'${elementType?.raw ?? "unknown"}'${Helpers.RESET} values or arrays, got ` +
                `${Helpers.RED}'${actualType?.raw ?? "unknown"}'${Helpers.RESET}`;

            argument.arrowLength = argument.source?.length ?? 1;
            this.throwError(message, argument.position ?? node.position, source, argument);
        }

        public validateAndCreateConcatCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            const elementType = this.arrayReadableElementType(receiverType);

            args.forEach((argument: any) => {
                this.validateConcatArgument(node, methodName, argument, elementType, source);
            });

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                this.arrayReturnType(receiverType),
                methodName,
            );
        }

        public validateAndCreateFillCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateMutableArrayReceiver(node, rawCallee, receiver, receiverType, methodName, source);
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 1, 3);
            this.validateArrayElementValue(node, methodName, args[0], this.arrayReadableElementType(receiverType), source);

            if (args[1]) {
                this.validateNumberArrayMethodArgument(node, methodName, args[1], source, "start");
            }

            if (args[2]) {
                this.validateNumberArrayMethodArgument(node, methodName, args[2], source, "end");
            }

            return this.createArrayBuiltinCall(node, rawCallee, receiver, args, receiverType, methodName);
        }

        public validateAndCreateCopyWithinCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateMutableArrayReceiver(node, rawCallee, receiver, receiverType, methodName, source);
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 2, 3);

            args.forEach((argument: any) => {
                this.validateNumberArrayMethodArgument(node, methodName, argument, source, "index");
            });

            return this.createArrayBuiltinCall(node, rawCallee, receiver, args, receiverType, methodName);
        }

        public validateAndCreateSpliceCall(
            node: any,
            rawCallee: any,
            receiver: any,
            receiverType: any,
            methodName: string,
            args: any[],
            source: string,
            mutating: boolean,
        ): any {
            if (mutating) {
                this.validateMutableArrayReceiver(node, rawCallee, receiver, receiverType, methodName, source);
            }

            this.validateArrayMethodArgumentCount(node, methodName, args, source, 1, Number.MAX_SAFE_INTEGER);
            this.validateNumberArrayMethodArgument(node, methodName, args[0], source, "start");

            if (args[1]) {
                this.validateNumberArrayMethodArgument(node, methodName, args[1], source, "deleteCount");
            }

            const elementType = this.arrayReadableElementType(receiverType);
            args.slice(2).forEach((argument: any) => {
                this.validateArrayElementValue(node, methodName, argument, elementType, source, "insert value");
            });

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                this.arrayReturnType(receiverType),
                methodName,
                mutating
                    ? [{
                        index: 0,
                        escapes: false,
                        mutates: true,
                        consumes: false,
                    }]
                    : [],
            );
        }

        public validateAndCreateToReversedCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 0, 0);

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                this.arrayReturnType(receiverType),
                methodName,
            );
        }

        public validateAndCreateJoinCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 0, 1);

            if (args[0] && this.resolveType(args[0].type)?.kind !== Kinds.Types.StringType) {
                const message =
                    `array method ${Helpers.BLUE}'join'${Helpers.RESET} separator must be ` +
                    `${Helpers.BLUE}'string'${Helpers.RESET}`;

                args[0].arrowLength = args[0].source?.length ?? 1;
                this.throwError(message, args[0].position ?? node.position, source, args[0]);
            }

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                { kind: Kinds.Types.StringType, raw: "string" },
                methodName,
            );
        }

        public validateAndCreateToStringCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 0, 0);

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                { kind: Kinds.Types.StringType, raw: "string" },
                methodName,
            );
        }

        public validateAndCreateSortCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string, mutating: boolean): any {
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 0, 1);

            if (mutating) {
                this.validateMutableArrayReceiver(node, rawCallee, receiver, receiverType, methodName, source);
            }

            if (args[0]) {
                const callback = args[0];
                if (callback?.kind !== Kinds.Expressions.IdentifierExpression && callback?.kind !== Kinds.Functions.FunctionExpression) {
                    const message = `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} compare function must be callable`;
                    callback.arrowLength = callback?.source?.length ?? 1;
                    this.throwError(message, callback?.position ?? node.position, source, callback ?? node);
                }

                const elementType = this.arrayReadableElementType(receiverType);
                const semanticCallback = callback.kind === Kinds.Functions.FunctionExpression
                    ? this.visitInlineCallbackFunctionExpression(node, methodName, callback, elementType, source)
                    : callback;
                const callbackName = semanticCallback.callbackName ?? semanticCallback.value ?? semanticCallback.name ?? semanticCallback.raw;
                const symbol = semanticCallback.kind === Kinds.Expressions.IdentifierExpression
                    ? this.resolveSymbol(callbackName)
                    : null;

                if (semanticCallback.kind === Kinds.Expressions.IdentifierExpression && (!symbol || symbol.kind !== Kinds.ScopeSymbols.Function)) {
                    const message = `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} compare function is not callable`;
                    semanticCallback.arrowLength = callbackName?.length ?? 1;
                    this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
                }

                const params = semanticCallback.kind === Kinds.Functions.FunctionExpression
                    ? semanticCallback.params ?? []
                    : symbol.node?.params ?? [];

                if (params.length !== 2 || !this.isTypeAssignable(params[0]?.type, elementType) || !this.isTypeAssignable(params[1]?.type, elementType)) {
                    const message = `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} compare function must accept two ${Helpers.BLUE}'${elementType?.raw ?? "unknown"}'${Helpers.RESET} values`;
                    semanticCallback.arrowLength = callbackName?.length ?? 1;
                    this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
                }

                const callbackReturnType = this.toSerializableType(semanticCallback.returnType ?? symbol?.node?.returnType ?? {
                    kind: Kinds.Types.UnknownType,
                    raw: "unknown",
                });

                if (this.resolveType(callbackReturnType)?.kind !== Kinds.Types.NumberType) {
                    const message = `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} compare function must return ${Helpers.BLUE}'number'${Helpers.RESET}`;
                    semanticCallback.arrowLength = callbackName?.length ?? 1;
                    this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
                }

                args = [semanticCallback];
            }

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                this.arrayReturnType(receiverType),
                methodName,
            );
        }

        public validateAndCreateFlatCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 0, 1);

            if (args[0] && this.resolveType(args[0].type)?.kind !== Kinds.Types.NumberType) {
                const message = `array method ${Helpers.BLUE}'flat'${Helpers.RESET} depth must be ${Helpers.BLUE}'number'${Helpers.RESET}`;
                args[0].arrowLength = args[0].source?.length ?? 1;
                this.throwError(message, args[0].position ?? node.position, source, args[0]);
            }

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                this.flatReturnTypeByDepth(receiverType, args[0], node, source),
                methodName,
            );
        }

        public flatReturnTypeByDepth(receiverType: any, depthArgument: any, node: any, source: string): any {
            const literalDepth = depthArgument
                ? this.knownFlatDepthLiteral(depthArgument, node, source)
                : 1;

            const depth = literalDepth ?? 1;
            let flattenedType = receiverType;

            for (let index = 0; index < depth; index++) {
                const readable = this.arrayReadableElementType(flattenedType);
                const resolvedReadable = this.resolveType(readable);

                if (
                    resolvedReadable?.kind !== Kinds.Types.ArrayType &&
                    resolvedReadable?.kind !== Kinds.Types.TupleType
                ) {
                    flattenedType = {
                        kind: Kinds.Types.ArrayType,
                        raw: `${readable?.raw ?? "unknown"}[]`,
                        elementType: readable,
                        readonly: false,
                    };
                    break;
                }

                flattenedType = {
                    kind: Kinds.Types.ArrayType,
                    raw: `${this.arrayReadableElementType(resolvedReadable)?.raw ?? "unknown"}[]`,
                    elementType: this.arrayReadableElementType(resolvedReadable),
                    readonly: false,
                };
            }

            return this.toSerializableType(flattenedType);
        }

        public knownFlatDepthLiteral(depthArgument: any, node: any, source: string): number | null {
            if (depthArgument?.kind !== Kinds.Sir.NumberConstant) {
                return null;
            }

            const value = Number(depthArgument.value);

            if (!Number.isInteger(value) || value < 0) {
                const message =
                    `array method ${Helpers.BLUE}'flat'${Helpers.RESET} depth must be a ` +
                    `${Helpers.BLUE}'non-negative integer'${Helpers.RESET}`;

                depthArgument.arrowLength = depthArgument.source?.length ?? 1;
                this.throwError(message, depthArgument.position ?? node.position, source, depthArgument);
            }

            return value;
        }

        public validateAndCreateIteratorArrayCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 0, 0);

            const elementType = this.arrayReadableElementType(receiverType);
            const numberType = { kind: Kinds.Types.NumberType, raw: "number" };
            let returnType: any = { kind: Kinds.Types.ArrayType, raw: "number[]", elementType: numberType, readonly: false };

            if (methodName === "values") {
                returnType = this.arrayReturnType(receiverType);
            } else if (methodName === "entries") {
                const entryType = {
                    kind: Kinds.Types.TupleType,
                    raw: `[number, ${elementType?.raw ?? "unknown"}]`,
                    elements: [numberType, elementType],
                };
                returnType = {
                    kind: Kinds.Types.ArrayType,
                    raw: `${entryType.raw}[]`,
                    elementType: entryType,
                    readonly: false,
                };
            }

            return this.createArrayBuiltinCall(node, rawCallee, receiver, args, returnType, methodName);
        }

        public validateAndCreateWithCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 2, 2);
            this.validateNumberArrayMethodArgument(node, methodName, args[0], source, "index");
            this.validateArrayElementValue(node, methodName, args[1], this.arrayReadableElementType(receiverType), source, "replacement value");

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                args,
                this.arrayReturnType(receiverType),
                methodName,
            );
        }

        public validateAndCreateCallbackArrayCall(node: any, rawCallee: any, receiver: any, receiverType: any, methodName: string, args: any[], source: string): any {
            const isReduce = methodName === "reduce" || methodName === "reduceRight";
            this.validateArrayMethodArgumentCount(node, methodName, args, source, 1, isReduce ? 2 : 1);

            const callback = args[0];
            const elementType = this.arrayReadableElementType(receiverType);
            const semanticCallback = callback?.kind === Kinds.Functions.FunctionExpression
                ? this.visitInlineCallbackFunctionExpression(node, methodName, callback, elementType, source)
                : callback;

            if (
                semanticCallback?.kind !== Kinds.Expressions.IdentifierExpression &&
                semanticCallback?.kind !== Kinds.Functions.FunctionExpression
            ) {
                const message =
                    `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} currently expects a named callback function`;

                semanticCallback.arrowLength = semanticCallback?.source?.length ?? 1;
                this.throwError(message, semanticCallback?.position ?? node.position, source, semanticCallback ?? node);
            }

            const callbackName = semanticCallback.callbackName ?? semanticCallback.value ?? semanticCallback.name ?? semanticCallback.raw;
            const symbol = semanticCallback.kind === Kinds.Expressions.IdentifierExpression
                ? this.resolveSymbol(callbackName)
                : null;

            if (semanticCallback.kind === Kinds.Expressions.IdentifierExpression && (!symbol || symbol.kind !== Kinds.ScopeSymbols.Function)) {
                const message =
                    `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} callback ` +
                    `${Helpers.RED}'${callbackName}'${Helpers.RESET} is not a function`;

                semanticCallback.arrowLength = callbackName?.length ?? 1;
                this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
            }

            const params = semanticCallback.kind === Kinds.Functions.FunctionExpression
                ? semanticCallback.params ?? []
                : symbol.node?.params ?? [];
            const minParams = isReduce ? 2 : 1;
            const maxParams = isReduce ? 3 : 2;

            if (params.length < minParams || params.length > maxParams) {
                const message =
                    `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} callback ` +
                    `${Helpers.BLUE}'${callbackName}'${Helpers.RESET} has an unsupported parameter list`;

                semanticCallback.arrowLength = callbackName?.length ?? 1;
                this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
            }

            const valueParamType = isReduce ? params[1]?.type : params[0]?.type;

            if (!this.isTypeAssignable(valueParamType, elementType)) {
                const message =
                    `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} callback value parameter must accept ` +
                    `${Helpers.BLUE}'${elementType?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                    `${Helpers.RED}'${valueParamType?.raw ?? "unknown"}'${Helpers.RESET}`;

                semanticCallback.arrowLength = callbackName?.length ?? 1;
                this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
            }

            const indexParam = isReduce ? params[2] : params[1];

            if (indexParam && this.resolveType(indexParam.type)?.kind !== Kinds.Types.NumberType) {
                const message =
                    `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} callback index parameter must be ` +
                    `${Helpers.BLUE}'number'${Helpers.RESET}`;

                semanticCallback.arrowLength = callbackName?.length ?? 1;
                this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
            }

            const callbackReturnType = this.toSerializableType(semanticCallback.returnType ?? symbol?.node?.returnType ?? {
                kind: Kinds.Types.UnknownType,
                raw: "unknown",
            });
            const booleanType = { kind: Kinds.Types.BooleanType, raw: "boolean" };
            const numberType = { kind: Kinds.Types.NumberType, raw: "number" };
            let returnType: any = { kind: Kinds.Types.VoidType, raw: "void" };

            if (isReduce) {
                const accumulatorType = args[1]?.type ?? elementType;
                const accumulatorParamType = params[0]?.type;

                if (!this.isTypeAssignable(accumulatorParamType, accumulatorType)) {
                    const message =
                        `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} accumulator parameter must accept ` +
                        `${Helpers.BLUE}'${accumulatorType?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                        `${Helpers.RED}'${accumulatorParamType?.raw ?? "unknown"}'${Helpers.RESET}`;

                    semanticCallback.arrowLength = callbackName?.length ?? 1;
                    this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
                }

                if (!this.isTypeAssignable(accumulatorType, callbackReturnType)) {
                    const message =
                        `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} callback must return ` +
                        `${Helpers.BLUE}'${accumulatorType?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                        `${Helpers.RED}'${callbackReturnType?.raw ?? "unknown"}'${Helpers.RESET}`;

                    semanticCallback.arrowLength = callbackName?.length ?? 1;
                    this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
                }

                returnType = accumulatorType;
            } else
            if (methodName === "map") {
                if (callbackReturnType?.kind === Kinds.Types.VoidType) {
                    const message =
                        `array method ${Helpers.BLUE}'map'${Helpers.RESET} callback must return a value`;

                    semanticCallback.arrowLength = callbackName?.length ?? 1;
                    this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
                }

                returnType = {
                    kind: Kinds.Types.ArrayType,
                    raw: `${callbackReturnType?.raw ?? "unknown"}[]`,
                    elementType: callbackReturnType,
                    readonly: false,
                };
            } else if (methodName === "flatMap") {
                const resolvedReturn = this.resolveType(callbackReturnType);

                if (resolvedReturn?.kind !== Kinds.Types.ArrayType && resolvedReturn?.kind !== Kinds.Types.TupleType) {
                    const message =
                        `array method ${Helpers.BLUE}'flatMap'${Helpers.RESET} callback must return an array`;

                    semanticCallback.arrowLength = callbackName?.length ?? 1;
                    this.throwError(message, semanticCallback.position ?? node.position, source, semanticCallback);
                }

                const mappedElementType = this.arrayReadableElementType(resolvedReturn);
                returnType = {
                    kind: Kinds.Types.ArrayType,
                    raw: `${mappedElementType?.raw ?? "unknown"}[]`,
                    elementType: mappedElementType,
                    readonly: false,
                };
            } else if (methodName === "filter") {
                this.validateCallbackBooleanReturn(node, methodName, callback, callbackName, callbackReturnType, source);
                returnType = this.arrayReturnType(receiverType);
            } else if (methodName === "some" || methodName === "every") {
                this.validateCallbackBooleanReturn(node, methodName, callback, callbackName, callbackReturnType, source);
                returnType = booleanType;
            } else if (methodName === "find" || methodName === "findLast") {
                this.validateCallbackBooleanReturn(node, methodName, callback, callbackName, callbackReturnType, source);
                returnType = this.arrayElementOrUndefinedType(receiverType);
            } else if (methodName === "findIndex" || methodName === "findLastIndex") {
                this.validateCallbackBooleanReturn(node, methodName, callback, callbackName, callbackReturnType, source);
                returnType = numberType;
            } else if (methodName === "forEach") {
                returnType = { kind: Kinds.Types.VoidType, raw: "void" };
            }

            return this.createArrayBuiltinCall(
                node,
                rawCallee,
                receiver,
                [semanticCallback, ...args.slice(1)],
                returnType,
                methodName,
            );
        }

        public validateCallbackBooleanReturn(node: any, methodName: string, callback: any, callbackName: string, callbackReturnType: any, source: string): void {
            if (this.resolveType(callbackReturnType)?.kind === Kinds.Types.BooleanType) {
                return;
            }

            const message =
                `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} callback ` +
                `${Helpers.BLUE}'${callbackName}'${Helpers.RESET} must return ${Helpers.BLUE}'boolean'${Helpers.RESET}, got ` +
                `${Helpers.RED}'${callbackReturnType?.raw ?? "unknown"}'${Helpers.RESET}`;

            callback.arrowLength = callbackName?.length ?? 1;
            this.throwError(message, callback.position ?? node.position, source, callback);
        }

        public visitInlineCallbackFunctionExpression(callNode: any, methodName: string, callback: any, elementType: any, source: string): any {
            if (!callback.returnType || callback.returnType.kind === Kinds.Types.UnTyped) {
                const message =
                    `array method ${Helpers.BLUE}'${methodName}'${Helpers.RESET} inline callback must have an explicit return type`;

                callback.arrowLength = callback.source?.length ?? 1;
                this.throwError(message, callback.position ?? callNode.position, source, callback);
            }

            const callbackName = `inline_callback_${this.createSymbolId()}`;
            this.enterScope();
            const params = (callback.params ?? []).map((param: any) => {
                return (this as any).visitFunctionParameterDeclaration(
                    {
                        ...callback,
                        name: callbackName,
                        fullSource: source,
                    },
                    param,
                );
            });

            const body = (this as any).visitFunctionBody(callback.body);

            const functionContext = {
                ...callback,
                name: callbackName,
                params,
                body,
                returnType: callback.returnType,
            };
            (this as any).validateFunctionReturnType(functionContext);
            const effectSummary = (this as any).analyzeAggregateEscapes(functionContext);
            this.exitScope();

            const functionType = {
                kind: Kinds.Types.FunctionType,
                raw: callback.source ?? "Function",
                parameters: params,
                returnType: callback.returnType,
            };

            return {
                ...callback,
                kind: Kinds.Functions.FunctionExpression,
                callbackName,
                params,
                body,
                returnType: this.toSerializableType(callback.returnType),
                type: this.toSerializableType(functionType),
                effectSummary,
            };
        }

        public removeNullishFromType(type: any): any {
            const resolved = this.resolveType(type);

            if (resolved?.kind !== Kinds.Types.UnionType) {
                return type;
            }

            const types = (resolved.types ?? []).filter((item: any) => {
                const kind = this.resolveType(item)?.kind;
                return kind !== Kinds.Types.NullType && kind !== Kinds.Types.UndefinedType;
            });

            if (types.length === 0) {
                return { kind: Kinds.Types.NeverType, raw: "never" };
            }

            if (types.length === 1) return types[0];

            return {
                ...resolved,
                types,
                raw: types.map((item: any) => item.raw ?? "unknown").join(" | "),
            };
        }

	        public visitUnaryExpression(node: any): any {
            if (node.operator !== "++" && node.operator !== "--") {
                const operand = this.visitNode(node.operand);

                if (node.operator === "!" && operand?.type?.kind === Kinds.Types.BooleanType) {
                    return {
                        ...node,
                        operand,
                        type: { kind: Kinds.Types.BooleanType, raw: "boolean" },
                    };
                }

                if (node.operator === "+" || node.operator === "-") {
                    if (this.resolveType(operand?.type)?.kind !== Kinds.Types.NumberType) {
                        const message =
                            `unary operator ${Helpers.RED}'${node.operator}'${Helpers.RESET} expects ` +
                            `${Helpers.BLUE}'number'${Helpers.RESET}, got ` +
                            `${Helpers.RED}'${operand?.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                        node.arrowLength = node.operator?.length ?? 1;
                        this.throwError(message, node.position, node.fullSource ?? node.source, node);
                    }

                    if (node.operator === "+") {
                        return operand;
                    }

                    if (operand.kind === Kinds.Sir.NumberConstant) {
                        return {
                            ...operand,
                            raw: node.source ?? `-${operand.raw ?? operand.value}`,
                            source: node.source ?? `-${operand.source ?? operand.value}`,
                            value: -operand.value,
                            position: node.position,
                        };
                    }

                    return {
                        kind: Kinds.Expressions.BinaryExpression,
                        operator: "-",
                        left: {
                            kind: Kinds.Sir.NumberConstant,
                            type: { kind: Kinds.Types.NumberType, raw: "number" },
                            raw: "0",
                            value: 0,
                            source: "0",
                            position: node.position,
                        },
                        right: operand,
                        source: node.source,
                        fullSource: node.fullSource ?? node.source,
                        position: node.position,
                        type: { kind: Kinds.Types.NumberType, raw: "number" },
                    };
                }

                const message = `unsupported unary operator ${Helpers.RED}'${node.operator}'${Helpers.RESET}`;
                node.arrowLength = node.operator?.length ?? 1;
                this.throwError(message, node.position, node.fullSource ?? node.source, node);
            }

            const operand = this.visitNode(node.operand);
            const one = {
                kind: Kinds.Sir.NumberConstant,
                type: { kind: Kinds.Types.NumberType, raw: "number" },
                raw: "1",
                value: 1,
                source: "1",
                position: node.position,
            };

            return this.createAssignmentFromMutation(
                node,
                operand,
                {
                    kind: Kinds.Expressions.BinaryExpression,
                    operator: node.operator === "++" ? "+" : "-",
                    left: operand,
                    right: one,
                    source: node.source,
                    fullSource: node.fullSource ?? node.source,
                    position: node.position,
                    type: { kind: Kinds.Types.NumberType, raw: "number" },
                },
                node.fullSource ?? node.source,
	            );
	        }

        public visitAddressOfExpression(node: any): any {
            const targetNode = node.target;
            const source = node.fullSource ?? node.source;

            if (targetNode?.kind === Kinds.Expressions.ParenthesizedExpression) {
                const inner = targetNode.expression;

                if (
                    inner?.kind === Kinds.Expressions.IdentifierExpression ||
                    inner?.kind === Kinds.Expressions.PropertyAccessExpression ||
                    inner?.kind === Kinds.Expressions.ElementAccessExpression
                ) {
                    return this.visitAddressOfExpression({
                        ...node,
                        target: inner,
                    });
                }

                targetNode.arrowLength = targetNode.source?.length ?? node.source?.length ?? 1;
                this.throwError(
                    `cannot take address of temporary expression`,
                    targetNode.position ?? node.position,
                    source,
                    targetNode,
                );
            }

            if (targetNode?.kind === Kinds.Collections.ArrayExpression) {
                targetNode.arrowLength = targetNode.source?.length ?? node.source?.length ?? 1;
                this.throwError(
                    `cannot take address of temporary array literal`,
                    targetNode.position ?? node.position,
                    source,
                    targetNode,
                );
            }

            if (
                targetNode?.kind === Kinds.Sir.NumberConstant ||
                targetNode?.kind === Kinds.Literals.NumberLiteral ||
                targetNode?.kind === Kinds.Literals.BooleanLiteral ||
                targetNode?.kind === Kinds.Literals.NullLiteral ||
                targetNode?.kind === Kinds.Literals.UndefinedLiteral
            ) {
                targetNode.arrowLength = targetNode.source?.length ?? node.source?.length ?? 1;
                this.throwError(
                    `cannot take address of temporary expression`,
                    targetNode.position ?? node.position,
                    source,
                    targetNode,
                );
            }

            if (targetNode?.kind === Kinds.Literals.StringLiteral) {
                targetNode.arrowLength = targetNode.source?.length ?? node.source?.length ?? 1;
                this.throwError(
                    `cannot take address of temporary string literal`,
                    targetNode.position ?? node.position,
                    source,
                    targetNode,
                );
            }

            if (
                targetNode?.kind === Kinds.Expressions.CallExpression ||
                targetNode?.kind === Kinds.Collections.DictionaryExpression
            ) {
                targetNode.arrowLength = targetNode?.source?.length ?? node.source?.length ?? 1;
                this.throwError(
                    `cannot take address of temporary expression`,
                    targetNode?.position ?? node.position,
                    source,
                    targetNode ?? node,
                );
            }

            const target = this.visitNode(targetNode);
            const accessPathFor = (value: any): string[] => {
                if (!value) {
                    return [];
                }

                if (value.kind === Kinds.Expressions.PropertyAccessExpression) {
                    return [
                        ...accessPathFor(value.object),
                        `.${value.property}`,
                    ];
                }

                if (value.kind === Kinds.Expressions.ElementAccessExpression) {
                    const indices = value.indices ?? (value.index ? [value.index] : []);
                    return [
                        ...accessPathFor(value.object),
                        `[${indices.map((item: any) => item.source ?? item.raw ?? "?").join(", ")}]`,
                    ];
                }

                return value.pointerAccessPath ?? value.accessPath ?? [];
            };

            if (targetNode?.kind === Kinds.Expressions.ElementAccessExpression) {
                const objectType = this.resolveType(target.object?.declaredType ?? target.object?.type);

                if (objectType?.kind === Kinds.Types.PointerType) {
                    target.arrowLength = target.source?.length ?? node.source?.length ?? 1;
                    this.throwError(
                        `cannot take address of pointer-derived element access`,
                        target.position ?? node.position,
                        source,
                        target,
                        "  = use the existing pointer expression instead of nesting address-of through it",
                    );
                }

                if (target.borrowedView === true || target.pointerPartialView === true) {
                    target.arrowLength = target.source?.length ?? node.source?.length ?? 1;
                    this.throwError(
                        `cannot take address of a borrowed array view`,
                        target.position ?? node.position,
                        source,
                        target,
                        "  = take the address of the full array and then index the pointer view",
                    );
                }

                const rootName = this.getAggregateRootIdentifier(target.object);
                const rootSymbol = rootName ? this.resolveSymbol(rootName) : null;

                if (!rootSymbol) {
                    target.arrowLength = target.source?.length ?? node.source?.length ?? 1;
                    this.throwError(
                        `cannot take address of non-addressable array element`,
                        target.position ?? node.position,
                        source,
                        target,
                    );
                }

                const pointee = this.toSerializableType(target.type);
                const permission =
                    rootSymbol.mutable === true && target.readonly !== true
                        ? "mutable"
                        : "readonly";
                const accessPath = accessPathFor(target);

                return {
                    ...node,
                    target,
                    kind: Kinds.Expressions.AddressOfExpression,
                    type: {
                        kind: Kinds.Types.PointerType,
                        raw: `ptr<${pointee?.raw ?? "unknown"}>`,
                        elementType: pointee,
                        pointee,
                    },
                    pointerRootName: rootName,
                    pointerRootSymbolId: rootSymbol.id,
                    pointerAccessPath: accessPath,
                    pointerPermission: permission,
                    rootName,
                    rootSymbolId: rootSymbol.id,
                    accessPath,
                    permission,
                };
            }

            if (targetNode?.kind === Kinds.Expressions.PropertyAccessExpression) {
                const rootName = this.getAggregateRootIdentifier(target.object);
                const rootSymbol = rootName ? this.resolveSymbol(rootName) : null;

                if (!rootSymbol) {
                    target.arrowLength = target.source?.length ?? node.source?.length ?? 1;
                    this.throwError(
                        `cannot take address of non-addressable struct field`,
                        target.position ?? node.position,
                        source,
                        target,
                    );
                }

                const pointee = this.toSerializableType(target.type);
                const permission =
                    rootSymbol.mutable === true && target.readonly !== true
                        ? "mutable"
                        : "readonly";
                const accessPath = accessPathFor(target);

                return {
                    ...node,
                    target,
                    kind: Kinds.Expressions.AddressOfExpression,
                    type: {
                        kind: Kinds.Types.PointerType,
                        raw: `ptr<${pointee?.raw ?? "unknown"}>`,
                        elementType: pointee,
                        pointee,
                    },
                    pointerRootName: rootName,
                    pointerRootSymbolId: rootSymbol.id,
                    pointerAccessPath: accessPath,
                    pointerPermission: permission,
                    rootName,
                    rootSymbolId: rootSymbol.id,
                    accessPath,
                    permission,
                };
            }

            if (targetNode?.kind !== Kinds.Expressions.IdentifierExpression) {
                targetNode.arrowLength = targetNode?.source?.length ?? node.source?.length ?? 1;
                this.throwError(
                    `address-of is currently supported only for variables and struct fields`,
                    targetNode?.position ?? node.position,
                    source,
                    targetNode ?? node,
                );
            }

            const targetName = target.name ?? target.value ?? target.raw;
            const symbol = targetName ? this.resolveSymbol(targetName) : null;

            if (!symbol) {
                target.arrowLength = targetName?.length ?? 1;
                this.throwError(
                    `cannot find name ${Helpers.RED}'${targetName ?? "unknown"}'${Helpers.RESET}`,
                    target.position ?? node.position,
                    source,
                    target,
                );
            }

            const pointee = this.toSerializableType(target.type);
            const permission = symbol.mutable === true ? "mutable" : "readonly";

            return {
                ...node,
                target,
                kind: Kinds.Expressions.AddressOfExpression,
                type: {
                    kind: Kinds.Types.PointerType,
                    raw: `ptr<${pointee?.raw ?? "unknown"}>`,
                    elementType: pointee,
                    pointee,
                },
                pointerRootName: targetName,
                pointerRootSymbolId: symbol.id,
                pointerAccessPath: [],
                pointerPermission: permission,
                rootName: targetName,
                rootSymbolId: symbol.id,
                accessPath: [],
                permission,
            };
        }

        public visitDereferenceExpression(node: any): any {
            if (node.implicitPointerReadThrough !== true) {
                node.arrowLength = node.source?.length ?? 1;
                this.throwError(
                    `Yogi does not use ${Helpers.RED}'*p'${Helpers.RESET} pointer dereference syntax; use ${Helpers.BLUE}'p'${Helpers.RESET} directly`,
                    node.position,
                    node.fullSource ?? node.source,
                    node,
                );
            }

            const target = this.visitNode(node.target);
            const source = node.fullSource ?? node.source;
            const pointerType = this.resolveType(target?.declaredType ?? target?.type);

            if (pointerType?.kind !== Kinds.Types.PointerType) {
                if (target) {
                    target.arrowLength = target.source?.length ?? node.source?.length ?? 1;
                } else {
                    node.arrowLength = node.source?.length ?? 1;
                }
                this.throwError(
                    `cannot dereference non-pointer type ${Helpers.RED}'${target?.type?.raw ?? "unknown"}'${Helpers.RESET}`,
                    target?.position ?? node.position,
                    source,
                    target ?? node,
                );
            }

            const pointee = this.toSerializableType(pointerType.elementType ?? pointerType.pointee ?? {
                kind: Kinds.Types.UnknownType,
                raw: "unknown",
            });
            const targetName = target?.kind === Kinds.Expressions.IdentifierExpression
                ? target.value ?? target.name ?? target.raw ?? null
                : null;
            const rootName =
                target.pointerRootName ??
                target.rootName ??
                targetName;
            const rootSymbol =
                typeof target.pointerRootSymbolId === "number"
                    ? this.getSymbolById(target.pointerRootSymbolId)
                    : typeof target.rootSymbolId === "number"
                        ? this.getSymbolById(target.rootSymbolId)
                        : rootName
                            ? this.resolveSymbol(rootName)
                            : null;
            const permission = target.pointerPermission ?? target.permission ?? "mutable";
            const borrowedView = this.isAggregateType(pointee);

            return {
                ...node,
                kind: Kinds.Expressions.DereferenceExpression,
                target,
                type: pointee,
                rootName,
                rootSymbolId:
                    target.pointerRootSymbolId ??
                    target.rootSymbolId ??
                    rootSymbol?.id,
                accessPath: [
                    ...(target.pointerAccessPath ?? target.accessPath ?? []),
                    "*",
                ],
                permission,
                pointerRootName: rootName,
                pointerRootSymbolId:
                    target.pointerRootSymbolId ??
                    target.rootSymbolId ??
                    rootSymbol?.id,
                pointerAccessPath: [
                    ...(target.pointerAccessPath ?? target.accessPath ?? []),
                    "*",
                ],
                pointerPermission: permission,
                borrowedView,
                borrowedViewReadonly: borrowedView && permission === "readonly",
                borrowedViewSourceName: borrowedView ? rootName : null,
                readonly: permission === "readonly",
            };
        }

        /**
         * Handles property access expressions including special handling for array.length and tuple.length.
         * array.length returns the array length as a readonly number.
         * tuple.length returns the fixed tuple length as a readonly number.
         */
        public visitPropertyAccessExpression(node: any): any {
            const object = this.visitNode(node.object);
            const accessType = object?.declaredType ?? object?.type;
            const objectType = this.resolveOptionalAccessObjectType(accessType);

            if (objectType?.kind === Kinds.Types.PointerType) {
                const pointee = objectType.elementType ?? objectType.pointee;
                const resolvedPointee = this.resolveType(pointee);
                const pointeeIsStruct =
                    resolvedPointee?.kind === Kinds.Types.StructDeclaration ||
                    resolvedPointee?.kind === "StructDeclaration";

                if (!pointeeIsStruct) {
                    const message =
                        `cannot access field ${Helpers.RED}'${node.property}'${Helpers.RESET} on pointee type ` +
                        `${Helpers.RED}'${resolvedPointee?.raw ?? pointee?.raw ?? "unknown"}'${Helpers.RESET}`;

                    node.arrowLength = node.property?.length ?? node.source?.length ?? 1;
                    this.throwError(message, node.position, node.fullSource ?? node.source, node);
                }

                const properties = this.objectPropertyMap(resolvedPointee);
                const property = properties.get(node.property);

                if (!property) {
                    const message =
                        `type ${Helpers.RED}'${resolvedPointee.raw ?? "struct"}'${Helpers.RESET} has no field ` +
                        `${Helpers.RED}'${node.property}'${Helpers.RESET}`;

                    node.arrowLength = node.property?.length ?? 1;
                    this.throwError(message, node.position, node.fullSource ?? node.source, node);
                }

                const pointerRootName =
                    object.pointerRootName ??
                    this.getAggregateRootIdentifier(object) ??
                    null;
                const pointerRootSymbol =
                    typeof object.pointerRootSymbolId === "number"
                        ? this.getSymbolById(object.pointerRootSymbolId)
                        : pointerRootName
                            ? this.resolveSymbol(pointerRootName)
                            : null;
                const pointerPermission = object.pointerPermission ?? object.permission;

                return {
                    ...node,
                    object,
                    type: property.optional === true
                        ? this.createUnionType([property.type, { kind: Kinds.Types.UndefinedType, raw: "undefined" }])
                        : property.type,
                    pointerAccess: true,
                    pointerRootName,
                    pointerRootSymbolId:
                        object.pointerRootSymbolId ??
                        object.rootSymbolId ??
                        object.symbolId ??
                        pointerRootSymbol?.id,
                    pointerAccessPath: [
                        ...(object.pointerAccessPath ?? object.accessPath ?? []),
                        `.${node.property}`,
                    ],
                    pointerPermission,
                    readonly: property.readonly === true || pointerPermission === "readonly" || object.readonly === true,
                };
            }

            // Handle array.length and tuple.length - special built-in properties
            if (node.property === "length") {
                if (
                    objectType?.kind === Kinds.Types.ArrayType ||
                    objectType?.kind === Kinds.Types.TupleType ||
                    objectType?.kind === Kinds.Types.StringType
                ) {
                    return {
                        ...node,
                        object,
                        type: {
                            kind: Kinds.Types.NumberType,
                            raw: "number",
                        },
                        readonly: true,
                    };
                }
            }

            if (!this.isObjectLikeType(objectType)) {
                const message =
                    `property ${Helpers.RED}'${node.property}'${Helpers.RESET} does not exist on type ` +
                    `${Helpers.RED}'${objectType?.raw ?? accessType?.raw ?? "unknown"}'${Helpers.RESET}`;

                node.arrowLength = node.source?.length ?? 1;
                this.throwError(message, node.position, node.fullSource ?? node.source, node);
            }

            const properties = this.objectPropertyMap(objectType);
            const property = properties.get(node.property);
            const inheritedPointerAccess =
                object.pointerAccess === true ||
                typeof object.pointerRootName === "string" ||
                typeof object.pointerRootSymbolId === "number";

            if (!property) {
                const message = inheritedPointerAccess
                    ? `type ${Helpers.RED}'${objectType.raw ?? "object"}'${Helpers.RESET} has no field ` +
                        `${Helpers.RED}'${node.property}'${Helpers.RESET}`
                    : `property ${Helpers.RED}'${node.property}'${Helpers.RESET} does not exist on type ` +
                        `${Helpers.RED}'${objectType.raw ?? "object"}'${Helpers.RESET}`;

                node.arrowLength = node.property?.length ?? 1;
                this.throwError(message, node.position, node.fullSource ?? node.source, node);
            }

            const pointerPermission = object.pointerPermission ?? object.permission;

            return {
                ...node,
                object,
                type: property.optional === true
                    ? this.createUnionType([property.type, { kind: Kinds.Types.UndefinedType, raw: "undefined" }])
                    : property.type,
                pointerAccess: inheritedPointerAccess || undefined,
                pointerRootName: inheritedPointerAccess ? object.pointerRootName ?? object.rootName ?? null : undefined,
                pointerRootSymbolId: inheritedPointerAccess
                    ? object.pointerRootSymbolId ?? object.rootSymbolId
                    : undefined,
                pointerAccessPath: inheritedPointerAccess
                    ? [
                        ...(object.pointerAccessPath ?? object.accessPath ?? []),
                        `.${node.property}`,
                    ]
                    : undefined,
                pointerPermission: inheritedPointerAccess ? pointerPermission : undefined,
                readonly: property.readonly === true || pointerPermission === "readonly" || object.readonly === true,
            };
        }

        public visitElementAccessExpression(node: any): any {
            const object = this.visitNode(node.object);
            const indices = (node.indices ?? [node.index]).map((item: any) => this.visitNode(item));
            const index = indices[0];
            const accessType = object?.declaredType ?? object?.type;
            const objectType = this.resolveOptionalAccessObjectType(accessType);
            const readonlyInfo = this.borrowedArrayReadonlyInfo(object, objectType);
            const indexValue = this.literalIndexValue(index);
            const source = node.fullSource ?? node.source;

            if (objectType?.kind === Kinds.Types.PointerType) {
                const pointee = objectType.elementType ?? objectType.pointee;
                const resolvedPointee = this.resolveType(pointee);

                for (const currentIndex of indices) {
                    if (currentIndex?.type?.kind !== Kinds.Types.NumberType) {
                        const message =
                            `pointer index must be ${Helpers.BLUE}'number'${Helpers.RESET}, got ` +
                            `${Helpers.RED}'${currentIndex?.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                        currentIndex.arrowLength = currentIndex.source?.length ?? 1;
                        this.throwError(message, currentIndex.position ?? node.position, source, currentIndex);
                    }
                }

                if (node.optional === true) {
                    const message =
                        `dynamic optional pointer element access ${Helpers.RED}'${node.source}'${Helpers.RESET} is not lowerable yet`;

                    node.arrowLength = node.source?.length ?? 1;
                    this.throwError(message, node.position, source, node);
                }

                if (resolvedPointee?.kind === Kinds.Types.ArrayType) {
                    const shape = resolvedPointee.shape ?? [];
                    const isFixedShape = resolvedPointee.fixed === true && shape.length > 0;
                    const pointerRootName =
                        object.pointerRootName ??
                        this.getAggregateRootIdentifier(object) ??
                        null;

                    if (isFixedShape) {
                        if (indices.length > shape.length) {
                            const message =
                                `${Helpers.BLUE}'${resolvedPointee.raw ?? pointee?.raw ?? "array"}'${Helpers.RESET} pointer expects ` +
                                `${Helpers.BLUE}'${shape.length}'${Helpers.RESET} index(es), got ${Helpers.RED}'${indices.length}'${Helpers.RESET}`;

                            node.arrowLength = node.source?.length ?? 1;
                            this.throwError(message, node.position, source, node);
                        }

                        for (let dimension = 0; dimension < indices.length; dimension++) {
                            const constantIndex = this.literalIndexValue(indices[dimension]);
                            const dimensionSize = shape[dimension];

                            if (
                                typeof constantIndex === "number" &&
                                Number.isInteger(constantIndex) &&
                                typeof dimensionSize === "number" &&
                                (constantIndex < 0 || constantIndex >= dimensionSize)
                            ) {
                                const message =
                                    `index ${Helpers.RED}'${constantIndex}'${Helpers.RESET} is out of bounds for dimension ` +
                                    `${Helpers.BLUE}'${dimension}'${Helpers.RESET} of size ${Helpers.BLUE}'${dimensionSize}'${Helpers.RESET}`;

                                indices[dimension].arrowLength = indices[dimension].source?.length ?? 1;
                                this.throwError(message, indices[dimension].position ?? node.position, source, indices[dimension]);
                            }
                        }

                        if (indices.length < shape.length) {
                            const viewType = this.fixedArraySliceType(resolvedPointee, indices.length);
                            const pointerViewType = {
                                kind: Kinds.Types.PointerType,
                                raw: `ptr<${viewType?.raw ?? "unknown"}>`,
                                elementType: viewType,
                                pointee: viewType,
                            };

                            return {
                                ...node,
                                object,
                                index,
                                indices,
                                type: pointerViewType,
                                pointerAccess: true,
                                pointerPartialView: true,
                                pointerRootName,
                                pointerRootSymbolId: object.pointerRootSymbolId,
                                pointerAccessPath: [
                                    ...(object.pointerAccessPath ?? []),
                                    `[${indices.map((item: any) => item.source ?? "?").join(", ")}]`,
                                ],
                                pointerPermission: object.pointerPermission,
                                readonly: object.pointerPermission === "readonly",
                            };
                        }
                    } else if (indices.length !== 1) {
                        const message =
                            `${Helpers.BLUE}'${resolvedPointee.raw ?? pointee?.raw ?? "array"}'${Helpers.RESET} pointer expects ` +
                            `${Helpers.BLUE}'1'${Helpers.RESET} index, got ${Helpers.RED}'${indices.length}'${Helpers.RESET}`;

                        node.arrowLength = node.source?.length ?? 1;
                        this.throwError(message, node.position, source, node);
                    }

                    return {
                        ...node,
                        object,
                        index,
                        indices,
                        type: resolvedPointee.elementType,
                        pointerAccess: true,
                        pointerRootName,
                        pointerRootSymbolId: object.pointerRootSymbolId,
                        pointerAccessPath: [
                            ...(object.pointerAccessPath ?? []),
                            `[${indices.map((item: any) => item.source ?? "?").join(", ")}]`,
                        ],
                        pointerPermission: object.pointerPermission,
                        readonly: object.pointerPermission === "readonly",
                    };
                }

                if (indices.length !== 1) {
                    const message = `scalar pointer access only supports index 0`;
                    node.arrowLength = node.source?.length ?? 1;
                    this.throwError(message, node.position, source, node);
                }

                if (typeof indexValue !== "number" || !Number.isInteger(indexValue)) {
                    const message = `scalar pointer access currently requires literal index 0`;
                    node.arrowLength = node.index?.source?.length ?? node.source?.length ?? 1;
                    this.throwError(message, node.position, source, node);
                }

                if (indexValue !== 0) {
                    const message = `scalar pointer access only supports index 0`;
                    node.arrowLength = node.index?.source?.length ?? node.source?.length ?? 1;
                    this.throwError(message, node.position, source, node);
                }

                return {
                    ...node,
                    object,
                    index,
                    indices,
                    type: pointee,
                    pointerAccess: true,
                    pointerRootName: object.pointerRootName ?? null,
                    pointerRootSymbolId: object.pointerRootSymbolId,
                    pointerAccessPath: [
                        ...(object.pointerAccessPath ?? []),
                        "[0]",
                    ],
                    pointerPermission: object.pointerPermission,
                    readonly: object.pointerPermission === "readonly",
                };
            }

            if (indices.length > 1) {
                if (objectType?.kind === Kinds.Types.ArrayType && objectType.fixed !== true) {
                    const message =
                        `${Helpers.BLUE}'${objectType.raw ?? "array"}'${Helpers.RESET} expects ` +
                        `${Helpers.BLUE}'1'${Helpers.RESET} index, got ${Helpers.RED}'${indices.length}'${Helpers.RESET}`;

                    node.arrowLength = node.source?.length ?? 1;
                    this.throwError(message, node.position, source, node);
                }

                if (objectType?.kind === Kinds.Types.TupleType || objectType?.kind === Kinds.Types.StringType) {
                    const message =
                        `${Helpers.BLUE}'${objectType.raw ?? "value"}'${Helpers.RESET} expects ` +
                        `${Helpers.BLUE}'1'${Helpers.RESET} index, got ${Helpers.RED}'${indices.length}'${Helpers.RESET}`;

                    node.arrowLength = node.source?.length ?? 1;
                    this.throwError(message, node.position, source, node);
                }
            }

            if (objectType?.kind === Kinds.Types.TupleType) {
                if (typeof indexValue !== "number" || !Number.isInteger(indexValue)) {
                    const message = `tuple index must be a numeric literal`;
                    node.arrowLength = node.index?.source?.length ?? node.source?.length ?? 1;
                    this.throwError(message, node.position, node.fullSource ?? node.source, node);
                }

                const tupleIndex = indexValue as number;
                const elements = objectType.elements ?? [];

                if (tupleIndex < 0 || tupleIndex >= elements.length) {
                    const message =
                        `tuple index ${Helpers.RED}'${tupleIndex}'${Helpers.RESET} is out of bounds for tuple of length ` +
                        `${Helpers.BLUE}'${elements.length}'${Helpers.RESET}`;

                    node.arrowLength = node.index?.source?.length ?? node.source?.length ?? 1;
                    this.throwError(message, node.position, node.fullSource ?? node.source, node);
                }

                if (node.optional === true) {
                    const message =
                        `dynamic optional element access ${Helpers.RED}'${node.source}'${Helpers.RESET} is not lowerable yet`;

                    node.arrowLength = node.source?.length ?? 1;
                    this.throwError(message, node.position, node.fullSource ?? node.source, node);
                }

                return {
                    ...node,
                    object,
                    index,
                    type: elements[tupleIndex],
                    readonly: objectType.readonly === true || readonlyInfo.readonly,
                    borrowedViewReadonly: readonlyInfo.borrowedViewReadonly,
                    borrowedViewSourceName: readonlyInfo.sourceName,
                };
            }

            if (objectType?.kind === Kinds.Types.ArrayType) {
                const shape = objectType.shape ?? [];
                const isBorrowedFixedShapeView =
                    objectType.fixed === true &&
                    shape.length > 0 &&
                    indices.length < shape.length;
                if (objectType.fixed === true && shape.length > 0) {
                    if (indices.length > shape.length) {
                        const message =
                            `${Helpers.BLUE}'${objectType.raw ?? "array"}'${Helpers.RESET} expects at most ` +
                            `${Helpers.BLUE}'${shape.length}'${Helpers.RESET} index(es), got ${Helpers.RED}'${indices.length}'${Helpers.RESET}`;

                        node.arrowLength = node.source?.length ?? 1;
                        this.throwError(message, node.position, source, node);
                    }

                    for (let dimension = 0; dimension < indices.length; dimension++) {
                        const constantIndex = this.literalIndexValue(indices[dimension]);
                        const dimensionSize = shape[dimension];

                        if (
                            typeof constantIndex === "number" &&
                            Number.isInteger(constantIndex) &&
                            typeof dimensionSize === "number" &&
                            (constantIndex < 0 || constantIndex >= dimensionSize)
                        ) {
                            const message =
                                `index ${Helpers.RED}'${constantIndex}'${Helpers.RESET} is out of bounds for dimension ` +
                                `${Helpers.BLUE}'${dimension}'${Helpers.RESET} of size ${Helpers.BLUE}'${dimensionSize}'${Helpers.RESET}`;

                            indices[dimension].arrowLength = indices[dimension].source?.length ?? 1;
                            this.throwError(message, indices[dimension].position ?? node.position, source, indices[dimension]);
                        }
                    }
                }

                for (const currentIndex of indices) {
                    if (currentIndex?.type?.kind !== Kinds.Types.NumberType) {
                        const message =
                            `array index must be ${Helpers.BLUE}'number'${Helpers.RESET}, got ` +
                            `${Helpers.RED}'${currentIndex?.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                        currentIndex.arrowLength = currentIndex.source?.length ?? 1;
                        this.throwError(message, currentIndex.position ?? node.position, node.fullSource ?? node.source, currentIndex);
                    }
                }

                if (node.optional === true) {
                    const message =
                        `dynamic optional element access ${Helpers.RED}'${node.source}'${Helpers.RESET} is not lowerable yet`;

                    node.arrowLength = node.source?.length ?? 1;
                    this.throwError(message, node.position, node.fullSource ?? node.source, node);
                }

                return {
                    ...node,
                    object,
                    index,
                    indices,
                    type: objectType.fixed === true && shape.length > 0
                        ? this.fixedArraySliceType(objectType, indices.length)
                        : objectType.elementType,
                    readonly: objectType.readonly === true || readonlyInfo.readonly,
                    borrowedView: isBorrowedFixedShapeView,
                    borrowedViewReadonly: readonlyInfo.borrowedViewReadonly || (isBorrowedFixedShapeView && readonlyInfo.readonly),
                    borrowedViewSourceName: isBorrowedFixedShapeView ? readonlyInfo.sourceName : null,
                };
            }

            if (objectType?.kind === Kinds.Types.StringType) {
                if (index?.type?.kind !== Kinds.Types.NumberType) {
                    const message =
                        `string index must be ${Helpers.BLUE}'number'${Helpers.RESET}, got ` +
                        `${Helpers.RED}'${index?.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                    node.arrowLength = node.index?.source?.length ?? node.source?.length ?? 1;
                    this.throwError(message, node.position, node.fullSource ?? node.source, node);
                }

                if (node.optional === true) {
                    const message =
                        `dynamic optional element access ${Helpers.RED}'${node.source}'${Helpers.RESET} is not lowerable yet`;

                    node.arrowLength = node.source?.length ?? 1;
                    this.throwError(message, node.position, node.fullSource ?? node.source, node);
                }

                return {
                    ...node,
                    object,
                    index,
                    type: {
                        kind: Kinds.Types.StringType,
                        raw: "string",
                    },
                    readonly: true,
                };
            }

            const message =
                `element access cannot be applied to type ${Helpers.RED}'${objectType?.raw ?? "unknown"}'${Helpers.RESET}`;

            node.arrowLength = node.source?.length ?? 1;
            this.throwError(message, node.position, node.fullSource ?? node.source, node);
        }

        public visitBinaryExpression(context: any): any {
            const checkExpression = (node: any): any => {
                if (!node) return null;

                switch (node.kind) {
                    case Kinds.Expressions.BinaryExpression:
                    case "BinaryExpression":
                        return checkBinary(node);

                    case Kinds.Expressions.ParenthesizedExpression:
                    case "ParenthesizedExpression":
                        return checkParenthesized(node);

                    default:
                        return this.visitNode(node);
                }
            };

            const checkParenthesized = (node: any): any => {
                return checkExpression(node.expression);
            };

            const checkBinary = (node: any): any => {
                const publicDereferenceTarget = (candidate: any): any => {
                    if (!candidate) return null;
                    if (candidate.kind === Kinds.Expressions.DereferenceExpression) return candidate;
                    if (candidate.kind === Kinds.Expressions.ParenthesizedExpression) {
                        return publicDereferenceTarget(candidate.expression);
                    }
                    return null;
                };

                if (node.operator === "=") {
                    const publicDereference = publicDereferenceTarget(node.left);
                    if (publicDereference && publicDereference.implicitPointerReadThrough !== true) {
                        publicDereference.arrowLength = publicDereference.source?.length ?? 1;
                        this.throwError(
                            `Yogi does not use ${Helpers.RED}'(*p) = value'${Helpers.RESET}; assign to ${Helpers.BLUE}'p'${Helpers.RESET} directly`,
                            publicDereference.position ?? node.position,
                            context.fullSource ?? node.fullSource ?? node.source,
                            publicDereference,
                        );
                    }
                }

                const left = checkExpression(node.left);
                let right = checkExpression(node.right);

                const leftType = left?.type;
                let rightType = right?.type;

                const done = (type: any) => ({
                    ...node,
                    left,
                    right,
                    type,
                });

                const fail = () => {
                    const message =
                        `operator ${Helpers.RED}'${node.operator}'${Helpers.RESET} cannot be applied to types ` +
                        `${Helpers.RED}'${leftType?.raw ?? "unknown"}'${Helpers.RESET} and ` +
                        `${Helpers.RED}'${rightType?.raw ?? "unknown"}'${Helpers.RESET}`;

                    node.arrowLength = node.fullSource?.length ?? node.source?.length ?? 1;

                    this.throwError(
                        message,
                        node.position,
                        context.fullSource ?? node.fullSource ?? node.source,
                        node,
                    );
                };

                const isNumber = (type: any) => this.resolveType(type)?.kind === Kinds.Types.NumberType;
                const isString = (type: any) => this.resolveType(type)?.kind === Kinds.Types.StringType;
                const isBoolean = (type: any) => this.resolveType(type)?.kind === Kinds.Types.BooleanType;
                const rejectPointerArithmetic = () => {
                    if ((node.operator === "+" || node.operator === "-") && (this.isPointerType(leftType) || this.isPointerType(rightType))) {
                        node.arrowLength = node.operator?.length ?? 1;
                        this.throwError(
                            `pointer arithmetic is not supported in safe Yogi`,
                            node.position,
                            context.fullSource ?? node.fullSource ?? node.source,
                            node,
                            "  = use typed array/matrix indexing instead",
                        );
                    }
                };

                switch (node.operator) {
                    case "??": {
                        const type = this.commonNullishType(leftType, rightType);
                        const folded = this.foldKnownNullishExpression(left, right, node);

                        if (folded) {
                            return {
                                ...folded,
                                source: node.source,
                                position: node.position,
                                nullish: {
                                    left,
                                    right,
                                },
                            };
                        }

                        return {
                            ...node,
                            left,
                            right,
                            type,
                        };
                    }

                    case "??=": {
                        const assignmentType = this.removeNullishFromType(leftType);

                        if (!this.isTypeAssignable(assignmentType, rightType)) {
                            const message =
                                `cannot assign value of type ${Helpers.RED}'${rightType?.raw ?? "unknown"}'${Helpers.RESET} through ` +
                                `${Helpers.RED}'??='${Helpers.RESET} to type ${Helpers.RED}'${assignmentType?.raw ?? "unknown"}'${Helpers.RESET}`;

                            right.arrowLength = right.source?.length ?? 1;
                            this.throwError(message, right.position, context.fullSource ?? node.fullSource ?? node.source, right);
                        }

                        const folded = this.foldKnownNullishExpression(left, right, node);
                        if (folded === right) {
                            return this.createAssignmentFromMutation(
                                node,
                                left,
                                right,
                                context.fullSource ?? node.fullSource ?? node.source,
                            );
                        }

                        if (folded) return null;

                        const assignment = this.createAssignmentFromMutation(
                            {
                                ...node,
                                operator: "=",
                            },
                            left,
                            right,
                            context.fullSource ?? node.fullSource ?? node.source,
                        );

                        return {
                            ...node,
                            left: assignment.left,
                            right,
                            type: assignmentType,
                        };
                    }

                    case "+=":
                    case "-=":
                    case "*=":
                    case "/=":
                    case "%=": {
                        const operator = node.operator.slice(0, -1);
                        const binary = checkBinary({
                            ...node,
                            operator,
                            left,
                            right,
                            source: node.source,
                            fullSource: node.fullSource,
                        });

                        return this.createAssignmentFromMutation(
                            node,
                            left,
                            binary,
                            context.fullSource ?? node.fullSource ?? node.source,
                        );
                    }

                    case "&&=":
                    case "||=": {
                        const operator = node.operator.slice(0, -1);
                        const binary = checkBinary({
                            ...node,
                            operator,
                            left,
                            right,
                            source: node.source,
                            fullSource: node.fullSource,
                        });

                        return this.createAssignmentFromMutation(
                            node,
                            left,
                            binary,
                            context.fullSource ?? node.fullSource ?? node.source,
                        );
                    }

	                    case "=": {
	                        if (left.kind !== Kinds.Expressions.IdentifierExpression) {
	                            if (left.kind === Kinds.Expressions.DereferenceExpression) {
	                                return checkDereferenceAssignment(node, left, right, context);
	                            }

	                            if (
	                                left.access?.kind === Kinds.Expressions.PropertyAccessExpression ||
	                                left.access?.kind === Kinds.Expressions.ElementAccessExpression
                            ) {
                                return checkAggregateAssignment(
                                    node,
                                    {
                                        ...left.access,
                                        type: left.type,
                                        readonly: left.readonly,
                                        borrowedViewReadonly: left.borrowedViewReadonly,
                                        borrowedViewSourceName: left.borrowedViewSourceName,
                                        source: left.source,
                                        position: left.position,
                                    },
                                    right,
                                    context,
                                );
                            }

                            if (
                                left.kind === Kinds.Expressions.PropertyAccessExpression ||
                                left.kind === Kinds.Expressions.ElementAccessExpression
                            ) {
                                return checkAggregateAssignment(node, left, right, context);
                            }

                            const message = `left side of assignment must be a variable`;
                            node.arrowLength = node.left?.source?.length ?? node.left?.raw?.length ?? 1;

                            this.throwError(
                                message,
                                node.position,
                                context.fullSource ?? node.fullSource ?? node.source,
                                node,
                            );
                        }

                        const identifierName = left.value ?? left.name ?? left.raw;
                        const symbol = this.resolveSymbol(identifierName);

                        if (!symbol) {
                            const message = `cannot find name ${Helpers.RED}'${identifierName}'${Helpers.RESET}`;
                            left.arrowLength = identifierName?.length ?? 1;

                            this.throwError(
                                message,
                                left.position,
                                left.fullSource ?? left.source ?? identifierName,
                                left,
                            );
                        }

                        const assignmentType = symbol.declaredType ?? symbol.type;

                        if (symbol.mutable !== true && !this.isPointerType(assignmentType)) {
                            const message = `cannot assign to ${Helpers.RED}'${identifierName}'${Helpers.RESET} because it was declared as a ${Helpers.BLUE}'const'${Helpers.RESET}`;
                            left.arrowLength = identifierName?.length ?? 1;

                            this.throwError(
                                message,
                                left.position,
                                context.fullSource ?? node.fullSource ?? left.fullSource ?? left.source,
                                left,
                            );
                        }

                        if (this.isPointerType(assignmentType)) {
                            const pointeeType = this.pointerPointeeType(assignmentType);

                            if (this.isPointerType(rightType)) {
                                if (symbol.mutable !== true) {
                                    left.arrowLength = identifierName?.length ?? 1;
                                    this.throwError(
                                        `cannot reassign const pointer binding ${Helpers.RED}'${identifierName}'${Helpers.RESET}`,
                                        left.position,
                                        context.fullSource ?? node.fullSource ?? left.fullSource ?? left.source,
                                        left,
                                    );
                                }

                                if (!this.isTypeAssignable(assignmentType, rightType)) {
                                    const message =
                                        `cannot assign ${Helpers.RED}'${rightType?.raw ?? "unknown"}'${Helpers.RESET} to ` +
                                        `${Helpers.BLUE}'${assignmentType?.raw ?? "unknown"}'${Helpers.RESET}`;

                                    right.arrowLength = right.source?.length ?? right.raw?.length ?? 1;
                                    this.throwError(message, right.position, context.fullSource ?? node.fullSource ?? node.source, right);
                                }

                                symbol.pointerRootName = right.pointerRootName ?? null;
                                symbol.pointerRootSymbolId = right.pointerRootSymbolId;
                                symbol.pointerAccessPath = right.pointerAccessPath ?? [];
                                symbol.pointerPermission = right.pointerPermission;
                                this.registerPointerProvenance(symbol, right);

                                return {
                                    ...node,
                                    kind: Kinds.Expressions.AssignmentExpression,
                                    left: {
                                        ...left,
                                        symbolId: symbol.id,
                                        scopeId: symbol.scopeId,
                                        type: symbol.type,
                                        declaredType: assignmentType,
                                        mutable: symbol.mutable,
                                        linkageName: symbol.linkageName ?? null,
                                        qualifiedName: symbol.qualifiedName,
                                    },
                                    right,
                                    type: assignmentType,
                                };
                            }

                            if (pointeeType && this.isTypeAssignable(pointeeType, rightType)) {
                                if (this.isAggregateType(pointeeType)) {
                                    right.arrowLength = right.source?.length ?? right.raw?.length ?? 1;
                                    this.throwError(
                                        `full aggregate replacement through pointer is not supported`,
                                        right.position ?? node.position,
                                        context.fullSource ?? node.fullSource ?? node.source,
                                        right,
                                        "  = assign individual elements or use an explicit copy/replace API when it exists",
                                    );
                                }

                                if (left.pointerPermission === "readonly" || symbol.pointerPermission === "readonly") {
                                    const rootName = left.pointerRootName ?? symbol.pointerRootName ?? "unknown";
                                    left.arrowLength = identifierName?.length ?? 1;
                                    this.throwError(
                                        `cannot write through pointer ${Helpers.RED}'${identifierName}'${Helpers.RESET} because it points to readonly value ${Helpers.RED}'${rootName}'${Helpers.RESET}`,
                                        left.position,
                                        context.fullSource ?? node.fullSource ?? left.fullSource ?? left.source,
                                        left,
                                    );
                                }

                                return {
                                    ...node,
                                    kind: "AggregateAssignmentExpression",
                                    target: this.createImplicitPointerReadThrough(left, pointeeType, context.fullSource ?? node.fullSource ?? node.source),
                                    right,
                                    type: pointeeType,
                                };
                            }

                            const message =
                                `cannot assign ${Helpers.RED}'${rightType?.raw ?? "unknown"}'${Helpers.RESET} to pointer ` +
                                `${Helpers.BLUE}'${identifierName}'${Helpers.RESET}; expected ` +
                                `${Helpers.BLUE}'${assignmentType?.raw ?? "unknown"}'${Helpers.RESET}` +
                                (pointeeType ? ` or ${Helpers.BLUE}'${pointeeType.raw ?? "unknown"}'${Helpers.RESET}` : "");

                            right.arrowLength = right.source?.length ?? right.raw?.length ?? 1;
                            this.throwError(message, right.position, context.fullSource ?? node.fullSource ?? node.source, right);
                        }

                        if (this.canReadThroughPointer(assignmentType, rightType)) {
                            right = this.createImplicitPointerReadThrough(
                                right,
                                assignmentType,
                                context.fullSource ?? node.fullSource ?? node.source,
                            );
                            rightType = right.type;
                        }

                        if (this.isDynamicArrayType(assignmentType)) {
                            this.assertNoLivePointerIntoDynamicContainer(
                                identifierName,
                                symbol,
                                "replace",
                                context.fullSource ?? node.fullSource ?? left.fullSource ?? left.source,
                                left,
                            );
                        }

                        if (!this.isTypeAssignable(assignmentType, rightType)) {
                            const message = this.isPointerType(rightType)
                                ? this.pointerReadThroughMismatchMessage(assignmentType, rightType)
                                : `cannot assign value of type ${Helpers.RED}'${rightType?.raw}'${Helpers.RESET} to variable ` +
                                    `${Helpers.RED}'${identifierName}'${Helpers.RESET} of type ${Helpers.RED}'${assignmentType?.raw}'${Helpers.RESET}`;

                            right.arrowLength = right.source?.length ?? right.raw?.length ?? 1;

                            this.throwError(
                                message,
                                right.position,
                                context.fullSource ?? node.fullSource ?? node.source,
                                right,
                            );
                        }

                        if (this.isAggregateType(assignmentType)) {
                            const rightSymbol = this.getAggregateSymbolFromExpression(right);

                            if (rightSymbol) {
                                if (symbol.scopeId === 0 || symbol.storage === Kinds.Storage.global) {
                                    this.markAggregateExpressionMoved(
                                        right,
                                        `it was assigned into module/global storage '${identifierName}'`,
                                        right,
                                    );
                                } else {
                                    this.transferAggregateOwner(
                                        symbol,
                                        rightSymbol,
                                        `ownership was reassigned to '${identifierName}'`,
                                        right,
                                    );
                                }
                            } else {
                                this.setAggregateOwner(symbol, null);
                            }
                        }

                        if (this.isPointerType(assignmentType)) {
                            symbol.pointerRootName = right.pointerRootName ?? null;
                            symbol.pointerRootSymbolId = right.pointerRootSymbolId;
                            symbol.pointerAccessPath = right.pointerAccessPath ?? [];
                            symbol.pointerPermission = right.pointerPermission;
                            this.registerPointerProvenance(symbol, right);
                        }

                        return {
                            ...node,
                            kind: Kinds.Expressions.AssignmentExpression,
                            left: {
                                ...left,
                                symbolId: symbol.id,
                                scopeId: symbol.scopeId,
                                type: symbol.type,
                                declaredType: assignmentType,
                                mutable: symbol.mutable,
                                linkageName: symbol.linkageName ?? null,
                                qualifiedName: symbol.qualifiedName,
                            },
                            right,
                            type: assignmentType,
                        };
                    }

                    case "+": {
                        rejectPointerArithmetic();

                        if (isNumber(leftType) && isNumber(rightType)) {
                            return done({ kind: Kinds.Types.NumberType, raw: "number" });
                        }

                        if (isString(leftType) && isString(rightType)) {
                            return done({ kind: Kinds.Types.StringType, raw: "string" });
                        }

                        fail();
                        return null;
                    }

                    case "-":
                    case "*":
                    case "/":
                    case "%": {
                        rejectPointerArithmetic();

                        if (isNumber(leftType) && isNumber(rightType)) {
                            return done({ kind: Kinds.Types.NumberType, raw: "number" });
                        }

                        fail();
                        return null;
                    }

                    case "<":
                    case "<=":
                    case ">":
                    case ">=": {
                        if (isNumber(leftType) && isNumber(rightType)) {
                            return done({ kind: Kinds.Types.BooleanType, raw: "boolean" });
                        }

                        fail();
                        return null;
                    }

                    case "==":
                    case "!=":
                    case "===":
                    case "!==": {
                        if (this.areTypesComparable(leftType, rightType)) {
                            return done({ kind: Kinds.Types.BooleanType, raw: "boolean" });
                        }

                        fail();
                        return null;
                    }

                    case "&&":
                    case "||": {
                        if (isBoolean(leftType) && isBoolean(rightType)) {
                            return done({ kind: Kinds.Types.BooleanType, raw: "boolean" });
                        }

                        fail();
                        return null;
                    }

                    default: {
                        const message =
                            `unknown binary operator ${Helpers.RED}'${node.operator}'${Helpers.RESET}`;

                        node.arrowLength = node.operator?.length ?? 1;

                        this.throwError(
                            message,
                            node.position,
                            context.fullSource ?? node.fullSource ?? node.source,
                            node,
                        );

                        return null;
                    }
                }
            };

	            const checkAggregateAssignment = (node: any, left: any, right: any, context: any): any => {
	                const root = this.getAggregateRootIdentifier(left.object);
	                const symbol = root ? this.resolveSymbol(root) : null;
	                const objectType = this.resolveType(left.object?.declaredType ?? left.object?.type);
	                const rootType = this.resolveType(symbol?.declaredType ?? symbol?.type);
	                const rootIsPointer = rootType?.kind === Kinds.Types.PointerType;

                if (objectType?.kind === Kinds.Types.PointerType) {
                    if (left.pointerPartialView === true) {
                        left.arrowLength = left.source?.length ?? 1;
                        this.throwError(
                            `cannot assign directly to pointer slice ${Helpers.RED}'${left.source ?? "view"}'${Helpers.RESET}; ` +
                            `mutate through the returned pointer or use full element indexing`,
                            left.position,
                            context.fullSource ?? node.fullSource ?? node.source,
                            left,
                        );
                    }

                    if (left.pointerPermission === "readonly") {
                        const rootName = left.pointerRootName ?? root ?? "unknown";
                        left.arrowLength = left.source?.length ?? 1;
                        this.throwError(
                            `cannot mutate storage derived from const value ${Helpers.RED}'${rootName}'${Helpers.RESET}`,
                            left.position,
                            context.fullSource ?? node.fullSource ?? node.source,
                            left,
                        );
                    }

                    if (!this.isTypeAssignable(left.type, right.type)) {
                        const pointerElementType = this.resolveType(objectType.elementType ?? objectType.pointee);
                        const resolvedTargetType = this.resolveType(left.type);
                        const message = pointerElementType?.kind === Kinds.Types.ArrayType
                            ? `cannot assign ${Helpers.RED}'${right.type?.raw ?? "unknown"}'${Helpers.RESET} to array element type ` +
                                `${Helpers.BLUE}'${resolvedTargetType?.raw ?? left.type?.raw ?? "unknown"}'${Helpers.RESET}`
                            : `expected ${Helpers.BLUE}'${left.type?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                                `${Helpers.RED}'${right.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                        right.arrowLength = right.source?.length ?? 1;
                        this.throwError(message, right.position, context.fullSource ?? node.fullSource ?? node.source, right);
                    }

                    return {
                        ...node,
                        kind: "AggregateAssignmentExpression",
                        target: left,
                        right,
                        type: left.type,
                    };
                }

                if (rootIsPointer && left.pointerPermission === "readonly") {
                    const rootName = left.pointerRootName ?? root ?? "unknown";
                    left.arrowLength = left.source?.length ?? 1;
                    this.throwError(
                        `cannot mutate through pointer because pointee storage ${Helpers.RED}'${rootName}'${Helpers.RESET} is readonly`,
                        left.position,
                        context.fullSource ?? node.fullSource ?? node.source,
                        left,
                    );
                }

                if (!symbol) {
                    const message = `left side of assignment must start from a known variable`;
                    left.arrowLength = left.source?.length ?? 1;
                    this.throwError(message, left.position, context.fullSource ?? node.fullSource ?? node.source, left);
                }

                if (!rootIsPointer && symbol.mutable !== true) {
                    const message =
                        `cannot mutate ${Helpers.RED}'${root}'${Helpers.RESET} because it was declared as a ` +
                        `${Helpers.BLUE}'const'${Helpers.RESET}`;

                    left.arrowLength = left.source?.length ?? 1;
                    this.throwError(message, left.position, context.fullSource ?? node.fullSource ?? node.source, left);
                }

                if (left.borrowedViewReadonly === true) {
                    this.throwReadonlyBorrowedViewMutationError(
                        left.object,
                        left,
                        context.fullSource ?? node.fullSource ?? node.source,
                        root,
                        left.borrowedViewSourceName,
                    );
                }

                if (left.readonly === true || this.isReadonlyType(left.object?.type)) {
                    const message =
                        `cannot assign to ${Helpers.RED}'${left.source ?? "readonly member"}'${Helpers.RESET} because it is readonly`;

                    left.arrowLength = left.source?.length ?? 1;
                    this.throwError(message, left.position, context.fullSource ?? node.fullSource ?? node.source, left);
                }

                const resolvedLeftType = this.resolveType(left.type);
                let validatedByAggregate = false;

                if (right.kind === Kinds.Collections.DictionaryExpression) {
                    if (this.isObjectLikeType(resolvedLeftType)) {
                        this.validateObjectLiteralAssignment(
                            resolvedLeftType,
                            right,
                            { name: left.source ?? "member", position: right.position },
                            context.fullSource ?? node.fullSource ?? node.source,
                        );
                        validatedByAggregate = true;
                    }
                }

                if (right.kind === Kinds.Collections.ArrayExpression) {
                    if (
                        resolvedLeftType?.kind === Kinds.Types.ArrayType ||
                        resolvedLeftType?.kind === Kinds.Types.TupleType
                    ) {
                        this.validateAggregateAssignment(
                            left.type,
                            right,
                            { name: left.source ?? "member", position: right.position },
                            context.fullSource ?? node.fullSource ?? node.source,
                        );
                        validatedByAggregate = true;
                    }
                }

                if (!validatedByAggregate && !this.isTypeAssignable(left.type, right.type)) {
                    const message =
                        `cannot assign value of type ${Helpers.RED}'${right.type?.raw ?? "unknown"}'${Helpers.RESET} to ` +
                        `${Helpers.RED}'${left.source ?? "member"}'${Helpers.RESET} of type ` +
                        `${Helpers.BLUE}'${left.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                    right.arrowLength = right.source?.length ?? 1;
                    this.throwError(message, right.position, context.fullSource ?? node.fullSource ?? node.source, right);
                }

                if (this.isAggregateType(right.type)) {
                    this.markAggregateExpressionMoved(
                        right,
                        `it was stored into aggregate member '${left.source ?? "member"}'`,
                        right,
                    );
                }

                return {
                    ...node,
                    kind: "AggregateAssignmentExpression",
                    target: left,
                    right,
	                    type: left.type,
	                };
	            };

	            const checkDereferenceAssignment = (node: any, left: any, right: any, context: any): any => {
	                const targetType = this.resolveType(left.type);
	                const targetKind = targetType?.kind;

	                if (
	                    targetKind === Kinds.Types.ArrayType ||
	                    targetKind === Kinds.Types.TupleType ||
	                    targetKind === Kinds.Types.StringType ||
	                    this.isObjectLikeType(targetType)
	                ) {
	                    left.arrowLength = left.source?.length ?? 1;
	                    this.throwError(
	                        `cannot assign a full resource value through dereference ${Helpers.RED}'${left.source ?? "*pointer"}'${Helpers.RESET}`,
	                        left.position,
	                        context.fullSource ?? node.fullSource ?? node.source,
	                        left,
	                        "  = mutate array/object elements through indexing or use an explicit owner transfer API when it exists",
	                    );
	                }

	                if (left.pointerPermission === "readonly" || left.permission === "readonly") {
	                    const rootName = left.pointerRootName ?? left.rootName ?? "unknown";
	                    left.arrowLength = left.source?.length ?? 1;
	                    this.throwError(
	                        `cannot mutate storage derived from const value ${Helpers.RED}'${rootName}'${Helpers.RESET}`,
	                        left.position,
	                        context.fullSource ?? node.fullSource ?? node.source,
	                        left,
	                    );
	                }

	                if (!this.isTypeAssignable(left.type, right.type)) {
	                    const message =
	                        `expected ${Helpers.BLUE}'${left.type?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
	                        `${Helpers.RED}'${right.type?.raw ?? "unknown"}'${Helpers.RESET}`;

	                    right.arrowLength = right.source?.length ?? 1;
	                    this.throwError(message, right.position, context.fullSource ?? node.fullSource ?? node.source, right);
	                }

	                return {
	                    ...node,
	                    kind: "AggregateAssignmentExpression",
	                    target: left,
	                    right,
	                    type: left.type,
	                };
	            };

	            return checkExpression(context.value);
	        }

        public createAssignmentFromMutation(node: any, left: any, right: any, source: string): any {
            if (left.kind !== Kinds.Expressions.IdentifierExpression) {
                if (
                    left.access?.kind === Kinds.Expressions.PropertyAccessExpression ||
                    left.access?.kind === Kinds.Expressions.ElementAccessExpression
                ) {
                    left = {
                        ...left.access,
                        type: left.type,
                        readonly: left.readonly,
                        borrowedViewReadonly: left.borrowedViewReadonly,
                        borrowedViewSourceName: left.borrowedViewSourceName,
                        source: left.source,
                        position: left.position,
                    };
                }

                if (
                    left.kind === Kinds.Expressions.PropertyAccessExpression ||
                    left.kind === Kinds.Expressions.ElementAccessExpression
                ) {
                    const root = this.getAggregateRootIdentifier(left.object);
                    const symbol = root ? this.resolveSymbol(root) : null;
                    const rootType = this.resolveType(symbol?.declaredType ?? symbol?.type);
                    const rootIsPointer = rootType?.kind === Kinds.Types.PointerType;

                    if (!symbol) {
                        const message =
                            `cannot mutate ${Helpers.RED}'${root ?? left.source}'${Helpers.RESET} because it is unknown`;

                        left.arrowLength = left.source?.length ?? 1;
                        this.throwError(message, left.position, source, left);
                    }

                    if (rootIsPointer && left.pointerPermission === "readonly") {
                        const rootName = left.pointerRootName ?? root ?? "unknown";
                        const message =
                            `cannot mutate through pointer because pointee storage ${Helpers.RED}'${rootName}'${Helpers.RESET} is readonly`;

                        left.arrowLength = left.source?.length ?? 1;
                        this.throwError(message, left.position, source, left);
                    }

                    if (!rootIsPointer && symbol.mutable !== true) {
                        const message =
                            `cannot mutate ${Helpers.RED}'${root ?? left.source}'${Helpers.RESET} because it is immutable`;

                        left.arrowLength = left.source?.length ?? 1;
                        this.throwError(message, left.position, source, left);
                    }

                    if (left.borrowedViewReadonly === true) {
                        this.throwReadonlyBorrowedViewMutationError(
                            left.object,
                            left,
                            source,
                            root,
                            left.borrowedViewSourceName,
                        );
                    }

                    if (left.readonly === true || this.isReadonlyType(left.object?.type)) {
                        const message =
                            `cannot assign to ${Helpers.RED}'${left.source ?? "readonly member"}'${Helpers.RESET} because it is readonly`;

                        left.arrowLength = left.source?.length ?? 1;
                        this.throwError(message, left.position, source, left);
                    }

                    if (this.isAggregateType(right.type)) {
                        this.markAggregateExpressionMoved(
                            right,
                            `it was stored into aggregate member '${left.source ?? "member"}'`,
                            right,
                        );
                    }

                    return {
                        ...node,
                        kind: "AggregateAssignmentExpression",
                        target: left,
                        right,
                        type: left.type,
                    };
                }

                const message = `left side of assignment must be a variable`;
                left.arrowLength = left.source?.length ?? 1;
                this.throwError(message, left.position ?? node.position, source, left);
            }

            const identifierName = left.value ?? left.name ?? left.raw;
            const symbol = this.resolveSymbol(identifierName);

            if (!symbol) {
                const message = `cannot find name ${Helpers.RED}'${identifierName}'${Helpers.RESET}`;
                left.arrowLength = identifierName?.length ?? 1;
                this.throwError(message, left.position, source, left);
            }

            if (symbol.mutable !== true) {
                const message =
                    `cannot assign to ${Helpers.RED}'${identifierName}'${Helpers.RESET} because it was declared as a ` +
                    `${Helpers.BLUE}'const'${Helpers.RESET}`;

                left.arrowLength = identifierName?.length ?? 1;
                this.throwError(message, left.position, source, left);
            }

            const assignmentType = symbol.declaredType ?? symbol.type;

            if (this.isDynamicArrayType(assignmentType)) {
                this.assertNoLivePointerIntoDynamicContainer(
                    identifierName,
                    symbol,
                    "replace",
                    source,
                    left,
                );
            }

            if (!this.isTypeAssignable(assignmentType, right.type)) {
                const message =
                    `cannot assign value of type ${Helpers.RED}'${right.type?.raw ?? "unknown"}'${Helpers.RESET} to variable ` +
                    `${Helpers.RED}'${identifierName}'${Helpers.RESET} of type ${Helpers.RED}'${assignmentType?.raw ?? "unknown"}'${Helpers.RESET}`;

                right.arrowLength = right.source?.length ?? 1;
                this.throwError(message, right.position ?? node.position, source, right);
            }

            if (this.isAggregateType(assignmentType)) {
                const rightSymbol = this.getAggregateSymbolFromExpression(right);

                if (rightSymbol) {
                    if (symbol.scopeId === 0 || symbol.storage === Kinds.Storage.global) {
                        this.markAggregateExpressionMoved(
                            right,
                            `it was assigned into module/global storage '${identifierName}'`,
                            right,
                        );
                    } else {
                        this.transferAggregateOwner(
                            symbol,
                            rightSymbol,
                            `ownership was reassigned to '${identifierName}'`,
                            right,
                        );
                    }
                } else {
                    this.setAggregateOwner(symbol, null);
                }
            }

            return {
                ...node,
                kind: Kinds.Expressions.AssignmentExpression,
                left: {
                    ...left,
                    symbolId: symbol.id,
                    scopeId: symbol.scopeId,
                    type: symbol.type,
                    declaredType: assignmentType,
                    mutable: symbol.mutable,
                    linkageName: symbol.linkageName ?? null,
                    qualifiedName: symbol.qualifiedName,
                },
                right,
                type: assignmentType,
            };
        }

        public resolveOptionalAccessObjectType(type: any): any {
            const resolved = this.resolveType(type);

            if (resolved?.kind !== Kinds.Types.UnionType) {
                return resolved;
            }

            const nonNullish = (resolved.types ?? []).filter((item: any) => {
                const kind = this.resolveType(item)?.kind;
                return kind !== Kinds.Types.NullType && kind !== Kinds.Types.UndefinedType;
            });

            if (nonNullish.length === 1) {
                return this.resolveType(nonNullish[0]);
            }

            return {
                ...resolved,
                types: nonNullish,
                raw: nonNullish.map((item: any) => item.raw ?? "unknown").join(" | "),
            };
        }

        public createUnionType(types: any[]): any {
            const flattened = types.flatMap((type: any) => {
                const resolved = this.resolveType(type);
                return resolved?.kind === Kinds.Types.UnionType ? resolved.types ?? [] : [type];
            });

            const unique = new Map<string, any>();

            for (const type of flattened) {
                if (!type || type.kind === Kinds.Types.NeverType) continue;
                unique.set(`${type.kind}:${type.raw ?? ""}`, type);
            }

            const values = [...unique.values()];

            if (values.length === 0) {
                return { kind: Kinds.Types.NeverType, raw: "never" };
            }

            if (values.length === 1) {
                return values[0];
            }

            return {
                kind: Kinds.Types.UnionType,
                raw: values.map((type: any) => type.raw ?? "unknown").join(" | "),
                types: values,
            };
        }

        public commonConditionalType(whenTrueType: any, whenFalseType: any): any {
            if (this.isTypeAssignable(whenTrueType, whenFalseType)) {
                return whenTrueType;
            }

            if (this.isTypeAssignable(whenFalseType, whenTrueType)) {
                return whenFalseType;
            }

            return this.createUnionType([whenTrueType, whenFalseType]);
        }

        public commonNullishType(leftType: any, rightType: any): any {
            return this.createUnionType([this.removeNullishFromType(leftType), rightType]);
        }

        public isNullishConstant(value: any): boolean {
            return (
                value?.kind === Kinds.Sir.NullConstant ||
                value?.kind === Kinds.Sir.UndefinedConstant
            );
        }

        public isKnownNonNullishConstant(value: any): boolean {
            return (
                value?.kind === Kinds.Sir.NumberConstant ||
                value?.kind === Kinds.Sir.StringConstant ||
                value?.kind === Kinds.Sir.BooleanConstant
            );
        }

        public constantBooleanValue(value: any): boolean | null {
            const knownValue = this.knownValueForExpression(value) ?? value;

            if (knownValue?.kind !== Kinds.Sir.BooleanConstant) {
                return null;
            }

            return knownValue.value === true;
        }

        public foldKnownNullishExpression(left: any, right: any, node: any): any {
            const knownLeft = this.knownValueForExpression(left);

            if (knownLeft && this.isNullishConstant(knownLeft)) {
                return right;
            }

            if (knownLeft && this.isKnownNonNullishConstant(knownLeft)) {
                return {
                    ...knownLeft,
                    source: node.source ?? knownLeft.source,
                    position: node.position ?? knownLeft.position,
                };
            }

            if (this.isNullishConstant(left)) {
                return right;
            }

            if (this.isKnownNonNullishConstant(left)) {
                return left;
            }

            const resolvedLeft = this.resolveType(left?.type);

            if (
                resolvedLeft &&
                resolvedLeft.kind !== Kinds.Types.UnionType &&
                resolvedLeft.kind !== Kinds.Types.NullType &&
                resolvedLeft.kind !== Kinds.Types.UndefinedType
            ) {
                return left;
            }

            return null;
        }

        public knownValueForExpression(expression: any): any {
            if (this.isNullishConstant(expression) || this.isKnownNonNullishConstant(expression)) {
                return expression;
            }

            if (expression?.kind !== Kinds.Expressions.IdentifierExpression) {
                return null;
            }

            const name = expression.value ?? expression.name ?? expression.raw;
            const symbol = name ? this.resolveSymbol(name) : null;

            return symbol?.node ?? null;
        }

        public getAggregateRootIdentifier(node: any): string | null {
            if (!node) return null;

            if (node.kind === Kinds.Expressions.IdentifierExpression) {
                return node.value ?? node.name ?? node.raw;
            }

	            if (
	                node.kind === Kinds.Expressions.PropertyAccessExpression ||
	                node.kind === Kinds.Expressions.ElementAccessExpression
	            ) {
	                return this.getAggregateRootIdentifier(node.object);
	            }

	            if (node.kind === Kinds.Expressions.DereferenceExpression) {
	                return node.borrowedViewSourceName ?? node.rootName ?? this.getAggregateRootIdentifier(node.target);
	            }

	            return null;
	        }

        public borrowedArrayReadonlyInfo(object: any, objectType: any): {
            readonly: boolean;
            borrowedViewReadonly: boolean;
            sourceName: string | null;
        } {
            const rootName = this.getAggregateRootIdentifier(object);
            const symbol = rootName ? this.resolveSymbol(rootName) : null;
            const symbolNode = symbol?.node;
            const sourceName =
                object?.borrowedViewSourceName ??
                symbol?.borrowedViewSourceName ??
                symbolNode?.borrowedViewSourceName ??
                (symbolNode?.object ? this.getAggregateRootIdentifier(symbolNode.object) : null) ??
                rootName ??
                null;
            const isBorrowedView =
                object?.borrowedView === true ||
                symbol?.borrowedView === true ||
                symbolNode?.borrowedView === true;
            const borrowedViewReadonly =
                object?.borrowedViewReadonly === true ||
                symbol?.borrowedViewReadonly === true ||
                symbolNode?.borrowedViewReadonly === true;
            const readonly =
                borrowedViewReadonly ||
                object?.readonly === true ||
                objectType?.readonly === true ||
                this.isReadonlyType(objectType) ||
                symbol?.mutable === false;

            return {
                readonly,
                borrowedViewReadonly: borrowedViewReadonly || (readonly && isBorrowedView),
                sourceName,
            };
        }

        public borrowedPointerReturnInfo(argument: any): {
            rootName: string | null;
            rootSymbolId?: number;
            accessPath: string[];
            permission?: "mutable" | "readonly";
        } | null {
            if (!argument) return null;

            const identifierName = argument.kind === Kinds.Expressions.IdentifierExpression
                ? argument.value ?? argument.name ?? argument.raw ?? null
                : null;
            const rootName =
                argument.pointerRootName ??
                argument.rootName ??
                identifierName;
            const rootSymbol =
                typeof argument.pointerRootSymbolId === "number"
                    ? this.getSymbolById(argument.pointerRootSymbolId)
                    : typeof argument.rootSymbolId === "number"
                        ? this.getSymbolById(argument.rootSymbolId)
                        : rootName
                            ? this.resolveSymbol(rootName)
                            : null;

            return {
                rootName,
                rootSymbolId:
                    argument.pointerRootSymbolId ??
                    argument.rootSymbolId ??
                    rootSymbol?.id,
                accessPath: argument.pointerAccessPath ?? argument.accessPath ?? [],
                permission: argument.pointerPermission ?? argument.permission,
            };
        }

        public throwReadonlyBorrowedViewMutationError(
            view: any,
            node: any,
            source: string,
            viewName?: string | null,
            sourceName?: string | null,
        ): void {
            const viewLabel = viewName ?? this.getAggregateRootIdentifier(view) ?? view?.source ?? "view";
            const viewSymbol = viewLabel ? this.resolveSymbol(viewLabel) : null;
            const inferredSourceLabel =
                viewSymbol?.borrowedViewSourceName ??
                viewSymbol?.node?.borrowedViewSourceName ??
                (viewSymbol?.node?.object ? this.getAggregateRootIdentifier(viewSymbol.node.object) : null);
            const sourceLabel = sourceName && sourceName !== viewLabel
                ? sourceName
                : inferredSourceLabel ?? sourceName ?? viewLabel;
            const message =
                `cannot mutate borrowed view ${Helpers.RED}'${viewLabel}'${Helpers.RESET} because it borrows from readonly source ` +
                `${Helpers.BLUE}'${sourceLabel}'${Helpers.RESET}`;

            node.arrowLength = node.source?.length ?? view?.source?.length ?? 1;
            this.throwError(message, node.position ?? view?.position, source, node);
        }

        public foldKnownPropertyAccess(object: any, propertyName: string, node: any): any {
            const rootName = this.getAggregateRootIdentifier(object);
            const symbol = rootName ? this.resolveSymbol(rootName) : null;
            const objectType = this.resolveType(object?.declaredType ?? object?.type);
            const declaredProperty = this.isObjectLikeType(objectType)
                ? this.objectPropertyMap(objectType).get(propertyName)
                : null;
            const aggregate = symbol?.node?.kind === Kinds.Collections.DictionaryExpression
                ? symbol.node
                : object?.kind === Kinds.Collections.DictionaryExpression
                    ? object
                    : null;

            if (!aggregate) return null;

            const property = (aggregate.properties ?? []).find((item: any) => item.key === propertyName || item.name === propertyName);
            if (!property?.value && declaredProperty?.optional === true) {
                return {
                    kind: Kinds.Sir.UndefinedConstant,
                    type: { kind: Kinds.Types.UndefinedType, raw: "undefined" },
                    raw: "undefined",
                    value: "undefined",
                    source: node.source,
                    position: node.position,
                    readonly: declaredProperty?.readonly === true,
                    access: {
                        kind: Kinds.Expressions.PropertyAccessExpression,
                        property: propertyName,
                        object,
                        readonly: declaredProperty?.readonly === true,
                    },
                };
            }

            if (!property?.value) return null;

            return {
                ...property.value,
                source: node.source,
                position: node.position,
                readonly: declaredProperty?.readonly === true,
                access: {
                    kind: Kinds.Expressions.PropertyAccessExpression,
                    property: propertyName,
                    object,
                    readonly: declaredProperty?.readonly === true,
                },
            };
        }

        public foldKnownElementAccess(object: any, index: number, node: any): any {
            const rootName = this.getAggregateRootIdentifier(object);
            const symbol = rootName ? this.resolveSymbol(rootName) : null;
            const aggregate = symbol?.node?.kind === Kinds.Collections.ArrayExpression
                ? symbol.node
                : object?.kind === Kinds.Collections.ArrayExpression
                    ? object
                    : null;

            if (!aggregate) return null;

            const element = aggregate.elements?.[index];
            if (!element) return null;

            return {
                ...element,
                source: node.source,
                position: node.position,
                readonly: this.resolveType(object?.declaredType ?? object?.type)?.readonly === true,
                access: {
                    kind: Kinds.Expressions.ElementAccessExpression,
                    index,
                    object,
                    readonly: this.resolveType(object?.declaredType ?? object?.type)?.readonly === true,
                },
            };
        }
    };
}
