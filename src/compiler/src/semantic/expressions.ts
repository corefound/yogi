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
                const actualType = args[index]?.type;

                if (!this.isTypeAssignable(expectedType, actualType)) {
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
            const effectSummary = symbol.effectSummary ?? null;
            const external = symbol.ambient === true || symbol.declare === true || !effectSummary;
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
            const args = (node.arguments ?? []).map((argument: any) => this.visitNode(argument));
            const source = node.fullSource ?? node.source ?? rawCallee.source;

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
            // Tuples have fixed length; push is not allowed
            if (receiverType?.kind === Kinds.Types.TupleType) {
                const message =
                    `tuple method ${Helpers.RED}'push'${Helpers.RESET} is not supported because tuple length is fixed`;

                rawCallee.arrowLength = rawCallee.source?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            // Validate receiver is mutable
            const root = this.getAggregateRootIdentifier(receiver);
            const symbol = root ? this.resolveSymbol(root) : null;

            if (symbol?.mutable !== true) {
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
            // Tuples have fixed length; pop is not allowed
            if (receiverType?.kind === Kinds.Types.TupleType) {
                const message =
                    `tuple method ${Helpers.RED}'pop'${Helpers.RESET} is not supported because tuple length is fixed`;

                rawCallee.arrowLength = rawCallee.source?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            // Validate receiver is mutable
            const root = this.getAggregateRootIdentifier(receiver);
            const symbol = root ? this.resolveSymbol(root) : null;

            if (symbol?.mutable !== true) {
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

            // at() returns T | undefined
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
                builtinMethod: "array.at",
            };
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

            const root = this.getAggregateRootIdentifier(receiver);
            const symbol = root ? this.resolveSymbol(root) : null;

            if (symbol?.mutable !== true) {
                const message =
                    `cannot mutate ${Helpers.RED}'${root ?? rawCallee.source}'${Helpers.RESET} because it is immutable`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
            }

            if (this.isReadonlyType(receiverType)) {
                const message =
                    `cannot call mutating method ${Helpers.RED}'${methodName}'${Helpers.RESET} on readonly array`;

                rawCallee.arrowLength = rawCallee.source?.length ?? methodName?.length ?? 1;
                this.throwError(message, rawCallee.position ?? node.position, source, rawCallee);
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

        /**
         * Handles property access expressions including special handling for array.length and tuple.length.
         * array.length returns the array length as a readonly number.
         * tuple.length returns the fixed tuple length as a readonly number.
         */
        public visitPropertyAccessExpression(node: any): any {
            const object = this.visitNode(node.object);
            const accessType = object?.declaredType ?? object?.type;
            const objectType = this.resolveOptionalAccessObjectType(accessType);

            // Handle array.length and tuple.length - special built-in properties
            if (node.property === "length") {
                if (objectType?.kind === Kinds.Types.ArrayType || objectType?.kind === Kinds.Types.TupleType) {
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

            if (!property) {
                const message =
                    `property ${Helpers.RED}'${node.property}'${Helpers.RESET} does not exist on type ` +
                    `${Helpers.RED}'${objectType.raw ?? "object"}'${Helpers.RESET}`;

                node.arrowLength = node.property?.length ?? 1;
                this.throwError(message, node.position, node.fullSource ?? node.source, node);
            }

            return {
                ...node,
                object,
                type: property.optional === true
                    ? this.createUnionType([property.type, { kind: Kinds.Types.UndefinedType, raw: "undefined" }])
                    : property.type,
                readonly: property.readonly === true,
            };
        }

        public visitElementAccessExpression(node: any): any {
            const object = this.visitNode(node.object);
            const index = this.visitNode(node.index);
            const accessType = object?.declaredType ?? object?.type;
            const objectType = this.resolveOptionalAccessObjectType(accessType);
            const indexValue = this.literalIndexValue(index);

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
                    readonly: objectType.readonly === true,
                };
            }

            if (objectType?.kind === Kinds.Types.ArrayType) {
                if (index?.type?.kind !== Kinds.Types.NumberType) {
                    const message =
                        `array index must be ${Helpers.BLUE}'number'${Helpers.RESET}, got ` +
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
                    type: objectType.elementType,
                    readonly: objectType.readonly === true,
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
                const expression = checkExpression(node.expression);

                return {
                    ...node,
                    expression,
                    type: expression?.type,
                };
            };

            const checkBinary = (node: any): any => {
                const left = checkExpression(node.left);
                const right = checkExpression(node.right);

                const leftType = left?.type;
                const rightType = right?.type;

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

                        if (symbol.mutable !== true) {
                            const message = `cannot assign to ${Helpers.RED}'${identifierName}'${Helpers.RESET} because it was declared as a ${Helpers.BLUE}'const'${Helpers.RESET}`;
                            left.arrowLength = identifierName?.length ?? 1;

                            this.throwError(
                                message,
                                left.position,
                                context.fullSource ?? node.fullSource ?? left.fullSource ?? left.source,
                                left,
                            );
                        }

                        const assignmentType = symbol.declaredType ?? symbol.type;

                        if (!this.isTypeAssignable(assignmentType, rightType)) {
                            const message =
                                `cannot assign value of type ${Helpers.RED}'${rightType?.raw}'${Helpers.RESET} to variable ` +
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

                if (!symbol) {
                    const message = `left side of assignment must start from a known variable`;
                    left.arrowLength = left.source?.length ?? 1;
                    this.throwError(message, left.position, context.fullSource ?? node.fullSource ?? node.source, left);
                }

                if (symbol.mutable !== true) {
                    const message =
                        `cannot mutate ${Helpers.RED}'${root}'${Helpers.RESET} because it was declared as a ` +
                        `${Helpers.BLUE}'const'${Helpers.RESET}`;

                    left.arrowLength = left.source?.length ?? 1;
                    this.throwError(message, left.position, context.fullSource ?? node.fullSource ?? node.source, left);
                }

                if (left.readonly === true || this.isReadonlyType(left.object?.type)) {
                    const message =
                        `cannot assign to ${Helpers.RED}'${left.source ?? "readonly member"}'${Helpers.RESET} because it is readonly`;

                    left.arrowLength = left.source?.length ?? 1;
                    this.throwError(message, left.position, context.fullSource ?? node.fullSource ?? node.source, left);
                }

                if (!this.isTypeAssignable(left.type, right.type)) {
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

                    if (!symbol || symbol.mutable !== true) {
                        const message =
                            `cannot mutate ${Helpers.RED}'${root ?? left.source}'${Helpers.RESET} because it is immutable`;

                        left.arrowLength = left.source?.length ?? 1;
                        this.throwError(message, left.position, source, left);
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

            return null;
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
