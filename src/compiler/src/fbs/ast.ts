import { BaseFlatBuffer, Constructor, createVector } from "./base";
import * as fbs from "flatbuffers";

import {
    AstArray,
    AstField,
    AstNode,
    AstValue,
    Module,
    SourcePosition,
} from "./generated/yogi/ast";

const NODE_METADATA_FIELDS = new Set([
    "kind",
    "source",
    "fullSource",
    "raw",
    "position",
]);

export function AstFlatBuffer<TBase extends Constructor<BaseFlatBuffer>>(base: TBase) {
    return class extends base {
        static createAstModuleBuffer(input: { sourcePath: string; nodes: any[] }): Uint8Array {
            const builder = new fbs.Builder(1024);
            const sourcePath = builder.createString(input.sourcePath);
            const nodeOffsets = (input.nodes ?? []).map((node) => {
                return this.createAstNode(builder, node);
            });
            const nodes = createVector(builder, nodeOffsets, (length) => {
                Module.startNodesVector(builder, length);
            });

            Module.startModule(builder);
            Module.addSourcePath(builder, sourcePath);
            Module.addNodes(builder, nodes);

            const module = Module.endModule(builder);

            builder.finish(module);

            return builder.asUint8Array();
        }

        static createAstNode(builder: fbs.Builder, node: any): fbs.Offset {
            const kind = builder.createString(String(node?.kind ?? "UnknownNode"));
            const source = builder.createString(node?.source ?? node?.fullSource ?? "");
            const raw = builder.createString(node?.raw ?? node?.source ?? "");
            const position = this.createAstSourcePosition(builder, node?.position);
            const fieldOffsets = Object.entries(node ?? {})
                .filter(([name]) => !NODE_METADATA_FIELDS.has(name))
                .filter(([, value]) => value !== undefined)
                .map(([name, value]) => this.createAstField(builder, name, value));
            const fields = createVector(builder, fieldOffsets, (length) => {
                AstNode.startFieldsVector(builder, length);
            });

            AstNode.startAstNode(builder);
            AstNode.addKind(builder, kind);
            AstNode.addFields(builder, fields);
            AstNode.addSource(builder, source);
            AstNode.addRaw(builder, raw);
            AstNode.addPosition(builder, position);

            return AstNode.endAstNode(builder);
        }

        static createAstField(builder: fbs.Builder, name: string, value: any): fbs.Offset {
            const fieldName = builder.createString(name);
            const fieldValue = this.createAstValue(builder, value);

            AstField.startAstField(builder);
            AstField.addName(builder, fieldName);
            AstField.addValue(builder, fieldValue);

            return AstField.endAstField(builder);
        }

        static createAstValue(builder: fbs.Builder, value: any): fbs.Offset {
            if (value === null) {
                return this.createScalarAstValue(builder, "null", { isNull: true });
            }

            if (Array.isArray(value)) {
                const valueOffsets = value.map((item) => this.createAstValue(builder, item));
                const values = createVector(builder, valueOffsets, (length) => {
                    AstArray.startValuesVector(builder, length);
                });

                AstArray.startAstArray(builder);
                AstArray.addValues(builder, values);
                const array = AstArray.endAstArray(builder);
                const kind = builder.createString("array");

                AstValue.startAstValue(builder);
                AstValue.addKind(builder, kind);
                AstValue.addArray(builder, array);

                return AstValue.endAstValue(builder);
            }

            if (typeof value === "object") {
                const node = this.createAstNode(builder, value);
                const kind = builder.createString("node");

                AstValue.startAstValue(builder);
                AstValue.addKind(builder, kind);
                AstValue.addNode(builder, node);

                return AstValue.endAstValue(builder);
            }

            if (typeof value === "number") {
                return this.createScalarAstValue(builder, "number", { numberValue: value });
            }

            if (typeof value === "boolean") {
                return this.createScalarAstValue(builder, "boolean", { boolValue: value });
            }

            return this.createScalarAstValue(builder, "string", {
                stringValue: String(value),
            });
        }

        static createScalarAstValue(
            builder: fbs.Builder,
            kindValue: string,
            value: { stringValue?: string; numberValue?: number; boolValue?: boolean; isNull?: boolean },
        ): fbs.Offset {
            const kind = builder.createString(kindValue);
            const stringValue = value.stringValue !== undefined
                ? builder.createString(value.stringValue)
                : 0;

            AstValue.startAstValue(builder);
            AstValue.addKind(builder, kind);

            if (stringValue) {
                AstValue.addStringValue(builder, stringValue);
            }

            if (value.numberValue !== undefined) {
                AstValue.addNumberValue(builder, value.numberValue);
            }

            if (value.boolValue !== undefined) {
                AstValue.addBoolValue(builder, value.boolValue);
            }

            if (value.isNull) {
                AstValue.addIsNull(builder, true);
            }

            return AstValue.endAstValue(builder);
        }

        static createAstSourcePosition(builder: fbs.Builder, position: any): fbs.Offset {
            SourcePosition.startSourcePosition(builder);
            SourcePosition.addLine(builder, position?.line ?? 0);
            SourcePosition.addCharacter(builder, position?.character ?? 0);

            return SourcePosition.endSourcePosition(builder);
        }
    };
}
