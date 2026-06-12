import { BaseFlatBuffer, Constructor, createVector } from "./base";
import * as fbs from "flatbuffers";

import { Types } from "../helpers/types";

import {
    Module,
    SirNode,
    SirNodeValue,
    Constant,
    ConstantValue,
    NumberConstant,
    StringConstant,
    BooleanConstant,
    NullConstant,
    UndefinedConstant,
    SourcePosition,
    TypeRef,
    TypeKind,
} from "./generated/yogi/sir";

export function SirFlatBuffer<TBase extends Constructor<BaseFlatBuffer>>(base: TBase) {
    return class extends base {
        static createSirModuleBuffer(input: Types.Sir.SemanticModuleInput): Uint8Array {
            const builder = new fbs.Builder(1024);

            const sourcePath = builder.createString(input.sourcePath);

            const nodeOffsets = input.nodes.map((node) => {
                return this.visitSemanticNode(builder, node);
            });

            const nodesVector = createVector(builder, nodeOffsets, (length) => {
                Module.startNodesVector(builder, length);
            });

            Module.startModule(builder);
            Module.addSourcePath(builder, sourcePath);
            Module.addNodes(builder, nodesVector);

            const module = Module.endModule(builder);

            builder.finish(module);

            return builder.asUint8Array();
        }

        static visitSemanticNode(
            builder: fbs.Builder,
            node: Types.Sir.SemanticNodeInput,
        ): fbs.Offset {
            switch (node.kind) {
                case "NumberConstant":
                case "StringConstant":
                case "BooleanConstant":
                case "NullConstant":
                case "UndefinedConstant": {
                    const value = this.visitSemanticConstant(builder, node);

                    SirNode.startSirNode(builder);
                    SirNode.addValueType(builder, SirNodeValue.Constant);
                    SirNode.addValue(builder, value);

                    return SirNode.endSirNode(builder);
                }

                default: {
                    throw new Error(
                        `Unsupported semantic node kind: ${(node as { kind: string }).kind}`,
                    );
                }
            }
        }

        static visitSemanticConstant(
            builder: fbs.Builder,
            constant: Types.Sir.SemanticConstantInput,
        ): fbs.Offset {
            switch (constant.kind) {
                case "NumberConstant": {
                    const value = this.createNumberConstant(builder, constant.value);

                    return this.createConstantWrapper(
                        builder,
                        constant,
                        ConstantValue.NumberConstant,
                        value,
                    );
                }

                case "StringConstant": {
                    const value = this.createStringConstant(builder, constant.value);

                    return this.createConstantWrapper(
                        builder,
                        constant,
                        ConstantValue.StringConstant,
                        value,
                    );
                }

                case "BooleanConstant": {
                    const value = this.createBooleanConstant(builder, constant.value);

                    return this.createConstantWrapper(
                        builder,
                        constant,
                        ConstantValue.BooleanConstant,
                        value,
                    );
                }

                case "NullConstant": {
                    const value = this.createNullConstant(builder);

                    return this.createConstantWrapper(
                        builder,
                        constant,
                        ConstantValue.NullConstant,
                        value,
                    );
                }

                case "UndefinedConstant": {
                    const value = this.createUndefinedConstant(builder);

                    return this.createConstantWrapper(
                        builder,
                        constant,
                        ConstantValue.UndefinedConstant,
                        value,
                    );
                }

                default: {
                    throw new Error(
                        `Unsupported semantic constant kind: ${(constant as { kind: string }).kind}`,
                    );
                }
            }
        }

        static createConstantWrapper(
            builder: fbs.Builder,
            constant: Types.Sir.SemanticConstantInput,
            valueType: ConstantValue,
            value: fbs.Offset,
        ): fbs.Offset {
            const type = this.createTypeRef(builder, constant.type);
            const raw = builder.createString(constant.raw);
            const source = builder.createString(constant.source);
            const position = this.createSourcePosition(builder, constant.position);

            Constant.startConstant(builder);
            Constant.addType(builder, type);
            Constant.addRaw(builder, raw);
            Constant.addSource(builder, source);
            Constant.addPosition(builder, position);
            Constant.addValueType(builder, valueType);
            Constant.addValue(builder, value);

            return Constant.endConstant(builder);
        }

        static createTypeRef(builder: fbs.Builder, type: Types.Sir.SemanticType): fbs.Offset {
            const raw = builder.createString(type.raw);
            const kind = this.mapSemanticTypeKind(type.kind);

            TypeRef.startTypeRef(builder);
            TypeRef.addKind(builder, kind);
            TypeRef.addRaw(builder, raw);

            return TypeRef.endTypeRef(builder);
        }

        static mapSemanticTypeKind(kind: Types.Sir.SemanticType["kind"]): TypeKind {
            switch (kind) {
                case "NumberType":
                    return TypeKind.number_type;

                case "StringType":
                    return TypeKind.string_type;

                case "BooleanType":
                    return TypeKind.boolean_type;

                case "NullType":
                    return TypeKind.null_type;

                case "UndefinedType":
                    return TypeKind.undefined_type;

                default:
                    return TypeKind.unknown;
            }
        }

        static createSourcePosition(
            builder: fbs.Builder,
            position: Types.Sir.SourcePosition,
        ): fbs.Offset {
            SourcePosition.startSourcePosition(builder);
            SourcePosition.addLine(builder, position.line);
            SourcePosition.addCharacter(builder, position.character);

            return SourcePosition.endSourcePosition(builder);
        }

        static createNumberConstant(builder: fbs.Builder, value: number): fbs.Offset {
            NumberConstant.startNumberConstant(builder);
            NumberConstant.addValue(builder, value);

            return NumberConstant.endNumberConstant(builder);
        }

        static createStringConstant(builder: fbs.Builder, value: string): fbs.Offset {
            const valueOffset = builder.createString(value);

            StringConstant.startStringConstant(builder);
            StringConstant.addValue(builder, valueOffset);

            return StringConstant.endStringConstant(builder);
        }

        static createBooleanConstant(builder: fbs.Builder, value: boolean): fbs.Offset {
            BooleanConstant.startBooleanConstant(builder);
            BooleanConstant.addValue(builder, value);

            return BooleanConstant.endBooleanConstant(builder);
        }

        static createNullConstant(builder: fbs.Builder): fbs.Offset {
            NullConstant.startNullConstant(builder);

            return NullConstant.endNullConstant(builder);
        }

        static createUndefinedConstant(builder: fbs.Builder): fbs.Offset {
            UndefinedConstant.startUndefinedConstant(builder);

            return UndefinedConstant.endUndefinedConstant(builder);
        }
    };
}