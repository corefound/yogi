import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";

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
                    return this.visitBigInt(node);

                case Kinds.Literals.RegularExpressionLiteral:
                    return this.visitRegularExpression(node);

                case Kinds.Literals.TemplateStringLiteral:
                    return this.visitTemplateString(node);

                case Kinds.Expressions.IdentifierExpression:
                    return this.visitBuiltinConstant(node);

                default:
                    return null;
            }
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
            return {
                kind: Kinds.Sir.BooleanConstant,
                type: { kind: Kinds.Types.BooleanType, raw: "boolean" },
                raw: node.raw ?? node.source,
                value: Boolean(node.value),
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
            switch (node.value) {
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
                raw: node.source,
                value: "undefined",
                source: node.source,
                position: node.position,
            };
        }

        public visitNaNConstant(node: any) {
            return {
                kind: Kinds.Sir.NaNConstant,
                type: {
                    kind: Kinds.Types.NumberType,
                    raw: "number"
                },
                raw: node.source,
                value: Number.NaN,
                source: node.source,
                position: node.position,
            };
        }

        public visitInfinity(node: any) {
            return {
                kind: Kinds.Sir.InfinityConstant,
                type: {
                    kind: Kinds.Types.NumberType,
                    raw: "number"
                },
                raw: node.source,
                value: Infinity,
                source: node.source,
                position: node.position,
            };
        }
    };
}