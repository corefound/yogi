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

                case Kinds.ControlFlow.BreakStatement:
                    return this.visitBreakStatement(node);

                case Kinds.ControlFlow.ContinueStatement:
                    return this.visitContinueStatement(node);

                case Kinds.ControlFlow.SwitchStatement:
                    return this.visitSwitchStatement(node);

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

                if (this.statementTerminatesBlock(result)) {
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

            const beforeMoveState = this.captureMoveState();

            this.loopDepth++;
            this.restoreMoveState(beforeMoveState);
            const body = this.visitBlockStatement(node.body);
            const bodyMoveState = this.blockAlwaysReturns(body)
                ? null
                : this.captureMoveState();
            this.loopDepth--;

            this.restoreMoveState(beforeMoveState);
            this.mergeMoveState(bodyMoveState);

            return {
                ...node,
                kind: Kinds.Statements.WhileStatement,
                condition,
                body,
            };
        }

        public visitForStatement(node: any): any {
            this.enterScope();

            const visitedInitializer = node.initializer ? this.visitNode(node.initializer) : null;
            const initializer = Array.isArray(visitedInitializer)
                ? {
                    kind: Kinds.Statements.BlockStatement,
                    statements: visitedInitializer,
                    source: node.initializer?.source,
                    position: node.initializer?.position,
                }
                : visitedInitializer;
            const condition = node.condition ? this.visitNode(node.condition) : null;

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

            const beforeBodyMoveState = this.captureMoveState();
            this.loopDepth++;
            this.restoreMoveState(beforeBodyMoveState);
            const body = this.visitBlockStatement(node.body);
            const bodyMoveState = this.blockAlwaysReturns(body)
                ? null
                : this.captureMoveState();
            let incrementor = null;

            if (bodyMoveState) {
                this.restoreMoveState(bodyMoveState);
                incrementor = node.incrementor ? this.visitNode(node.incrementor) : null;
            } else {
                this.restoreMoveState(beforeBodyMoveState);
                incrementor = node.incrementor ? this.visitNode(node.incrementor) : null;
            }

            const afterIterationMoveState = this.captureMoveState();
            this.loopDepth--;

            this.restoreMoveState(beforeBodyMoveState);
            this.mergeMoveState(afterIterationMoveState);
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

        public visitBreakStatement(node: any): any {
            if (this.loopDepth <= 0 && this.switchDepth <= 0) {
                const message = `${Helpers.RED}'break'${Helpers.RESET} can only be used inside a loop or switch`;
                node.arrowLength = node.source?.length ?? 5;
                this.throwError(message, node.position, node.source ?? "break", node);
            }

            return {
                ...node,
                kind: Kinds.Statements.BreakStatement,
            };
        }

        public visitContinueStatement(node: any): any {
            if (this.loopDepth <= 0) {
                const message = `${Helpers.RED}'continue'${Helpers.RESET} can only be used inside a loop`;
                node.arrowLength = node.source?.length ?? 8;
                this.throwError(message, node.position, node.source ?? "continue", node);
            }

            return {
                ...node,
                kind: Kinds.Statements.ContinueStatement,
            };
        }

        public visitSwitchStatement(node: any): any {
            const expression = this.visitNode(node.expression);

            if (!this.isNumberType(expression?.type)) {
                const message =
                    `switch expression must be of type ${Helpers.RED}'number'${Helpers.RESET}`;
                this.throwError(
                    message,
                    node.expression.position,
                    node.expression.fullSource ?? node.fullSource ?? node.source,
                    node.expression,
                );
            }

            let hasDefault = false;
            const visitedClauses = [];
            const beforeMoveState = this.captureMoveState();
            const previousSwitchBodyDeclClause = this.switchBodyDeclClause;
            const previousSwitchBodyCurrentClause = this.switchBodyCurrentClause;
            const previousSwitchBodyScopeId = this.switchBodyScopeId;
            const previousSwitchBodyKnownEntryClause = this.switchBodyKnownEntryClause;
            let afterState: Map<number, any> = beforeMoveState;

            // Shared scope for the entire switch body (JS/TS-compatible)
            this.enterScope();
            const switchBodyScopeId = this.getCurrentScopeId();

            try {
                // Track switch-body variable declarations per clause for definite-assignment checking
                const switchVarDecls = new Map<string, number>();
                this.switchBodyDeclClause = switchVarDecls;
                this.switchBodyScopeId = switchBodyScopeId;
                const clauseList = node.cases ?? [];
                const numClauses = clauseList.length;
                this.switchBodyKnownEntryClause = this.findKnownSwitchEntryClause(
                    expression,
                    clauseList,
                );

                // Pre-collect variable declarations for each clause
                for (let clauseIdx = 0; clauseIdx < numClauses; clauseIdx++) {
                    const clause = clauseList[clauseIdx];
                    this.collectClauseVarDeclarations(clause, clauseIdx, switchVarDecls);
                }

                for (let clauseIdx = 0; clauseIdx < numClauses; clauseIdx++) {
                    const clause = clauseList[clauseIdx];
                    this.switchBodyCurrentClause = clauseIdx;

                    if (clause.kind === Kinds.ControlFlow.DefaultClause) {
                        if (hasDefault) {
                            const message = `${Helpers.RED}A switch statement can only have one default clause${Helpers.RESET}`;
                            this.throwError(
                                message,
                                clause.position,
                                clause.source ?? "default",
                                clause,
                            );
                        }
                        hasDefault = true;
                    }

                    const visitedClause = this.visitSwitchClause(clause);
                    visitedClauses.push(visitedClause);
                }

                afterState = this.captureMoveState();
            } finally {
                this.switchBodyDeclClause = previousSwitchBodyDeclClause;
                this.switchBodyCurrentClause = previousSwitchBodyCurrentClause;
                this.switchBodyScopeId = previousSwitchBodyScopeId;
                this.switchBodyKnownEntryClause = previousSwitchBodyKnownEntryClause;
                this.exitScope();
            }

            this.restoreMoveState(beforeMoveState);
            this.mergeMoveState(afterState);

            return {
                ...node,
                kind: Kinds.Statements.SwitchStatement,
                expression,
                clauses: visitedClauses,
            };
        }

        public visitSwitchClause(clause: any): any {
            if (clause.kind === Kinds.ControlFlow.CaseClause) {
                const expression = this.visitNode(clause.expression);

                if (!this.isNumberType(expression?.type)) {
                    const message =
                        `case expression must be of type ${Helpers.RED}'number'${Helpers.RESET}`;
                    this.throwError(
                        message,
                        clause.expression.position,
                        clause.expression.fullSource ?? clause.source,
                        clause.expression,
                    );
                }

                this.switchDepth++;
                const statements = this.visitClauseStatements(clause.statements ?? []);
                this.switchDepth--;

                return {
                    ...clause,
                    kind: Kinds.Statements.CaseClause,
                    expression,
                    body: {
                        kind: Kinds.Statements.BlockStatement,
                        statements,
                    },
                };
            }

            this.switchDepth++;
            const statements = this.visitClauseStatements(clause.statements ?? []);
            this.switchDepth--;

            return {
                ...clause,
                kind: Kinds.Statements.DefaultClause,
                body: {
                    kind: Kinds.Statements.BlockStatement,
                    statements,
                },
            };
        }

        // Process clause statements within the shared switch scope (no enterScope/exitScope)
        public visitClauseStatements(statements: any[]): any[] {
            const visited = [];

            for (const statement of statements) {
                const result = this.visitNode(statement);

                if (result === null || result === undefined) {
                    continue;
                }

                if (Array.isArray(result)) {
                    visited.push(...result);
                } else {
                    visited.push(result);
                }

                if (this.statementTerminatesBlock(result)) {
                    break;
                }
            }

            return visited;
        }

        // Collect variable declarations from a clause's statements for switch fall-through
        // definite assignment checking. Only collects declarations directly in the clause
        // body (not inside nested blocks, which have their own scope).
        public collectClauseVarDeclarations(clause: any, clauseIndex: number, decls: Map<string, number>): void {
            for (const statement of clause.statements ?? []) {
                this.collectVarDeclarations(statement, clauseIndex, decls);
            }
        }

        public collectVarDeclarations(statement: any, clauseIndex: number, decls: Map<string, number>): void {
            if (!statement) return;

            // Blocks have their own scope - variables inside are not in the switch scope
            if (statement.kind === Kinds.Statements.BlockStatement) {
                return;
            }

            if (statement.kind === Kinds.Statements.DeclarationStatement) {
                for (const decl of statement.declarations ?? []) {
                    const name = typeof decl.name === "string"
                        ? decl.name
                        : decl.name?.value ?? decl.name?.name ?? decl.name?.text;
                    if (name && !decls.has(name)) {
                        decls.set(name, clauseIndex);
                    }
                }
                return;
            }

            // For if/while/for/switch - do not recurse into bodies (conservative:
            // skip internal declarations rather than risk false positives from shadowing)
            if (
                statement.kind === Kinds.ControlFlow.IfStatement ||
                statement.kind === Kinds.ControlFlow.WhileStatement ||
                statement.kind === Kinds.ControlFlow.ForStatement ||
                statement.kind === Kinds.ControlFlow.SwitchStatement
            ) {
                return;
            }
        }

        public findKnownSwitchEntryClause(expression: any, clauses: any[]): number | null {
            const switchValue = this.knownNumberLiteralValue(expression);

            if (switchValue === null) {
                return null;
            }

            let defaultIndex: number | null = null;

            for (let index = 0; index < clauses.length; index++) {
                const clause = clauses[index];

                if (clause.kind === Kinds.ControlFlow.DefaultClause) {
                    defaultIndex = index;
                    continue;
                }

                if (this.knownNumberLiteralValue(clause.expression) === switchValue) {
                    return index;
                }
            }

            return defaultIndex;
        }

        public knownNumberLiteralValue(node: any): number | null {
            if (!node) {
                return null;
            }

            if (
                typeof node.value === "number" &&
                (
                    node.kind === Kinds.Literals.NumberLiteral ||
                    node.kind === Kinds.Sir.NumberConstant
                )
            ) {
                return node.value;
            }

            return null;
        }

        public isNumberType(type: any): boolean {
            if (!type) return false;

            return (
                type.kind === Kinds.Types.NumberType ||
                type.raw === "number" ||
                type === "number"
            );
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

            if (node.kind === Kinds.Statements.SwitchStatement) {
                return this.switchAlwaysReturns(node.clauses ?? []);
            }

            return false;
        }

        public statementTerminatesBlock(node: any): boolean {
            if (!node) return false;

            if (Array.isArray(node)) {
                return node.some((item: any) => this.statementTerminatesBlock(item));
            }

            if (node.kind === Kinds.Statements.SwitchStatement) {
                return this.switchAlwaysReturns(node.clauses ?? []);
            }

            return (
                this.statementAlwaysReturns(node) ||
                node.kind === Kinds.Statements.BreakStatement ||
                node.kind === Kinds.Statements.ContinueStatement ||
                (
                    node.kind === Kinds.Statements.IfStatement &&
                    this.blockTerminates(node.then) &&
                    node.else &&
                    this.blockTerminates(node.else)
                )
            );
        }

        public blockAlwaysReturns(node: any): boolean {
            const statements = node?.statements ?? [];

            if (!Array.isArray(statements) || statements.length === 0) {
                return false;
            }

            return statements.some((statement: any) => this.statementAlwaysReturns(statement));
        }

        public blockTerminates(node: any): boolean {
            const statements = node?.statements ?? [];

            if (!Array.isArray(statements) || statements.length === 0) {
                return false;
            }

            return statements.some((statement: any) => this.statementTerminatesBlock(statement));
        }

        public switchAlwaysReturns(clauses: any[]): boolean {
            if (!Array.isArray(clauses) || clauses.length === 0) {
                return false;
            }

            const hasDefault = clauses.some(
                (clause: any) => clause.kind === Kinds.ControlFlow.DefaultClause,
            );

            if (!hasDefault) {
                return false;
            }

            return clauses.every((_: any, entryIndex: number) =>
                this.switchEntryAlwaysReturns(clauses, entryIndex),
            );
        }

        public switchEntryAlwaysReturns(clauses: any[], entryIndex: number): boolean {
            for (let index = entryIndex; index < clauses.length; index++) {
                const body = clauses[index]?.body;

                if (this.blockAlwaysReturns(body)) {
                    return true;
                }

                if (this.blockTerminates(body)) {
                    return false;
                }
            }

            return false;
        }
    };
}
