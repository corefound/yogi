import ts from "../ts";
import { BaseVisitor, Constructor } from "./base";
import { Kinds } from "../helpers/types";

export function TypesVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        visitTypes(node: ts.Node) {
            if (ts.isTypeAliasDeclaration(node)) {
                return this.visitTypeAliasDeclaration(node);
            }

            if (ts.isInterfaceDeclaration(node)) {
                return this.visitInterfaceDeclaration(node);
            }
            return null;

        }

        visitType(node?: ts.TypeNode): any {
            if (!node) {
                return {
                    kind: Kinds.Types.UnTyped,
                    raw: null,
                };
            }

            switch (node.kind) {
                case ts.SyntaxKind.AnyKeyword:
                    return {
                        kind: Kinds.Types.AnyType,
                        raw: "any",
                        position: this.getNodePosistion(node),
                    };

                case ts.SyntaxKind.UnknownKeyword:
                    return {
                        kind: Kinds.Types.UnknownType,
                        raw: "unknown",
                        position: this.getNodePosistion(node),
                    };

                case ts.SyntaxKind.NeverKeyword:
                    return {
                        kind: Kinds.Types.NeverType,
                        raw: "never",
                        position: this.getNodePosistion(node),
                    };

                case ts.SyntaxKind.NumberKeyword:
                    return {
                        kind: Kinds.Types.NumberType,
                        raw: "number",
                        position: this.getNodePosistion(node),
                    };

                case ts.SyntaxKind.StringKeyword:
                    return {
                        kind: Kinds.Types.StringType,
                        raw: "string",
                        position: this.getNodePosistion(node),
                    };

                case ts.SyntaxKind.BooleanKeyword:
                    return {
                        kind: Kinds.Types.BooleanType,
                        raw: "boolean",
                        position: this.getNodePosistion(node),
                    };

                case ts.SyntaxKind.VoidKeyword:
                    return {
                        kind: Kinds.Types.VoidType,
                        raw: "void",
                        position: this.getNodePosistion(node),
                    };

                case ts.SyntaxKind.NullKeyword:
                    return {
                        kind: Kinds.Types.NullType,
                        raw: "null",
                        position: this.getNodePosistion(node),
                    };

                case ts.SyntaxKind.UndefinedKeyword:
                    return {
                        kind: Kinds.Types.UndefinedType,
                        raw: "undefined",
                        position: this.getNodePosistion(node),
                    };

                case ts.SyntaxKind.LiteralType: {
                    const literal = node as ts.LiteralTypeNode;

                    return {
                        kind: Kinds.Types.LiteralType,
                        literal: literal.literal.getText(),
                        raw: literal.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.TypeReference: {
                    const ref = node as ts.TypeReferenceNode;

                    return {
                        kind: Kinds.Types.TypeReference,
                        name: ref.typeName.getText(),
                        typeArguments:
                            ref.typeArguments?.map((arg: ts.TypeNode) =>
                                this.visitType(arg)
                            ) ?? [],
                        raw: ref.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.ArrayType: {
                    const arr = node as ts.ArrayTypeNode;

                    return {
                        kind: Kinds.Types.ArrayType,
                        elementType: this.visitType(arr.elementType),
                        raw: arr.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.TupleType: {
                    const tuple = node as ts.TupleTypeNode;

                    return {
                        kind: Kinds.Types.TupleType,
                        elements: tuple.elements.map((el: ts.TypeNode) =>
                            this.visitType(el)
                        ),
                        raw: tuple.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.UnionType: {
                    const union = node as ts.UnionTypeNode;

                    return {
                        kind: Kinds.Types.UnionType,
                        types: union.types.map((t: ts.TypeNode) =>
                            this.visitType(t)
                        ),
                        raw: union.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.IntersectionType: {
                    const intersection = node as ts.IntersectionTypeNode;

                    return {
                        kind: Kinds.Types.IntersectionType,
                        types: intersection.types.map((t: ts.TypeNode) =>
                            this.visitType(t)
                        ),
                        raw: intersection.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.FunctionType: {
                    const fn = node as ts.FunctionTypeNode;

                    return {
                        kind: Kinds.Types.FunctionType,
                        parameters: fn.parameters.map((param: ts.ParameterDeclaration) => ({
                            name: param.name.getText(),
                            type: this.visitType(param.type),
                            optional: !!param.questionToken,
                            defaultValue: param.initializer
                                ? this.visitNode(param.initializer)
                                : null,
                            position: this.getNodePosistion(param),
                        })),
                        returnType: this.visitType(fn.type),
                        raw: fn.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.TypeOperator: {
                    const op = node as ts.TypeOperatorNode;

                    return {
                        kind: Kinds.Types.TypeOperator,
                        operator: ts.tokenToString(op.operator),
                        target: this.visitType(op.type),
                        raw: op.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.TypeQuery: {
                    const query = node as ts.TypeQueryNode;

                    return {
                        kind: Kinds.Types.TypeQuery,
                        exprName: query.exprName.getText(),
                        raw: query.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.OptionalType: {
                    const optional = node as ts.OptionalTypeNode;

                    return {
                        kind: Kinds.Types.OptionalType,
                        target: this.visitType(optional.type),
                        raw: optional.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.TypeLiteral: {
                    const literal = node as ts.TypeLiteralNode;

                    return {
                        kind: Kinds.Types.TypeLiteral,
                        members: literal.members.map((member: ts.TypeElement) => {
                            if (ts.isPropertySignature(member)) {
                                return {
                                    kind: Kinds.Types.PropertySignature,
                                    name: member.name.getText(),
                                    optional: !!member.questionToken,
                                    type: this.visitType(member.type),
                                    raw: member.getText(),
                                    position: this.getNodePosistion(member),
                                };
                            }

                            if (ts.isMethodSignature(member)) {
                                return this.visitMethodSignature(member);
                            }

                            return {
                                kind: Kinds.Types.UnknownMember,
                                raw: member.getText(),
                                position: this.getNodePosistion(member),
                            };
                        }),
                        raw: literal.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.IndexedAccessType: {
                    const indexed = node as ts.IndexedAccessTypeNode;

                    return {
                        kind: Kinds.Types.IndexedAccessType,
                        objectType: this.visitType(indexed.objectType),
                        indexType: this.visitType(indexed.indexType),
                        raw: indexed.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.ConditionalType: {
                    const conditional = node as ts.ConditionalTypeNode;

                    return {
                        kind: Kinds.Types.ConditionalType,
                        checkType: this.visitType(conditional.checkType),
                        extendsType: this.visitType(conditional.extendsType),
                        trueType: this.visitType(conditional.trueType),
                        falseType: this.visitType(conditional.falseType),
                        raw: conditional.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.InferType: {
                    const infer = node as ts.InferTypeNode;

                    return {
                        kind: Kinds.Types.InferType,
                        name: infer.typeParameter.name.getText(),
                        raw: infer.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.ParenthesizedType: {
                    const paren = node as ts.ParenthesizedTypeNode;

                    return this.visitType(paren.type);
                }

                default:
                    return {
                        kind: Kinds.Types.UnknownType,
                        syntaxKind: ts.SyntaxKind[node.kind],
                        raw: node.getText(),
                        position: this.getNodePosistion(node),
                    };
            }
        }

        visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration) {
            return {
                kind: Kinds.Types.TypeDeclaration,
                name: node.name.getText(),
                typeParameters: node.typeParameters?.map((param: ts.TypeParameterDeclaration) => ({
                    kind: Kinds.Types.TypeMember,
                    name: param.name.getText(),
                    constraint: param.constraint ? this.visitType(param.constraint) : null,
                    defaultType: param.default ? this.visitType(param.default) : null,
                    raw: param.getText(),
                    position: this.getNodePosistion(param),
                })) ?? [],

                type: this.visitType(node.type),
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitInterfaceDeclaration(node: ts.InterfaceDeclaration) {
            return {
                kind: Kinds.Types.InterfaceDeclaration,
                name: node.name.getText(),

                typeParameters: node.typeParameters?.map((param: ts.TypeParameterDeclaration) => ({
                    kind: Kinds.Types.TypeMember,
                    name: param.name.getText(),
                    constraint: param.constraint ? this.visitType(param.constraint) : null,
                    defaultType: param.default ? this.visitType(param.default) : null,
                    raw: param.getText(),
                    position: this.getNodePosistion(param),
                })) ?? [],

                extends: node.heritageClauses?.flatMap((clause) =>
                    clause.types.map((type) => ({
                        kind: Kinds.Types.TypeReference,
                        name: type.expression.getText(),
                        typeArguments: type.typeArguments?.map((arg) => this.visitType(arg)) ?? [],
                        raw: type.getText(),
                        position: this.getNodePosistion(type),
                    }))
                ) ?? [],

                type: {
                    kind: Kinds.Types.TypeLiteral,
                    members: node.members.map((member: ts.TypeElement) => {
                        if (ts.isPropertySignature(member)) {
                            return this.visitPropertySignature(member);
                        }

                        if (ts.isMethodSignature(member)) {
                            return this.visitMethodSignature(member);
                        }

                        return {
                            kind: Kinds.Types.UnknownMember,
                            raw: member.getText(),
                            position: this.getNodePosistion(member),
                        };
                    }),
                    raw: node.members.map((member) => member.getText()).join("\n"),
                    position: this.getNodePosistion(node),
                },

                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitMethodSignature(node: ts.MethodSignature) {
            return {
                kind: Kinds.Types.MethodSignature,
                name: node.name.getText(),
                returnType: this.visitType(node.type),
                parameters: node.parameters.map((param: ts.ParameterDeclaration) => ({
                    name: param.name.getText(),
                    type: this.visitType(param.type),
                    optional: !!param.questionToken,
                    defaultValue: param.initializer ? this.visitNode(param.initializer) : null,
                    position: this.getNodePosistion(param),
                })),
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitPropertySignature(node: ts.PropertySignature) {
            return {
                kind: Kinds.Types.PropertySignature,
                name: node.name.getText(),
                type: this.visitType(node.type),
                optional: !!node.questionToken,
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }
    };
}