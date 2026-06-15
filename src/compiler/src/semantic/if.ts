import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function IfSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitControlFlow(node: any): any {
            switch (node.kind) {
                case Kinds.ControlFlow.IfStatement:
                    return this.visitIfStatement(node);

                case Kinds.Statements.BlockStatement:
                    return this.visitBlockStatement(node);

                case Kinds.ControlFlow.WhileStatement:
                    return this.visitWhileStatement(node);

                case Kinds.ControlFlow.ForStatement:
                    return this.visitForStatement(node);

                default:
                    return null;
            }
        }

        public visitIfStatement(node: any): any {
            const condition = this.visitNode(node.condition);

            if (!this.isBooleanType(condition?.type)) {
                const message =
                    `if condition must be of type ${Helpers.RED}'boolean'${Helpers.RESET}`;

                this.throwError(
                    message,
                    node.condition.position,
                    node.condition.fullSource ?? node.fullSource ?? node.source,
                    node.condition,
                );
            }

            const { thenNarrowings, elseNarrowings } = this.getEqualityNarrowings(condition);
            const beforeMoveState = this.captureMoveState();

            this.restoreMoveState(beforeMoveState);
            const thenBlock = this.withTemporaryNarrowings(
                thenNarrowings,
                () => this.visitIfBlockStatement(node.then),
            );
            const thenMoveState = this.blockAlwaysReturns(thenBlock)
                ? null
                : this.captureMoveState();

            this.restoreMoveState(beforeMoveState);
            const elseBlock = node.else
                ? this.withTemporaryNarrowings(
                    elseNarrowings,
                    () => this.visitIfBlockStatement(node.else),
                )
                : null;
            const elseMoveState = node.else
                ? this.blockAlwaysReturns(elseBlock)
                    ? null
                    : this.captureMoveState()
                : beforeMoveState;

            this.restoreMoveState(beforeMoveState);
            this.mergeMoveState(thenMoveState, elseMoveState);

            return {
                ...node,
                kind: Kinds.Statements.IfStatement,
                condition,
                then: thenBlock,
                else: elseBlock,
            };
        }

        public visitIfBlockStatement(node: any): any {
            return this.visitBlockStatement(node);
        }

        public visitBlockStatement(node: any): any {
            this.enterScope();
            const statements = [];

            for (const statement of node.statements ?? []) {
                const result = this.visitNode(statement);

                if (result === null || result === undefined) {
                    continue;
                }

                if (Array.isArray(result)) {
                    statements.push(...result);
                } else {
                    statements.push(result);
                }

                if (this.statementAlwaysReturns(result)) {
                    break;
                }
            }
            this.exitScope();

            return {
                ...node,
                kind: Kinds.Statements.BlockStatement,
                statements,
            };
        }

        public visitWhileStatement(node: any): any {
            const condition = this.visitNode(node.condition);

            if (!this.isBooleanType(condition?.type)) {
                const message =
                    `while condition must be of type ${Helpers.RED}'boolean'${Helpers.RESET}`;

                this.throwError(
                    message,
                    node.condition.position,
                    node.condition.fullSource ?? node.fullSource ?? node.source,
                    node.condition,
                );
            }

            return {
                ...node,
                kind: Kinds.Statements.WhileStatement,
                condition,
                body: this.visitBlockStatement(node.body),
            };
        }

        public visitForStatement(node: any): any {
            this.enterScope();

            const initializer = node.initializer ? this.visitNode(node.initializer) : null;
            const condition = node.condition ? this.visitNode(node.condition) : null;
            const incrementor = node.incrementor ? this.visitNode(node.incrementor) : null;

            if (condition && !this.isBooleanType(condition?.type)) {
                const message =
                    `for condition must be of type ${Helpers.RED}'boolean'${Helpers.RESET}`;

                this.throwError(
                    message,
                    node.condition.position,
                    node.condition.fullSource ?? node.fullSource ?? node.source,
                    node.condition,
                );
            }

            const body = this.visitBlockStatement(node.body);

            this.exitScope();

            return {
                ...node,
                kind: Kinds.Statements.ForStatement,
                initializer,
                condition,
                incrementor,
                body,
            };
        }

        public isBooleanType(type: any): boolean {
            if (!type) return false;

            return (
                type.kind === Kinds.Types.BooleanType ||
                type.raw === "boolean" ||
                type === "boolean"
            );
        }

        public getEqualityNarrowings(condition: any): any {
            const empty = { thenNarrowings: new Map<string, any>(), elseNarrowings: new Map<string, any>() };

            if (!condition || condition.kind !== Kinds.Expressions.BinaryExpression) {
                return empty;
            }

            if (!["==", "===", "!=", "!=="].includes(condition.operator)) {
                return empty;
            }

            const left = condition.left;
            const right = condition.right;
            const positive = condition.operator === "==" || condition.operator === "===";

            const pair = this.getIdentifierComparablePair(left, right) ??
                this.getIdentifierComparablePair(right, left);

            if (!pair) {
                return empty;
            }

            const symbol = this.resolveSymbol(pair.name);
            if (!symbol) {
                return empty;
            }

            const narrowed = this.narrowTypeTo(symbol.type, pair.type, false);
            const excluded = this.narrowTypeTo(symbol.type, pair.type, true);

            return {
                thenNarrowings: positive
                    ? new Map([[pair.name, narrowed]])
                    : new Map([[pair.name, excluded]]),
                elseNarrowings: positive
                    ? new Map([[pair.name, excluded]])
                    : new Map([[pair.name, narrowed]]),
            };
        }

        public getIdentifierComparablePair(left: any, right: any): any {
            if (left?.kind !== Kinds.Expressions.IdentifierExpression) {
                return null;
            }

            if (!right?.type) {
                return null;
            }

            return {
                name: left.value ?? left.name ?? left.raw,
                type: right.type,
            };
        }

        public narrowTypeTo(sourceType: any, targetType: any, exclude: boolean): any {
            const resolved = this.resolveType(sourceType);

            if (!resolved || resolved.kind !== Kinds.Types.UnionType) {
                return exclude ? sourceType : targetType;
            }

            const types = (resolved.types ?? []).filter((type: any) => {
                const comparable = this.areTypesComparable(type, targetType) ||
                    this.isTypeAssignable(type, targetType) ||
                    this.isTypeAssignable(targetType, type);

                return exclude ? !comparable : comparable;
            });

            if (types.length === 0) {
                return { kind: Kinds.Types.NeverType, raw: "never" };
            }

            if (types.length === 1) {
                return types[0];
            }

            return {
                ...resolved,
                types,
                raw: types.map((type: any) => type.raw ?? "unknown").join(" | "),
            };
        }

        public withTemporaryNarrowings<T>(narrowings: Map<string, any>, callback: () => T): T {
            const previous: Array<{ symbol: any; type: any }> = [];

            for (const [name, type] of narrowings) {
                const symbol = this.resolveSymbol(name);
                if (!symbol) continue;

                previous.push({ symbol, type: symbol.type });
                symbol.type = type;
            }

            try {
                return callback();
            } finally {
                for (const item of previous) {
                    item.symbol.type = item.type;
                }
            }
        }

        public statementAlwaysReturns(node: any): boolean {
            if (!node) return false;

            if (Array.isArray(node)) {
                return node.some((item: any) => this.statementAlwaysReturns(item));
            }

            if (node.kind === Kinds.Statements.ReturnStatement) {
                return true;
            }

            if (node.kind === Kinds.Statements.BlockStatement) {
                return this.blockAlwaysReturns(node);
            }

            if (node.kind === Kinds.Statements.IfStatement) {
                return this.blockAlwaysReturns(node.then) &&
                    node.else &&
                    this.blockAlwaysReturns(node.else);
            }

            return false;
        }

        public blockAlwaysReturns(node: any): boolean {
            const statements = node?.statements ?? [];

            if (!Array.isArray(statements) || statements.length === 0) {
                return false;
            }

            return statements.some((statement: any) => this.statementAlwaysReturns(statement));
        }
    };
}
