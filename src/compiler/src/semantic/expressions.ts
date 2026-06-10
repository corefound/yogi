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

                const isNumber = (type: any) => type?.kind === Kinds.Types.NumberType;
                const isString = (type: any) => type?.kind === Kinds.Types.StringType;
                const isBoolean = (type: any) => type?.kind === Kinds.Types.BooleanType;

                switch (node.operator) {
                    case "=": {
                        if (left.kind !== Kinds.Expressions.IdentifierExpression) {
                            const message = `left side of assignment must be a variable`;
                            node.arrowLength = node.left?.source?.length ?? 1;

                            this.throwError(
                                message,
                                node.position,
                                context.fullSource ?? node.fullSource ?? node.source,
                                node,
                            );
                        }

                        const symbol = this.resolveSymbol(left.value);

                        if (!symbol) {
                            const message = `cannot find name ${Helpers.RED}'${left.value}'${Helpers.RESET}`;
                            left.arrowLength = left.value.length;

                            this.throwError(
                                message,
                                left.position,
                                left.fullSource,
                                left,
                            );
                        }

                        if (symbol.mutable !== true) {
                            const message = `cannot assign to ${Helpers.RED}'${left.value}'${Helpers.RESET} because it was declared as a ${Helpers.BLUE}'const'${Helpers.RESET}`;

                            this.throwError(
                                message,
                                left.position,
                                left.fullSource,
                                left,
                            );
                        }

                        if (symbol.type?.kind !== rightType?.kind) {
                            const message =
                                `cannot assign value of type ${Helpers.RED}'${rightType?.raw}'${Helpers.RESET} to variable ` +
                                `${Helpers.RED}'${left.value}'${Helpers.RESET} of type ${Helpers.RED}'${symbol.type?.raw}'${Helpers.RESET}`;

                            this.throwError(
                                message,
                                right.position,
                                context.fullSource ?? node.fullSource ?? node.source,
                                node,
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
                        if (leftType?.kind === rightType?.kind) {
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