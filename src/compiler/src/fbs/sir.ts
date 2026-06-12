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
    VariableDeclaration,
    ReturnStatement,
    BlockStatement,
    IfStatement,
    FunctionDeclaration,
    FunctionParameter,
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

                case "VariableDeclaration": {
                    const value = this.createVariableDeclaration(builder, node);

                    return this.createSirNode(builder, SirNodeValue.VariableDeclaration, value);
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
            const kind = this.mapSemanticTypeKind(type?.kind);

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

                case "VoidType":
                    return TypeKind.void_type;

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

            if (!constant && !identifier) {
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
            const source = builder.createString(node.source ?? nameText);
            const position = this.createSourcePosition(builder, node.position);

            IdentifierExpression.startIdentifierExpression(builder);
            IdentifierExpression.addName(builder, name);
            IdentifierExpression.addType(builder, type);
            IdentifierExpression.addSymbolId(builder, node.symbolId ?? -1);
            IdentifierExpression.addScopeId(builder, node.scopeId ?? -1);
            IdentifierExpression.addSource(builder, source);
            IdentifierExpression.addPosition(builder, position);

            return IdentifierExpression.endIdentifierExpression(builder);
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
            VariableDeclaration.addLinkageName(builder, linkageName);
            VariableDeclaration.addQualifiedName(builder, qualifiedName);
            VariableDeclaration.addSource(builder, source);
            VariableDeclaration.addPosition(builder, position);

            return VariableDeclaration.endVariableDeclaration(builder);
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
