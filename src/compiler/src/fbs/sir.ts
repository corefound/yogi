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
    ValueRef,
    IdentifierExpression,
    BinaryExpression,
    AssignmentExpression,
    ConditionalExpression,
    CallExpression,
    CallArgumentEffect,
    ArrayExpression,
    ObjectExpression,
    ObjectProperty,
    PropertyAccessExpression,
    ElementAccessExpression,
    AggregateAssignmentExpression,
    VariableDeclaration,
    ArrayDeclaration,
    ReturnStatement,
    BlockStatement,
    IfStatement,
    WhileStatement,
    ForStatement,
    BreakStatement,
    ContinueStatement,
    FunctionDeclaration,
    FunctionParameter,
    FunctionEffectSummary,
    ParameterEffect,
    ExternDeclaration,
    ExternFunction,
    ExternParameter,
    ExternVariable,
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

                    return this.createSirNode(builder, SirNodeValue.Constant, value);
                }

                case "ExternDeclaration": {
                    const value = this.createExternDeclaration(builder, node);

                    return this.createSirNode(builder, SirNodeValue.ExternDeclaration, value);
                }

                case "IdentifierExpression": {
                    const value = this.createIdentifierExpression(builder, node);

                    return this.createSirNode(builder, SirNodeValue.IdentifierExpression, value);
                }

                case "BinaryExpression": {
                    const value = this.createBinaryExpression(builder, node);

                    return this.createSirNode(builder, SirNodeValue.BinaryExpression, value);
                }

                case "AssignmentExpression": {
                    const value = this.createAssignmentExpression(builder, node);

                    return this.createSirNode(builder, SirNodeValue.AssignmentExpression, value);
                }

                case "ConditionalExpression": {
                    const value = this.createConditionalExpression(builder, node);

                    return this.createSirNode(builder, SirNodeValue.ConditionalExpression, value);
                }

                case "CallExpression": {
                    const value = this.createCallExpression(builder, node);

                    return this.createSirNode(builder, SirNodeValue.CallExpression, value);
                }

                case "ArrayExpression": {
                    const value = this.createArrayExpression(builder, node);

                    return this.createSirNode(builder, SirNodeValue.ArrayExpression, value);
                }

                case "DictionaryExpression": {
                    const value = this.createObjectExpression(builder, node);

                    return this.createSirNode(builder, SirNodeValue.ObjectExpression, value);
                }

                case "PropertyAccessExpression": {
                    const value = this.createPropertyAccessExpression(builder, node);

                    return this.createSirNode(builder, SirNodeValue.PropertyAccessExpression, value);
                }

                case "ElementAccessExpression": {
                    const value = this.createElementAccessExpression(builder, node);

                    return this.createSirNode(builder, SirNodeValue.ElementAccessExpression, value);
                }

                case "AggregateAssignmentExpression": {
                    const value = this.createAggregateAssignmentExpression(builder, node);

                    return this.createSirNode(builder, SirNodeValue.AggregateAssignmentExpression, value);
                }

                case "VariableDeclaration": {
                    const value = this.createVariableDeclaration(builder, node);

                    return this.createSirNode(builder, SirNodeValue.VariableDeclaration, value);
                }

                case "ArrayDeclaration": {
                    const value = this.createArrayDeclaration(builder, node);

                    return this.createSirNode(builder, SirNodeValue.ArrayDeclaration, value);
                }

                case "ReturnStatement": {
                    const value = this.createReturnStatement(builder, node);

                    return this.createSirNode(builder, SirNodeValue.ReturnStatement, value);
                }

                case "BlockStatement": {
                    const value = this.createBlockStatement(builder, node);

                    return this.createSirNode(builder, SirNodeValue.BlockStatement, value);
                }

                case "IfStatement": {
                    const value = this.createIfStatement(builder, node);

                    return this.createSirNode(builder, SirNodeValue.IfStatement, value);
                }

                case "WhileStatement": {
                    const value = this.createWhileStatement(builder, node);

                    return this.createSirNode(builder, SirNodeValue.WhileStatement, value);
                }

                case "ForStatement": {
                    const value = this.createForStatement(builder, node);

                    return this.createSirNode(builder, SirNodeValue.ForStatement, value);
                }

                case "BreakStatement": {
                    const value = this.createBreakStatement(builder, node);

                    return this.createSirNode(builder, SirNodeValue.BreakStatement, value);
                }

                case "ContinueStatement": {
                    const value = this.createContinueStatement(builder, node);

                    return this.createSirNode(builder, SirNodeValue.ContinueStatement, value);
                }

                case "FunctionDeclaration": {
                    const value = this.createFunctionDeclaration(builder, node);

                    return this.createSirNode(builder, SirNodeValue.FunctionDeclaration, value);
                }

                default: {
                    throw new Error(
                        `Unsupported semantic node kind: ${(node as { kind: string }).kind}`,
                    );
                }
            }
        }

        static createSirNode(
            builder: fbs.Builder,
            valueType: SirNodeValue,
            value: fbs.Offset,
        ): fbs.Offset {
            SirNode.startSirNode(builder);
            SirNode.addValueType(builder, valueType);
            SirNode.addValue(builder, value);

            return SirNode.endSirNode(builder);
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
            const raw = builder.createString(type?.raw ?? "unknown");
            const nameText = this.getTypeRefName(type);
            const name = builder.createString(nameText);
            const kind = this.mapSemanticTypeKind(type?.kind);
            const typeChildren = this.getTypeRefChildren(type);
            const typeOffsets = typeChildren.map((child) => this.createTypeRef(builder, child));
            const types = createVector(builder, typeOffsets, (length) => {
                TypeRef.startTypesVector(builder, length);
            });
            const elementType = type?.elementType
                ? this.createTypeRef(builder, type.elementType)
                : 0;
            const resolved = type?.resolved
                ? this.createTypeRef(builder, type.resolved)
                : 0;

            TypeRef.startTypeRef(builder);
            TypeRef.addKind(builder, kind);
            TypeRef.addRaw(builder, raw);
            TypeRef.addName(builder, name);

            if (typeOffsets.length) {
                TypeRef.addTypes(builder, types);
            }

            if (elementType) {
                TypeRef.addElementType(builder, elementType);
            }

            if (resolved) {
                TypeRef.addResolved(builder, resolved);
            }

            return TypeRef.endTypeRef(builder);
        }

        static getTypeRefName(type: Types.Sir.SemanticType): string {
            const name = (type as any)?.name ?? (type as any)?.nameText;

            if (!name) return "";

            if (typeof name === "string") return name;

            if (Array.isArray(name.parts)) {
                return name.parts
                    .map((part: any) => part.name ?? part.value ?? part.raw ?? "")
                    .join(".");
            }

            return name.name ?? name.value ?? name.raw ?? "";
        }

        static getTypeRefChildren(type: Types.Sir.SemanticType): Types.Sir.SemanticType[] {
            if (!type) return [];

            if (Array.isArray((type as any).types)) {
                return (type as any).types;
            }

            if (Array.isArray((type as any).elements)) {
                return (type as any).elements;
            }

            return [];
        }

        static mapSemanticTypeKind(kind: Types.Sir.SemanticType["kind"]): TypeKind {
            switch (kind) {
                case "AnyType":
                    return TypeKind.any_type;

                case "UnknownType":
                    return TypeKind.unknown_type;

                case "NeverType":
                    return TypeKind.never_type;

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

                case "VoidType":
                    return TypeKind.void_type;

                case "UnionType":
                    return TypeKind.union_type;

                case "IntersectionType":
                    return TypeKind.intersection_type;

                case "TypeReference":
                    return TypeKind.type_reference;

                case "ArrayType":
                    return TypeKind.array_type;

                case "TupleType":
                    return TypeKind.tuple_type;

                case "FunctionType":
                    return TypeKind.function_type;

                case "TypeLiteral":
                    return TypeKind.type_literal;

                default:
                    return TypeKind.unknown;
            }
        }

        static createSourcePosition(
            builder: fbs.Builder,
            position: Types.Sir.SourcePosition,
        ): fbs.Offset {
            SourcePosition.startSourcePosition(builder);
            SourcePosition.addLine(builder, position?.line ?? 0);
            SourcePosition.addCharacter(builder, position?.character ?? 0);

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

        static createValueRef(builder: fbs.Builder, node: Types.Sir.SemanticValueInput | null): fbs.Offset {
            if (!node) {
                ValueRef.startValueRef(builder);

                return ValueRef.endValueRef(builder);
            }

            const kind = builder.createString(node.kind);
            const constant = this.isSemanticConstant(node)
                ? this.visitSemanticConstant(builder, node)
                : 0;
            const identifier = node.kind === "IdentifierExpression"
                ? this.createIdentifierExpression(builder, node)
                : 0;
            const binary = node.kind === "BinaryExpression"
                ? this.createBinaryExpression(builder, node)
                : 0;
            const assignment = node.kind === "AssignmentExpression"
                ? this.createAssignmentExpression(builder, node)
                : 0;
            const conditional = node.kind === "ConditionalExpression"
                ? this.createConditionalExpression(builder, node)
                : 0;
            const call = node.kind === "CallExpression"
                ? this.createCallExpression(builder, node)
                : 0;
            const array = node.kind === "ArrayExpression"
                ? this.createArrayExpression(builder, node)
                : 0;
            const object = node.kind === "DictionaryExpression"
                ? this.createObjectExpression(builder, node)
                : 0;
            const propertyAccess = node.kind === "PropertyAccessExpression"
                ? this.createPropertyAccessExpression(builder, node)
                : 0;
            const elementAccess = node.kind === "ElementAccessExpression"
                ? this.createElementAccessExpression(builder, node)
                : 0;
            const aggregateAssignment = node.kind === "AggregateAssignmentExpression"
                ? this.createAggregateAssignmentExpression(builder, node)
                : 0;

            if (
                !constant &&
                !identifier &&
                !binary &&
                !assignment &&
                !conditional &&
                !call &&
                !array &&
                !object &&
                !propertyAccess &&
                !elementAccess &&
                !aggregateAssignment
            ) {
                throw new Error(`Unsupported semantic value kind: ${(node as { kind: string }).kind}`);
            }

            ValueRef.startValueRef(builder);
            ValueRef.addKind(builder, kind);

            if (constant) {
                ValueRef.addConstant(builder, constant);
            }

            if (identifier) {
                ValueRef.addIdentifier(builder, identifier);
            }

            if (binary) {
                ValueRef.addBinary(builder, binary);
            }

            if (assignment) {
                ValueRef.addAssignment(builder, assignment);
            }

            if (conditional) {
                ValueRef.addConditional(builder, conditional);
            }

            if (call) {
                ValueRef.addCall(builder, call);
            }

            if (array) {
                ValueRef.addArray(builder, array);
            }

            if (object) {
                ValueRef.addObject(builder, object);
            }

            if (propertyAccess) {
                ValueRef.addPropertyAccess(builder, propertyAccess);
            }

            if (elementAccess) {
                ValueRef.addElementAccess(builder, elementAccess);
            }

            if (aggregateAssignment) {
                ValueRef.addAggregateAssignment(builder, aggregateAssignment);
            }

            return ValueRef.endValueRef(builder);
        }

        static isSemanticConstant(node: any): node is Types.Sir.SemanticConstantInput {
            return (
                node?.kind === "NumberConstant" ||
                node?.kind === "StringConstant" ||
                node?.kind === "BooleanConstant" ||
                node?.kind === "NullConstant" ||
                node?.kind === "UndefinedConstant"
            );
        }

        static createIdentifierExpression(
            builder: fbs.Builder,
            node: Types.Sir.SemanticIdentifierExpression,
        ): fbs.Offset {
            const nameText = node.name ?? node.value ?? node.raw ?? node.source ?? "";
            const name = builder.createString(nameText);
            const type = this.createTypeRef(builder, node.type);
            const linkageName = builder.createString(node.linkageName ?? "");
            const qualifiedName = builder.createString(node.qualifiedName ?? "");
            const source = builder.createString(node.source ?? nameText);
            const position = this.createSourcePosition(builder, node.position);

            IdentifierExpression.startIdentifierExpression(builder);
            IdentifierExpression.addName(builder, name);
            IdentifierExpression.addType(builder, type);
            IdentifierExpression.addSymbolId(builder, node.symbolId ?? -1);
            IdentifierExpression.addScopeId(builder, node.scopeId ?? -1);
            IdentifierExpression.addLinkageName(builder, linkageName);
            IdentifierExpression.addQualifiedName(builder, qualifiedName);
            IdentifierExpression.addSource(builder, source);
            IdentifierExpression.addPosition(builder, position);

            return IdentifierExpression.endIdentifierExpression(builder);
        }

        static createBinaryExpression(
            builder: fbs.Builder,
            expression: Types.Sir.SemanticBinaryExpression,
        ): fbs.Offset {
            const operator = builder.createString(expression.operator);
            const left = this.createValueRef(builder, expression.left);
            const right = this.createValueRef(builder, expression.right);
            const type = this.createTypeRef(builder, expression.type);
            const source = builder.createString(expression.source ?? "");
            const position = this.createSourcePosition(builder, expression.position);

            BinaryExpression.startBinaryExpression(builder);
            BinaryExpression.addOperator(builder, operator);
            BinaryExpression.addLeft(builder, left);
            BinaryExpression.addRight(builder, right);
            BinaryExpression.addType(builder, type);
            BinaryExpression.addSource(builder, source);
            BinaryExpression.addPosition(builder, position);

            return BinaryExpression.endBinaryExpression(builder);
        }

        static createAssignmentExpression(
            builder: fbs.Builder,
            expression: Types.Sir.SemanticAssignmentExpression,
        ): fbs.Offset {
            const left = this.createIdentifierExpression(builder, expression.left);
            const right = this.createValueRef(builder, expression.right);
            const type = this.createTypeRef(builder, expression.type);
            const source = builder.createString(expression.source ?? "");
            const position = this.createSourcePosition(builder, expression.position);

            AssignmentExpression.startAssignmentExpression(builder);
            AssignmentExpression.addLeft(builder, left);
            AssignmentExpression.addRight(builder, right);
            AssignmentExpression.addType(builder, type);
            AssignmentExpression.addSource(builder, source);
            AssignmentExpression.addPosition(builder, position);

            return AssignmentExpression.endAssignmentExpression(builder);
        }

        static createConditionalExpression(
            builder: fbs.Builder,
            expression: Types.Sir.SemanticConditionalExpression,
        ): fbs.Offset {
            const condition = this.createValueRef(builder, expression.condition);
            const whenTrue = this.createValueRef(builder, expression.whenTrue);
            const whenFalse = this.createValueRef(builder, expression.whenFalse);
            const type = this.createTypeRef(builder, expression.type);
            const source = builder.createString(expression.source ?? "");
            const position = this.createSourcePosition(builder, expression.position);

            ConditionalExpression.startConditionalExpression(builder);
            ConditionalExpression.addCondition(builder, condition);
            ConditionalExpression.addWhenTrue(builder, whenTrue);
            ConditionalExpression.addWhenFalse(builder, whenFalse);
            ConditionalExpression.addType(builder, type);
            ConditionalExpression.addSource(builder, source);
            ConditionalExpression.addPosition(builder, position);

            return ConditionalExpression.endConditionalExpression(builder);
        }

        /**
         * Serializes a semantic call expression to FBS format.
         * 
         * Key fields:
         * - callee: the function/method being called
         * - arguments: array of argument value references
         * - argumentEffects: describes how each argument is used (escapes, mutates, consumes)
         * - type: the return type of the call
         * - builtinMethod: identifier for built-in array methods (e.g., "array.push", "array.pop", "array.at")
         *   - Allows runtime identification of built-in method calls for special handling
         *   - Empty string for regular function calls
         * - external: whether this calls an external/imported function
         */
        static createCallExpression(
            builder: fbs.Builder,
            expression: Types.Sir.SemanticCallExpression,
        ): fbs.Offset {
            const callee = this.createValueRef(builder, expression.callee);
            const argumentOffsets = (expression.arguments ?? []).map((argument) => this.createValueRef(builder, argument));
            const argumentsVector = createVector(builder, argumentOffsets, (length) => {
                CallExpression.startArgumentsVector(builder, length);
            });
            const argumentEffectOffsets = (expression.argumentEffects ?? []).map((effect) => {
                return CallArgumentEffect.createCallArgumentEffect(
                    builder,
                    effect.index,
                    effect.escapes,
                    effect.mutates,
                    effect.consumes,
                );
            });
            const argumentEffectsVector = createVector(builder, argumentEffectOffsets, (length) => {
                CallExpression.startArgumentEffectsVector(builder, length);
            });
            const type = this.createTypeRef(builder, expression.type);
            const linkageName = builder.createString(expression.linkageName ?? "");
            const qualifiedName = builder.createString(expression.qualifiedName ?? "");
            const builtinMethod = builder.createString(expression.builtinMethod ?? "");
            const source = builder.createString(expression.source ?? "");
            const position = this.createSourcePosition(builder, expression.position);

            CallExpression.startCallExpression(builder);
            CallExpression.addCallee(builder, callee);
            CallExpression.addArguments(builder, argumentsVector);
            CallExpression.addArgumentEffects(builder, argumentEffectsVector);
            CallExpression.addType(builder, type);
            CallExpression.addSymbolId(builder, expression.symbolId ?? -1);
            CallExpression.addLinkageName(builder, linkageName);
            CallExpression.addQualifiedName(builder, qualifiedName);
            CallExpression.addExternal(builder, expression.external ?? false);
            CallExpression.addBuiltinMethod(builder, builtinMethod);
            CallExpression.addSource(builder, source);
            CallExpression.addPosition(builder, position);

            return CallExpression.endCallExpression(builder);
        }

        static createArrayExpression(
            builder: fbs.Builder,
            expression: Types.Sir.SemanticArrayExpression,
        ): fbs.Offset {
            const elementOffsets = (expression.elements ?? []).map((element) => this.createValueRef(builder, element));
            const elements = createVector(builder, elementOffsets, (length) => {
                ArrayExpression.startElementsVector(builder, length);
            });
            const type = this.createTypeRef(builder, expression.type);
            const source = builder.createString(expression.source ?? "");
            const position = this.createSourcePosition(builder, expression.position);

            ArrayExpression.startArrayExpression(builder);
            ArrayExpression.addElements(builder, elements);
            ArrayExpression.addType(builder, type);
            ArrayExpression.addSource(builder, source);
            ArrayExpression.addPosition(builder, position);

            return ArrayExpression.endArrayExpression(builder);
        }

        static createObjectProperty(
            builder: fbs.Builder,
            property: Types.Sir.SemanticObjectProperty,
        ): fbs.Offset {
            const key = builder.createString(property.key);
            const value = this.createValueRef(builder, property.value);
            const type = this.createTypeRef(builder, property.type);
            const source = builder.createString(property.source ?? property.key);
            const position = this.createSourcePosition(builder, property.position);

            ObjectProperty.startObjectProperty(builder);
            ObjectProperty.addKey(builder, key);
            ObjectProperty.addValue(builder, value);
            ObjectProperty.addType(builder, type);
            ObjectProperty.addSource(builder, source);
            ObjectProperty.addPosition(builder, position);

            return ObjectProperty.endObjectProperty(builder);
        }

        static createObjectExpression(
            builder: fbs.Builder,
            expression: Types.Sir.SemanticObjectExpression,
        ): fbs.Offset {
            const propertyOffsets = (expression.properties ?? []).map((property) => {
                return this.createObjectProperty(builder, property);
            });
            const properties = createVector(builder, propertyOffsets, (length) => {
                ObjectExpression.startPropertiesVector(builder, length);
            });
            const type = this.createTypeRef(builder, expression.type);
            const source = builder.createString(expression.source ?? "");
            const position = this.createSourcePosition(builder, expression.position);

            ObjectExpression.startObjectExpression(builder);
            ObjectExpression.addProperties(builder, properties);
            ObjectExpression.addType(builder, type);
            ObjectExpression.addSource(builder, source);
            ObjectExpression.addPosition(builder, position);

            return ObjectExpression.endObjectExpression(builder);
        }

        static createPropertyAccessExpression(
            builder: fbs.Builder,
            expression: Types.Sir.SemanticPropertyAccessExpression,
        ): fbs.Offset {
            const object = this.createValueRef(builder, expression.object);
            const property = builder.createString(expression.property);
            const type = this.createTypeRef(builder, expression.type);
            const source = builder.createString(expression.source ?? "");
            const position = this.createSourcePosition(builder, expression.position);

            PropertyAccessExpression.startPropertyAccessExpression(builder);
            PropertyAccessExpression.addObject(builder, object);
            PropertyAccessExpression.addProperty(builder, property);
            PropertyAccessExpression.addType(builder, type);
            PropertyAccessExpression.addSource(builder, source);
            PropertyAccessExpression.addPosition(builder, position);

            return PropertyAccessExpression.endPropertyAccessExpression(builder);
        }

        static createElementAccessExpression(
            builder: fbs.Builder,
            expression: Types.Sir.SemanticElementAccessExpression,
        ): fbs.Offset {
            const object = this.createValueRef(builder, expression.object);
            const index = this.createValueRef(builder, expression.index);
            const type = this.createTypeRef(builder, expression.type);
            const source = builder.createString(expression.source ?? "");
            const position = this.createSourcePosition(builder, expression.position);

            ElementAccessExpression.startElementAccessExpression(builder);
            ElementAccessExpression.addObject(builder, object);
            ElementAccessExpression.addIndex(builder, index);
            ElementAccessExpression.addType(builder, type);
            ElementAccessExpression.addSource(builder, source);
            ElementAccessExpression.addPosition(builder, position);

            return ElementAccessExpression.endElementAccessExpression(builder);
        }

        static createAggregateAssignmentExpression(
            builder: fbs.Builder,
            expression: Types.Sir.SemanticAggregateAssignmentExpression,
        ): fbs.Offset {
            const target = this.createValueRef(builder, expression.target);
            const right = this.createValueRef(builder, expression.right);
            const type = this.createTypeRef(builder, expression.type);
            const source = builder.createString(expression.source ?? "");
            const position = this.createSourcePosition(builder, expression.position);

            AggregateAssignmentExpression.startAggregateAssignmentExpression(builder);
            AggregateAssignmentExpression.addTarget(builder, target);
            AggregateAssignmentExpression.addRight(builder, right);
            AggregateAssignmentExpression.addType(builder, type);
            AggregateAssignmentExpression.addSource(builder, source);
            AggregateAssignmentExpression.addPosition(builder, position);

            return AggregateAssignmentExpression.endAggregateAssignmentExpression(builder);
        }

        static createVariableDeclaration(
            builder: fbs.Builder,
            declaration: Types.Sir.SemanticVariableDeclaration,
        ): fbs.Offset {
            const name = builder.createString(declaration.name);
            const type = this.createTypeRef(builder, declaration.type);
            const value = this.createValueRef(builder, declaration.value);
            const storage = builder.createString(declaration.storage ?? "");
            const flag = builder.createString(declaration.flag ?? "");
            const linkageName = builder.createString(declaration.linkageName ?? "");
            const qualifiedName = builder.createString(declaration.qualifiedName ?? "");
            const source = builder.createString(declaration.source ?? declaration.name);
            const position = this.createSourcePosition(builder, declaration.position);

            VariableDeclaration.startVariableDeclaration(builder);
            VariableDeclaration.addName(builder, name);
            VariableDeclaration.addType(builder, type);
            VariableDeclaration.addValue(builder, value);
            VariableDeclaration.addSymbolId(builder, declaration.symbolId ?? -1);
            VariableDeclaration.addScopeId(builder, declaration.scopeId ?? -1);
            VariableDeclaration.addMutable(builder, declaration.mutable ?? false);
            VariableDeclaration.addStorage(builder, storage);
            VariableDeclaration.addFlag(builder, flag);
            VariableDeclaration.addExported(builder, declaration.export ?? false);
            VariableDeclaration.addTrusted(builder, declaration.trusted ?? true);
            VariableDeclaration.addEscapes(builder, declaration.escapes ?? false);
            VariableDeclaration.addLinkageName(builder, linkageName);
            VariableDeclaration.addQualifiedName(builder, qualifiedName);
            VariableDeclaration.addSource(builder, source);
            VariableDeclaration.addPosition(builder, position);

            return VariableDeclaration.endVariableDeclaration(builder);
        }

        static createArrayDeclaration(
            builder: fbs.Builder,
            declaration: Types.Sir.SemanticArrayDeclaration,
        ): fbs.Offset {
            const name = builder.createString(declaration.name);
            const type = this.createTypeRef(builder, declaration.type);
            const elementOffsets = (declaration.elements ?? []).map((element) => this.createValueRef(builder, element));
            const elementsVector = createVector(builder, elementOffsets, (length) => {
                ArrayDeclaration.startElementsVector(builder, length);
            });
            const storage = builder.createString(declaration.storage ?? "");
            const flag = builder.createString(declaration.flag ?? "");
            const linkageName = builder.createString(declaration.linkageName ?? "");
            const qualifiedName = builder.createString(declaration.qualifiedName ?? "");
            const source = builder.createString(declaration.source ?? declaration.name);
            const position = this.createSourcePosition(builder, declaration.position);

            ArrayDeclaration.startArrayDeclaration(builder);
            ArrayDeclaration.addName(builder, name);
            ArrayDeclaration.addType(builder, type);
            ArrayDeclaration.addElements(builder, elementsVector);
            ArrayDeclaration.addSymbolId(builder, declaration.symbolId ?? -1);
            ArrayDeclaration.addScopeId(builder, declaration.scopeId ?? -1);
            ArrayDeclaration.addMutable(builder, declaration.mutable ?? false);
            ArrayDeclaration.addStorage(builder, storage);
            ArrayDeclaration.addFlag(builder, flag);
            ArrayDeclaration.addExported(builder, declaration.export ?? false);
            ArrayDeclaration.addTrusted(builder, declaration.trusted ?? true);
            ArrayDeclaration.addEscapes(builder, declaration.escapes ?? false);
            ArrayDeclaration.addLinkageName(builder, linkageName);
            ArrayDeclaration.addQualifiedName(builder, qualifiedName);
            ArrayDeclaration.addSource(builder, source);
            ArrayDeclaration.addPosition(builder, position);

            return ArrayDeclaration.endArrayDeclaration(builder);
        }

        static createReturnStatement(
            builder: fbs.Builder,
            statement: Types.Sir.SemanticReturnStatement,
        ): fbs.Offset {
            const value = this.createValueRef(builder, statement.value);
            const source = builder.createString(statement.source ?? "return");
            const position = this.createSourcePosition(builder, statement.position);

            ReturnStatement.startReturnStatement(builder);
            ReturnStatement.addValue(builder, value);
            ReturnStatement.addSource(builder, source);
            ReturnStatement.addPosition(builder, position);

            return ReturnStatement.endReturnStatement(builder);
        }

        static createBlockStatement(
            builder: fbs.Builder,
            block: Types.Sir.SemanticBlockStatement,
        ): fbs.Offset {
            const statementOffsets = (block.statements ?? []).map((statement) => {
                return this.visitSemanticNode(builder, statement);
            });

            const statementsVector = createVector(builder, statementOffsets, (length) => {
                BlockStatement.startStatementsVector(builder, length);
            });

            const source = builder.createString(block.source ?? "");
            const position = this.createSourcePosition(builder, block.position);

            BlockStatement.startBlockStatement(builder);
            BlockStatement.addStatements(builder, statementsVector);
            BlockStatement.addSource(builder, source);
            BlockStatement.addPosition(builder, position);

            return BlockStatement.endBlockStatement(builder);
        }

        static createIfStatement(
            builder: fbs.Builder,
            statement: Types.Sir.SemanticIfStatement,
        ): fbs.Offset {
            const condition = this.createValueRef(builder, statement.condition);
            const thenBlock = this.createBlockStatement(builder, statement.then);
            const elseBlock = statement.else
                ? this.createBlockStatement(builder, statement.else)
                : 0;
            const source = builder.createString(statement.source ?? "");
            const position = this.createSourcePosition(builder, statement.position);

            IfStatement.startIfStatement(builder);
            IfStatement.addCondition(builder, condition);
            IfStatement.addThenBlock(builder, thenBlock);

            if (elseBlock) {
                IfStatement.addElseBlock(builder, elseBlock);
            }

            IfStatement.addSource(builder, source);
            IfStatement.addPosition(builder, position);

            return IfStatement.endIfStatement(builder);
        }

        static createWhileStatement(
            builder: fbs.Builder,
            statement: Types.Sir.SemanticWhileStatement,
        ): fbs.Offset {
            const condition = this.createValueRef(builder, statement.condition);
            const body = this.createBlockStatement(builder, statement.body);
            const source = builder.createString(statement.source ?? "");
            const position = this.createSourcePosition(builder, statement.position);

            WhileStatement.startWhileStatement(builder);
            WhileStatement.addCondition(builder, condition);
            WhileStatement.addBody(builder, body);
            WhileStatement.addSource(builder, source);
            WhileStatement.addPosition(builder, position);

            return WhileStatement.endWhileStatement(builder);
        }

        static createForStatement(
            builder: fbs.Builder,
            statement: Types.Sir.SemanticForStatement,
        ): fbs.Offset {
            const initializer = statement.initializer
                ? this.visitSemanticNode(builder, statement.initializer)
                : 0;
            const condition = this.createValueRef(builder, statement.condition ?? null);
            const incrementor = this.createValueRef(builder, statement.incrementor ?? null);
            const body = this.createBlockStatement(builder, statement.body);
            const source = builder.createString(statement.source ?? "");
            const position = this.createSourcePosition(builder, statement.position);

            ForStatement.startForStatement(builder);

            if (initializer) {
                ForStatement.addInitializer(builder, initializer);
            }

            ForStatement.addCondition(builder, condition);
            ForStatement.addIncrementor(builder, incrementor);
            ForStatement.addBody(builder, body);
            ForStatement.addSource(builder, source);
            ForStatement.addPosition(builder, position);

            return ForStatement.endForStatement(builder);
        }

        static createBreakStatement(
            builder: fbs.Builder,
            statement: Types.Sir.SemanticBreakStatement,
        ): fbs.Offset {
            const source = builder.createString(statement.source ?? "break");
            const position = this.createSourcePosition(builder, statement.position);

            BreakStatement.startBreakStatement(builder);
            BreakStatement.addSource(builder, source);
            BreakStatement.addPosition(builder, position);

            return BreakStatement.endBreakStatement(builder);
        }

        static createContinueStatement(
            builder: fbs.Builder,
            statement: Types.Sir.SemanticContinueStatement,
        ): fbs.Offset {
            const source = builder.createString(statement.source ?? "continue");
            const position = this.createSourcePosition(builder, statement.position);

            ContinueStatement.startContinueStatement(builder);
            ContinueStatement.addSource(builder, source);
            ContinueStatement.addPosition(builder, position);

            return ContinueStatement.endContinueStatement(builder);
        }

        static createFunctionParameter(
            builder: fbs.Builder,
            parameter: Types.Sir.SemanticFunctionParameter,
        ): fbs.Offset {
            const name = builder.createString(parameter.name);
            const type = this.createTypeRef(builder, parameter.type);
            const storage = builder.createString(parameter.storage ?? "");
            const source = builder.createString(parameter.source ?? parameter.name);
            const position = this.createSourcePosition(builder, parameter.position);

            FunctionParameter.startFunctionParameter(builder);
            FunctionParameter.addName(builder, name);
            FunctionParameter.addType(builder, type);
            FunctionParameter.addSymbolId(builder, parameter.symbolId ?? -1);
            FunctionParameter.addScopeId(builder, parameter.scopeId ?? -1);
            FunctionParameter.addMutable(builder, parameter.mutable ?? true);
            FunctionParameter.addStorage(builder, storage);
            FunctionParameter.addTrusted(builder, parameter.trusted ?? true);
            FunctionParameter.addSource(builder, source);
            FunctionParameter.addPosition(builder, position);

            return FunctionParameter.endFunctionParameter(builder);
        }

        static createParameterEffect(
            builder: fbs.Builder,
            effect: Types.Sir.SemanticParameterEffect,
        ): fbs.Offset {
            return ParameterEffect.createParameterEffect(
                builder,
                effect.index,
                effect.returns,
                effect.stores,
                effect.escapes,
                effect.mutates,
                effect.consumes,
            );
        }

        static createFunctionEffectSummary(
            builder: fbs.Builder,
            summary?: Types.Sir.SemanticFunctionEffectSummary,
        ): fbs.Offset {
            const effects = summary?.parameterEffects ?? [];
            const effectOffsets = effects.map((effect) => this.createParameterEffect(builder, effect));
            const effectsVector = createVector(builder, effectOffsets, (length) => {
                FunctionEffectSummary.startParameterEffectsVector(builder, length);
            });

            FunctionEffectSummary.startFunctionEffectSummary(builder);
            FunctionEffectSummary.addParameterEffects(builder, effectsVector);
            FunctionEffectSummary.addReturnsAggregate(builder, summary?.returnsAggregate ?? false);

            return FunctionEffectSummary.endFunctionEffectSummary(builder);
        }

        static createFunctionDeclaration(
            builder: fbs.Builder,
            declaration: Types.Sir.SemanticFunctionDeclaration,
        ): fbs.Offset {
            const name = builder.createString(declaration.name);
            const returnType = this.createTypeRef(builder, declaration.returnType);
            const body = this.createBlockStatement(builder, declaration.body);
            const flagName = typeof declaration.flag === "string"
                ? declaration.flag
                : declaration.flag?.name;
            const flag = builder.createString(flagName ?? "");
            const linkageName = builder.createString(declaration.linkageName ?? "");
            const qualifiedName = builder.createString(declaration.qualifiedName ?? "");
            const source = builder.createString(declaration.source ?? declaration.name);
            const position = this.createSourcePosition(builder, declaration.position);
            const effectSummary = this.createFunctionEffectSummary(builder, declaration.effectSummary);

            const parameterOffsets = (declaration.params ?? []).map((parameter) => {
                return this.createFunctionParameter(builder, parameter);
            });

            const parametersVector = createVector(builder, parameterOffsets, (length) => {
                FunctionDeclaration.startParametersVector(builder, length);
            });

            FunctionDeclaration.startFunctionDeclaration(builder);
            FunctionDeclaration.addName(builder, name);
            FunctionDeclaration.addParameters(builder, parametersVector);
            FunctionDeclaration.addReturnType(builder, returnType);
            FunctionDeclaration.addBody(builder, body);
            FunctionDeclaration.addSymbolId(builder, declaration.symbolId ?? -1);
            FunctionDeclaration.addScopeId(builder, declaration.scopeId ?? -1);
            FunctionDeclaration.addMutable(builder, declaration.mutable ?? false);
            FunctionDeclaration.addFlag(builder, flag);
            FunctionDeclaration.addExported(builder, declaration.export ?? false);
            FunctionDeclaration.addTrusted(builder, declaration.trusted ?? true);
            FunctionDeclaration.addLinkageName(builder, linkageName);
            FunctionDeclaration.addQualifiedName(builder, qualifiedName);
            FunctionDeclaration.addSource(builder, source);
            FunctionDeclaration.addPosition(builder, position);
            FunctionDeclaration.addEffectSummary(builder, effectSummary);

            return FunctionDeclaration.endFunctionDeclaration(builder);
        }

        static createExternDeclaration(
            builder: fbs.Builder,
            declaration: Types.Sir.SemanticExternDeclaration,
        ): fbs.Offset {
            const name = builder.createString(declaration.name);
            const externPath = builder.createString(declaration.path);
            const source = builder.createString(declaration.source);
            const position = this.createSourcePosition(builder, declaration.position);

            const functionOffsets = declaration.functions.map((fn) => {
                return this.createExternFunction(builder, fn);
            });

            const variableOffsets = declaration.variables.map((variable) => {
                return this.createExternVariable(builder, variable);
            });

            const functionsVector = createVector(builder, functionOffsets, (length) => {
                ExternDeclaration.startFunctionsVector(builder, length);
            });

            const variablesVector = createVector(builder, variableOffsets, (length) => {
                ExternDeclaration.startVariablesVector(builder, length);
            });

            ExternDeclaration.startExternDeclaration(builder);
            ExternDeclaration.addName(builder, name);
            ExternDeclaration.addPath(builder, externPath);
            ExternDeclaration.addFunctions(builder, functionsVector);
            ExternDeclaration.addVariables(builder, variablesVector);
            ExternDeclaration.addSource(builder, source);
            ExternDeclaration.addPosition(builder, position);

            return ExternDeclaration.endExternDeclaration(builder);
        }

        static createExternFunction(
            builder: fbs.Builder,
            fn: Types.Sir.SemanticExternFunction,
        ): fbs.Offset {
            const name = builder.createString(fn.name);
            const source = builder.createString(fn.source);
            const returnType = this.createTypeRef(builder, fn.returnType);
            const position = this.createSourcePosition(builder, fn.position);

            const parameterOffsets = fn.parameters.map((parameter) => {
                return this.createExternParameter(builder, parameter);
            });

            const parametersVector = createVector(builder, parameterOffsets, (length) => {
                ExternFunction.startParametersVector(builder, length);
            });

            ExternFunction.startExternFunction(builder);
            ExternFunction.addName(builder, name);
            ExternFunction.addParameters(builder, parametersVector);
            ExternFunction.addReturnType(builder, returnType);
            ExternFunction.addOptional(builder, fn.optional);
            ExternFunction.addSource(builder, source);
            ExternFunction.addPosition(builder, position);

            return ExternFunction.endExternFunction(builder);
        }

        static createExternParameter(
            builder: fbs.Builder,
            parameter: Types.Sir.SemanticExternParameter,
        ): fbs.Offset {
            const name = builder.createString(parameter.name);
            const type = this.createTypeRef(builder, parameter.type);
            const position = this.createSourcePosition(builder, parameter.position);

            ExternParameter.startExternParameter(builder);
            ExternParameter.addName(builder, name);
            ExternParameter.addType(builder, type);
            ExternParameter.addOptional(builder, parameter.optional);
            ExternParameter.addRest(builder, parameter.rest);
            ExternParameter.addPosition(builder, position);

            return ExternParameter.endExternParameter(builder);
        }

        static createExternVariable(
            builder: fbs.Builder,
            variable: Types.Sir.SemanticExternVariable,
        ): fbs.Offset {
            const name = builder.createString(variable.name);
            const type = this.createTypeRef(builder, variable.type);
            const source = builder.createString(variable.source);
            const position = this.createSourcePosition(builder, variable.position);

            ExternVariable.startExternVariable(builder);
            ExternVariable.addName(builder, name);
            ExternVariable.addType(builder, type);
            ExternVariable.addReadonly(builder, variable.readonly);
            ExternVariable.addSource(builder, source);
            ExternVariable.addPosition(builder, position);

            return ExternVariable.endExternVariable(builder);
        }
    };
}
