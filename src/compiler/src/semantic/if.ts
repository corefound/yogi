import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function IfSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
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
            this.enterScope();
            const statements = [];

            for (const statement of node.statements ?? []) {
                statements.push(this.visitNode(statement));
            }
            this.exitScope();

            return {
                ...node,
                kind: Kinds.Statements.BlockStatement,
                statements,
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