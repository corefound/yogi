import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function ConstantsSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {

        public visitConstants(node: any) {
            switch (node.kind) {
                case Kinds.Literals.NumberLiteral:
                    return this.visitNumber(node);

                case Kinds.Literals.StringLiteral:
                    return this.visitString(node);

                case Kinds.Literals.BooleanLiteral:
                    return this.visitBoolean(node);

                case Kinds.Literals.NullLiteral:
                    return this.visitNull(node);

                case Kinds.Literals.BigIntLiteral:
                    return this.visitUnsupportedLiteral(node, "bigint");

                case Kinds.Literals.RegularExpressionLiteral:
                    return this.visitUnsupportedLiteral(node, "RegExp");

                case Kinds.Literals.TemplateStringLiteral:
                    return this.visitTemplateString(node);

                case Kinds.Expressions.IdentifierExpression:
                    return this.visitBuiltinConstant(node);

                default:
                    return null;
            }
        }

        public visitIdentifier(node: any): any {
            const symbol = this.resolveSymbol(node.value);

            if (!symbol) {
                const message = `cannot find name ${node.value}`;

                node.arrowLength = node.value?.length ?? 1;

                this.throwError(
                    message,
                    node.position,
                    node.fullSource ?? node.source,
                    node,
                );
            }

            return {
                ...node,
                kind: Kinds.Expressions.IdentifierExpression,
                symbolId: symbol.id,
                scopeId: symbol.scopeId,
                type: symbol.type,
                mutable: symbol.mutable,
            };
        }

        public visitNumber(node: any) {
            return {
                kind: Kinds.Sir.NumberConstant,
                type: { kind: Kinds.Types.NumberType, raw: "number" },
                raw: node.raw ?? node.source,
                value: node.value,
                source: node.source,
                position: node.position,
            };
        }

        public visitString(node: any) {
            return {
                kind: Kinds.Sir.StringConstant,
                type: { kind: Kinds.Types.StringType, raw: "string" },
                raw: node.raw ?? node.source,
                value: node.value,
                source: node.source,
                position: node.position,
            };
        }

        public visitBoolean(node: any) {
            const value = node.value === true || node.value === "true";

            return {
                kind: Kinds.Sir.BooleanConstant,
                type: { kind: Kinds.Types.BooleanType, raw: "boolean" },
                raw: node.raw ?? node.source,
                value,
                source: node.source,
                position: node.position,
            };
        }

        public visitNull(node: any): any {
            return {
                kind: Kinds.Sir.NullConstant,
                type: { kind: Kinds.Types.NullType, raw: "null" },
                raw: node.raw ?? node.source,
                value: null,
                source: node.source,
                position: node.position,
            };
        }

        public visitBigInt(node: any) {
            const raw = node.raw ?? node.source;
            const normalized = String(raw).replace(/n$/, "");

            return {
                kind: Kinds.Sir.BigIntConstant,
                type: { kind: Kinds.Types.BigIntType, raw: "bigint" },
                raw,
                value: normalized,
                source: node.source,
                position: node.position,
            };
        }

        public visitRegularExpression(node: any) {
            const raw = node.raw ?? node.source;

            return {
                kind: Kinds.Sir.RegExpConstant,
                type: { kind: Kinds.Types.RegExpType, raw: "RegExp" },
                raw,
                value: raw,
                source: node.source,
                position: node.position,
            };
        }

        public visitTemplateString(node: any) {
            return {
                kind: Kinds.Sir.TemplateStringConstant,
                type: { kind: Kinds.Types.StringType, raw: "string" },
                raw: node.raw ?? node.source,
                value: node.value,
                source: node.source,
                position: node.position,
            };
        }

        public visitBuiltinConstant(node: any) {
            const name = node.value ?? node.name ?? node.raw;

            switch (name) {
                case "undefined":
                    return this.visitUndefinedConstant(node);

                case "NaN":
                    return this.visitNaNConstant(node);

                case "Infinity":
                    return this.visitInfinity(node);

                default:
                    return null;
            }
        }

        public visitUndefinedConstant(node: any): any {
            return {
                kind: Kinds.Sir.UndefinedConstant,
                type: { kind: Kinds.Types.UndefinedType, raw: "undefined" },
                raw: node.raw ?? node.source ?? "undefined",
                value: "undefined",
                source: node.source ?? "undefined",
                position: node.position,
            };
        }

        public visitNaNConstant(node: any) {
            return {
                kind: Kinds.Sir.NumberConstant,
                type: {
                    kind: Kinds.Types.NumberType,
                    raw: "number"
                },
                raw: node.raw ?? node.source ?? "NaN",
                value: Number.NaN,
                source: node.source ?? "NaN",
                position: node.position,
            };
        }

        public visitInfinity(node: any) {
            return {
                kind: Kinds.Sir.NumberConstant,
                type: {
                    kind: Kinds.Types.NumberType,
                    raw: "number"
                },
                raw: node.raw ?? node.source ?? "Infinity",
                value: Infinity,
                source: node.source ?? "Infinity",
                position: node.position,
            };
        }

        public visitUnsupportedLiteral(node: any, literalName: string): never {
            const raw = node.raw ?? node.source ?? literalName;
            const message =
                `${Helpers.RED}'${raw}'${Helpers.RESET} cannot be lowered to SIR yet`;

            node.arrowLength = raw.length || 1;

            this.throwError(
                message,
                node.position,
                node.fullSource ?? node.source ?? raw,
                node,
                `  = supported literal constants for SIR: number, string, boolean, null, undefined, NaN, Infinity`,
            );

            throw new Error(message);
        }
    };
}
