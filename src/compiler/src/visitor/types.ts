import ts from "../ts";
import { BaseVisitor, Constructor } from "./base";
import { Kinds } from "../helpers/types";

export function TypesVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        visitMethodSignature(node: ts.MethodSignature) {
            return {
                kind: Kinds.Externs.ExternMethod,
                name: node.name.getText(),
                returnType: this.visitType(node.type),
                parameters: node.parameters.map((param: any) => ({
                    name: param.name.getText(),
                    type: this.visitType(param.type),
                    optional: !!param.questionToken,
                    defaultValue: this.visitNode(param.initializer),
                    position: this.getNodePosistion(param.initializer)
                })),
                position: this.getNodePosistion(node),
            };
        }

        visitPropertySignature(node: ts.PropertySignature) {
            return {
                kind: Kinds.Externs.ExternProperty,
                name: node.name.getText(),
                type: this.visitType(node.type)
            };
        }

        visitType(node?: ts.TypeNode): any {
            if (!node) {
                return {
                    kind: Kinds.Types.UnTyped,
                    raw: null
                };
            }

            switch (node.kind) {
                // primitives
                case ts.SyntaxKind.AnyKeyword:
                    return {
                        kind: Kinds.Types.AnyType,
                        raw: "any",
                    };

                case ts.SyntaxKind.UnknownKeyword:
                    return {
                        kind: Kinds.Types.UnknownType,
                        raw: "unknown",
                    };

                case ts.SyntaxKind.NeverKeyword:
                    return {
                        kind: Kinds.Types.NeverType,
                        raw: "never",
                    };

                case ts.SyntaxKind.NumberKeyword:
                    return {
                        kind: Kinds.Types.NumberType,
                        raw: "number",
                    };

                case ts.SyntaxKind.StringKeyword:
                    return {
                        kind: Kinds.Types.StringType,
                        raw: "string",
                    };

                case ts.SyntaxKind.BooleanKeyword:
                    return {
                        kind: Kinds.Types.BooleanType,
                        raw: "boolean",
                    };

                case ts.SyntaxKind.VoidKeyword:
                    return {
                        kind: Kinds.Types.VoidType,
                        raw: "void",
                    };

                case ts.SyntaxKind.NullKeyword:
                    return {
                        kind: Kinds.Types.NullType,
                        raw: "null",
                    };

                case ts.SyntaxKind.UndefinedKeyword:
                    return {
                        kind: Kinds.Types.UndefinedType,
                        raw: "undefined",
                    };

                // literal types
                case ts.SyntaxKind.LiteralType: {
                    const literal = node as ts.LiteralTypeNode;

                    return {
                        kind: Kinds.Types.LiteralType,
                        literal: literal.literal.getText(),
                        raw: literal.getText(),
                    };
                }

                // T
                // Promise<T>
                // User<string>
                case ts.SyntaxKind.TypeReference: {
                    const ref = node as ts.TypeReferenceNode;

                    return {
                        kind: Kinds.Types.TypeReference,
                        name: ref.typeName.getText(),
                        typeArguments:
                            ref.typeArguments?.map((arg: any) => this.visitType(arg)) ?? [],
                        raw: ref.getText(),
                    };
                }

                // T[]
                case ts.SyntaxKind.ArrayType: {
                    const arr = node as ts.ArrayTypeNode;

                    return {
                        kind: Kinds.Types.ArrayType,
                        elementType: this.visitType(arr.elementType),
                        raw: arr.getText(),
                    };
                }

                // [string, number]
                case ts.SyntaxKind.TupleType: {
                    const tuple = node as ts.TupleTypeNode;

                    return {
                        kind: Kinds.Types.TupleType,
                        elements: tuple.elements.map((el: any) => this.visitType(el)),
                        raw: tuple.getText(),
                    };
                }

                // A | B
                case ts.SyntaxKind.UnionType: {
                    const union = node as ts.UnionTypeNode;

                    return {
                        kind: Kinds.Types.UnionType,
                        types: union.types.map((t: any) => this.visitType(t)),
                        raw: union.getText(),
                    };
                }

                // A & B
                case ts.SyntaxKind.IntersectionType: {
                    const intersection = node as ts.IntersectionTypeNode;

                    return {
                        kind: Kinds.Types.IntersectionType,
                        types: intersection.types.map((t: any) => this.visitType(t)),
                        raw: intersection.getText(),
                    };
                }

                // (a: string) => number
                case ts.SyntaxKind.FunctionType: {
                    const fn = node as ts.FunctionTypeNode;

                    return {
                        kind: Kinds.Types.FunctionType,

                        parameters: fn.parameters.map((param: any) => ({
                            name: param.name.getText(),
                            type: this.visitType(param.type),
                            optional: !!param.questionToken,
                        })),

                        returnType: this.visitType(fn.type),

                        raw: fn.getText(),
                    };
                }

                // keyof T
                case ts.SyntaxKind.TypeOperator: {
                    const op = node as ts.TypeOperatorNode;

                    return {
                        kind: Kinds.Types.TypeOperator,
                        operator: ts.tokenToString(op.operator),
                        target: this.visitType(op.type),
                        raw: op.getText(),
                    };
                }

                // typeof X
                case ts.SyntaxKind.TypeQuery: {
                    const query = node as ts.TypeQueryNode;

                    return {
                        kind: Kinds.Types.TypeQuery,
                        exprName: query.exprName.getText(),
                        raw: query.getText(),
                    };
                }

                // string?
                // only appears internally in some transforms
                case ts.SyntaxKind.OptionalType: {
                    const optional = node as ts.OptionalTypeNode;

                    return {
                        kind: Kinds.Types.OptionalType,
                        target: this.visitType(optional.type),
                        raw: optional.getText(),
                    };
                }

                // readonly T[]
                case ts.SyntaxKind.TypeOperator:
                    break;

                // { a: string }
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
                                };
                            }

                            if (ts.isMethodSignature(member)) {
                                return this.visitMethodSignature(member);
                            }

                            return {
                                kind: Kinds.Types.UnknownMember,
                                raw: member.getText(),
                            };
                        }),

                        raw: literal.getText(),
                    };
                }

                // string[number]
                case ts.SyntaxKind.IndexedAccessType: {
                    const indexed = node as ts.IndexedAccessTypeNode;

                    return {
                        kind: Kinds.Types.IndexedAccessType,
                        objectType: this.visitType(indexed.objectType),
                        indexType: this.visitType(indexed.indexType),
                        raw: indexed.getText(),
                    };
                }

                // T extends U ? X : Y
                case ts.SyntaxKind.ConditionalType: {
                    const conditional = node as ts.ConditionalTypeNode;

                    return {
                        kind: Kinds.Types.ConditionalType,
                        checkType: this.visitType(conditional.checkType),
                        extendsType: this.visitType(conditional.extendsType),
                        trueType: this.visitType(conditional.trueType),
                        falseType: this.visitType(conditional.falseType),
                        raw: conditional.getText(),
                    };
                }

                // infer T
                case ts.SyntaxKind.InferType: {
                    const infer = node as ts.InferTypeNode;

                    return {
                        kind: Kinds.Types.InferType,
                        name: infer.typeParameter.name.getText(),
                        raw: infer.getText(),
                    };
                }

                // parenthesized type
                case ts.SyntaxKind.ParenthesizedType: {
                    const paren = node as ts.ParenthesizedTypeNode;

                    return this.visitType(paren.type);
                }

                default:
                    return {
                        kind: Kinds.Types.UnknownType,
                        syntaxKind: ts.SyntaxKind[node.kind],
                        raw: node.getText(),
                    };
            }
        }
    };
}