import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function ExpressionsSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
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
                    case "=": {
                        if (left.kind !== Kinds.Expressions.IdentifierExpression) {
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

                        if (!this.isTypeAssignable(symbol.type, rightType)) {
                            const message =
                                `cannot assign value of type ${Helpers.RED}'${rightType?.raw}'${Helpers.RESET} to variable ` +
                                `${Helpers.RED}'${identifierName}'${Helpers.RESET} of type ${Helpers.RED}'${symbol.type?.raw}'${Helpers.RESET}`;

                            right.arrowLength = right.source?.length ?? right.raw?.length ?? 1;

                            this.throwError(
                                message,
                                right.position,
                                context.fullSource ?? node.fullSource ?? node.source,
                                right,
                            );
                        }

                        return {
                            ...node,
                            kind: Kinds.Expressions.AssignmentExpression,
                            left: {
                                ...left,
                                symbolId: symbol.id,
                                scopeId: symbol.scopeId,
                                type: symbol.type,
                                mutable: symbol.mutable,
                                linkageName: symbol.linkageName ?? null,
                                qualifiedName: symbol.qualifiedName,
                            },
                            right,
                            type: symbol.type,
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

            return checkExpression(context.value);
        }
    };
}
