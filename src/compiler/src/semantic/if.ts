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

            const thenBlock = this.visitIfBlockStatement(node.then);

            const elseBlock = node.else
                ? this.visitIfBlockStatement(node.else)
                : null;

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
    };
}
