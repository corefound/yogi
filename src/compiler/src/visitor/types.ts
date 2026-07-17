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

            if (ts.isStructDeclaration?.(node)) {
                return this.visitStructDeclaration(node as ts.StructDeclaration);
            }

            return null;
        }

        visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration) {
            const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

            return {
                kind: Kinds.Types.TypeDeclaration,
                export: isExported,
                name: this.visitIdentifier(node.name),
                parameters: this.visitTypeParameters(node.typeParameters),
                type: this.visitType(node.type),
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitInterfaceDeclaration(node: ts.InterfaceDeclaration): any {
            const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

            return {
                kind: Kinds.Types.InterfaceDeclaration,
                name: this.visitIdentifier(node.name),
                parameters: this.visitTypeParameters(node.typeParameters),
                extends: this.visitInterfaceExtends(node),
                export: isExported,
                body: {
                    kind: Kinds.Types.TypeLiteral,
                    members: node.members.map((member: ts.TypeElement) =>
                        this.visitTypeMember(member),
                    ),
                    raw: node.members.map((member) => member.getText()).join("\n"),
                    position: this.getNodePosistion(node),
                },

                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitStructDeclaration(node: ts.StructDeclaration): any {
            const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

            const body = {
                kind: Kinds.Types.TypeLiteral,
                members: node.members.map((member: ts.StructMember) =>
                    this.visitStructMember(member),
                ),
                raw: node.members.map((member) => member.getText()).join("\n"),
                position: this.getNodePosistion(node),
            };

            return {
                kind: Kinds.Types.StructDeclaration,
                name: this.visitIdentifier(node.name),
                parameters: this.visitTypeParameters(node.typeParameters),
                extends: node.extendsType
                    ? [
                        {
                            kind: Kinds.Types.TypeUsage,
                            name: this.visitType(node.extendsType),
                            arguments: [],
                            raw: node.extendsType.getText(),
                            position: this.getNodePosistion(node.extendsType),
                        },
                    ]
                    : [],
                export: isExported,
                body,
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitStructMember(member: ts.StructMember): any {
            if ((member as any).kind === ts.SyntaxKind.StructFieldDeclaration) {
                return this.visitStructFieldDeclaration(member as any);
            }

            if ((member as any).kind === ts.SyntaxKind.StructFunctionDeclaration) {
                return this.visitStructFunctionDeclaration(member as any);
            }

            return {
                kind: Kinds.Types.UnknownMember,
                raw: (member as any).getText(),
                position: this.getNodePosistion(member as any),
            };
        }

        visitStructFieldDeclaration(member: any): any {
            return {
                kind: Kinds.Types.StructFieldDeclaration,
                name: this.visitPropertyName(member.name),
                type: this.visitType(member.type),
                optional: !!member.questionToken,
                readonly: this.hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
                raw: member.getText(),
                position: this.getNodePosistion(member),
            };
        }

        visitStructFunctionDeclaration(member: any): any {
            return {
                kind: Kinds.Types.StructFunctionDeclaration,
                name: this.visitPropertyName(member.name),
                typeParameters: this.visitTypeParameters(member.typeParameters),
                parameters: member.parameters.map((param: ts.ParameterDeclaration) =>
                    this.visitParameter(param),
                ),
                returnType: this.visitType(member.type),
                body: member.body
                    ? {
                        kind: Kinds.Statements.BlockStatement,
                        statements: member.body.statements.map((stmt: ts.Statement) =>
                            this.visitNode(stmt),
                        ),
                        raw: member.body.getText(),
                        position: this.getNodePosistion(member.body),
                    }
                    : null,
                raw: member.getText(),
                position: this.getNodePosistion(member),
            };
        }

        visitInterfaceExtends(node: ts.InterfaceDeclaration): any[] {
            return (
                node.heritageClauses
                    ?.filter((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
                    .flatMap((clause) =>
                        clause.types.map((type) => this.visitTypeUsage(type)),
                    ) ?? []
            );
        }

        visitTypeUsage(node: ts.ExpressionWithTypeArguments) {
            return {
                kind: Kinds.Types.TypeUsage,
                name: this.visitEntityNameExpression(node.expression),
                arguments: node.typeArguments?.map((arg) => this.visitType(arg)) ?? [],
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitEntityNameExpression(node: ts.Expression): any {
            if (ts.isIdentifier(node)) {
                return this.visitIdentifier(node);
            }

            if (ts.isPropertyAccessExpression(node)) {
                return {
                    kind: Kinds.Types.QualifiedName,
                    parts: this.flattenPropertyAccess(node),
                    raw: node.getText(),
                    position: this.getNodePosistion(node),
                };
            }

            return {
                kind: Kinds.Types.UnknownExpression,
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        flattenPropertyAccess(node: ts.Expression): any[] {
            if (ts.isIdentifier(node)) {
                return [this.visitIdentifier(node)];
            }

            if (ts.isPropertyAccessExpression(node)) {
                return [
                    ...this.flattenPropertyAccess(node.expression),
                    this.visitMemberName(node.name),
                ];
            }

            return [
                {
                    kind: Kinds.Types.UnknownExpression,
                    raw: node.getText(),
                    position: this.getNodePosistion(node),
                },
            ];
        }

        visitMemberName(name: ts.MemberName): any {
            if (ts.isIdentifier(name)) {
                return this.visitIdentifier(name);
            }

            return {
                kind: Kinds.Types.UnknownExpression,
                raw: name.getText(),
                position: this.getNodePosistion(name),
            };
        }

        visitIdentifier(node: ts.Identifier) {
            return {
                kind: Kinds.Expressions.IdentifierExpression,
                name: node.getText(),
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitTypeParameters(params?: ts.NodeArray<ts.TypeParameterDeclaration>): any[] {
            return (
                params?.map((param: ts.TypeParameterDeclaration) => ({
                    kind: Kinds.Types.TypeParameter,
                    name: this.visitIdentifier(param.name),
                    constraint: param.constraint ? this.visitType(param.constraint) : null,
                    defaultType: param.default ? this.visitType(param.default) : null,
                    raw: param.getText(),
                    position: this.getNodePosistion(param),
                })) ?? []
            );
        }

        visitTypeMember(member: ts.TypeElement): any {
            if (ts.isPropertySignature(member)) {
                return this.visitPropertySignature(member);
            }

            if (ts.isMethodSignature(member)) {
                return this.visitMethodSignature(member);
            }

            if (ts.isCallSignatureDeclaration(member)) {
                return this.visitCallSignature(member);
            }

            if (ts.isConstructSignatureDeclaration(member)) {
                return this.visitConstructSignature(member);
            }

            if (ts.isIndexSignatureDeclaration(member)) {
                return this.visitIndexSignature(member);
            }

            return {
                kind: Kinds.Types.UnknownMember,
                raw: member.getText(),
                position: this.getNodePosistion(member),
            };
        }

        visitPropertySignature(node: ts.PropertySignature) {
            return {
                kind: Kinds.Types.PropertySignature,
                name: this.visitPropertyName(node.name),
                type: this.visitType(node.type),
                optional: !!node.questionToken,
                readonly: this.hasModifier(node, ts.SyntaxKind.ReadonlyKeyword),
                abiContracts: this.visitNativeAbiContracts(node),
                raw: node.getText(),
                source: node.getFullText(this.sourceFile).trim(),
                position: this.getNodePosistion(node),
            };
        }

        visitMethodSignature(node: ts.MethodSignature) {
            return {
                kind: Kinds.Types.MethodSignature,
                name: this.visitPropertyName(node.name),
                typeParameters: this.visitTypeParameters(node.typeParameters),
                parameters: node.parameters.map((param) => this.visitParameter(param)),
                returnType: this.visitType(node.type),
                optional: !!node.questionToken,
                abiContracts: this.visitNativeAbiContracts(node),
                raw: node.getText(),
                source: node.getFullText(this.sourceFile).trim(),
                position: this.getNodePosistion(node),
            };
        }

        visitNativeAbiContracts(node: ts.Node): any[] {
            return ts.getJSDocTags(node)
                .filter((tag) => tag.tagName.getText(this.sourceFile) === "abi")
                .map((tag) => this.visitNativeAbiContract(tag));
        }

        visitNativeAbiContract(tag: ts.JSDocTag): any {
            const raw = tag.getText(this.sourceFile).replace(/^@abi\s*/, "").trim();
            const tokens = raw.split(/\s+/).filter(Boolean);
            const targetToken = tokens.shift() ?? "";
            const target = targetToken === "param" || targetToken === "parameter"
                ? "parameter"
                : targetToken === "return"
                    ? "return"
                    : "unknown";
            const contract: any = {
                kind: "NativeAbiContract",
                target,
                mode: null,
                owner: null,
                direction: null,
                freeFunction: null,
                raw,
                position: this.getNodePosistion(tag),
            };

            if (target === "parameter") {
                contract.parameterName = tokens.shift() ?? "";
            }

            for (let index = 0; index < tokens.length; ++index) {
                const token = tokens[index];
                const normalized = token.toLowerCase().replaceAll("_", "-");

                if (normalized === "borrowed") {
                    contract.mode = "borrowed";
                    continue;
                }

                if (normalized === "copy-back" || normalized === "copyback") {
                    contract.mode = "copy-back";
                    continue;
                }

                if (normalized === "output" || normalized === "out") {
                    contract.direction = "output";
                    continue;
                }

                if (normalized === "native-owned") {
                    contract.mode = "native-owned";
                    contract.owner = "native";
                    continue;
                }

                if (normalized === "runtime-owned") {
                    contract.mode = "runtime-owned";
                    contract.owner = "runtime";
                    continue;
                }

                if (normalized === "owned") {
                    contract.mode = "owned";
                    continue;
                }

                if (normalized.startsWith("by=")) {
                    contract.owner = token.slice(token.indexOf("=") + 1);
                    continue;
                }

                if (normalized === "by" && tokens[index + 1]) {
                    contract.owner = tokens[++index];
                    continue;
                }

                if (normalized.startsWith("free=")) {
                    contract.freeFunction = token.slice(token.indexOf("=") + 1);
                    continue;
                }

                if (normalized === "free" && tokens[index + 1]) {
                    contract.freeFunction = tokens[++index];
                }
            }

            if (contract.mode === "owned" && contract.owner === "native") {
                contract.mode = "native-owned";
            }

            if (contract.mode === "owned" && contract.owner === "runtime") {
                contract.mode = "runtime-owned";
            }

            return contract;
        }

        visitCallSignature(node: ts.CallSignatureDeclaration) {
            return {
                kind: Kinds.Types.CallSignature,
                typeParameters: this.visitTypeParameters(node.typeParameters),
                parameters: node.parameters.map((param) => this.visitParameter(param)),
                returnType: this.visitType(node.type),
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitConstructSignature(node: ts.ConstructSignatureDeclaration) {
            return {
                kind: Kinds.Types.ConstructSignature,
                typeParameters: this.visitTypeParameters(node.typeParameters),
                parameters: node.parameters.map((param) => this.visitParameter(param)),
                returnType: this.visitType(node.type),
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitIndexSignature(node: ts.IndexSignatureDeclaration) {
            return {
                kind: Kinds.Types.IndexSignature,
                parameters: node.parameters.map((param) => this.visitParameter(param)),
                returnType: this.visitType(node.type),
                readonly: this.hasModifier(node, ts.SyntaxKind.ReadonlyKeyword),
                raw: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitParameter(param: ts.ParameterDeclaration) {
            return {
                kind: Kinds.Types.Parameter,
                name: this.visitBindingName(param.name),
                type: this.visitType(param.type),
                optional: !!param.questionToken,
                rest: !!param.dotDotDotToken,
                defaultValue: param.initializer ? this.visitNode(param.initializer) : null,
                raw: param.getText(),
                position: this.getNodePosistion(param),
            };
        }

        visitBindingName(name: ts.BindingName): any {
            if (ts.isIdentifier(name)) {
                return this.visitIdentifier(name);
            }

            return {
                kind: Kinds.Types.UnknownBindingName,
                raw: name.getText(),
                position: this.getNodePosistion(name),
            };
        }

        visitPropertyName(name: ts.PropertyName): any {
            if (ts.isIdentifier(name)) {
                return this.visitIdentifier(name);
            }

            return {
                kind: Kinds.Types.PropertyName,
                raw: name.getText(),
                position: this.getNodePosistion(name),
            };
        }

        hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
            const directModifiers = (node as any).modifiers;
            if (directModifiers?.some?.((modifier: any) => modifier.kind === kind)) {
                return true;
            }

            if (!ts.canHaveModifiers(node)) {
                return false;
            }

            return ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false;
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

                case ts.SyntaxKind.TypeReference: {
                    const ref = node as ts.TypeReferenceNode;
                    const nameText = ref.typeName.getText();

                    if (nameText === "ptr" && ref.typeArguments?.length === 1) {
                        const elementType = this.visitType(ref.typeArguments[0]);

                        return {
                            kind: Kinds.Types.PointerType,
                            elementType,
                            pointee: elementType,
                            raw: `ptr<${elementType.raw ?? "unknown"}>`,
                            position: this.getNodePosistion(node),
                        };
                    }

                    if (nameText === "ReadonlyArray" && ref.typeArguments?.length === 1) {
                        return {
                            kind: Kinds.Types.ArrayType,
                            elementType: this.visitType(ref.typeArguments[0]),
                            readonly: true,
                            raw: ref.getText(),
                            position: this.getNodePosistion(node),
                        };
                    }

                    return {
                        kind: Kinds.Types.TypeReference,
                        name: this.visitTypeName(ref.typeName),
                        arguments: ref.typeArguments?.map((arg) => this.visitType(arg)) ?? [],
                        raw: ref.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.TypeLiteral: {
                    const literal = node as ts.TypeLiteralNode;

                    return {
                        kind: Kinds.Types.TypeLiteral,
                        members: literal.members.map((member) => this.visitTypeMember(member)),
                        raw: literal.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.ArrayType: {
                    const arr = node as ts.ArrayTypeNode;

                    return {
                        kind: Kinds.Types.ArrayType,
                        elementType: this.visitType(arr.elementType),
                        readonly: false,
                        raw: arr.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.IndexedAccessType: {
                    const indexed = node as ts.IndexedAccessTypeNode;
                    const elementType = this.visitType(indexed.objectType);
                    const rawIndexType = indexed.indexType as any;
                    const rawIndexText = rawIndexType.getText?.() ?? "";
                    const normalizedShape = rawIndexText.includes("|")
                        ? rawIndexText
                            .split("|")
                            .map((part: string) => Number(part.trim()))
                        : null;
                    const indexTypes = ts.isTupleTypeNode(indexed.indexType)
                        ? indexed.indexType.elements.map((element) => this.visitType(element as ts.TypeNode))
                        : [this.visitType(indexed.indexType)];
                    const shape = normalizedShape ?? indexTypes.map((indexType) => Number(indexType?.literal));

                    if (rawIndexText.trim().startsWith("[") || !shape.length || shape.some((literal: number) => !Number.isInteger(literal) || literal <= 0)) {
                        return {
                            kind: Kinds.Types.UnknownType,
                            syntaxKind: ts.SyntaxKind[node.kind],
                            reason: rawIndexText.trim().startsWith("[")
                                ? "invalid array shape syntax"
                                : "invalid array shape dimension",
                            raw: node.getText(),
                            position: this.getNodePosistion(node),
                        };
                    }

                    return {
                        kind: Kinds.Types.ArrayType,
                        elementType,
                        readonly: false,
                        fixed: true,
                        shape,
                        raw: `${elementType.raw ?? "unknown"}[${shape.join(", ")}]`,
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.TupleType: {
                    const tuple = node as ts.TupleTypeNode;

                    return {
                        kind: Kinds.Types.TupleType,
                        elements: tuple.elements.map((el) => this.visitType(el)),
                        readonly: false,
                        raw: tuple.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.RestType: {
                    const rest = node as ts.RestTypeNode;
                    const restType = this.visitType(rest.type);

                    if (restType?.kind === Kinds.Types.ArrayType) {
                        return {
                            ...restType,
                            raw: restType.raw ?? rest.getText().replace(/^\.\.\./, ""),
                            position: this.getNodePosistion(node),
                        };
                    }

                    return {
                        kind: Kinds.Types.ArrayType,
                        elementType: restType,
                        readonly: false,
                        raw: `${restType?.raw ?? "unknown"}[]`,
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.UnionType: {
                    const union = node as ts.UnionTypeNode;

                    return {
                        kind: Kinds.Types.UnionType,
                        types: union.types.map((t) => this.visitType(t)),
                        raw: union.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.IntersectionType: {
                    const intersection = node as ts.IntersectionTypeNode;

                    return {
                        kind: Kinds.Types.IntersectionType,
                        types: intersection.types.map((t) => this.visitType(t)),
                        raw: intersection.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.FunctionType: {
                    const fn = node as ts.FunctionTypeNode;

                    return {
                        kind: Kinds.Types.FunctionType,
                        typeParameters: this.visitTypeParameters(fn.typeParameters),
                        parameters: fn.parameters.map((param) => this.visitParameter(param)),
                        returnType: this.visitType(fn.type),
                        raw: fn.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.LiteralType: {
                    const literal = node as ts.LiteralTypeNode;

                    return {
                        kind: Kinds.Types.LiteralType,
                        literal: literal.literal.getText(),
                        raw: literal.getText(),
                        position: this.getNodePosistion(node),
                    };
                }

                case ts.SyntaxKind.ParenthesizedType: {
                    const paren = node as ts.ParenthesizedTypeNode;
                    return this.visitType(paren.type);
                }

                case ts.SyntaxKind.TypeOperator: {
                    const operator = node as ts.TypeOperatorNode;
                    const type = this.visitType(operator.type);

                    if (operator.operator === ts.SyntaxKind.ReadonlyKeyword) {
                        return {
                            ...type,
                            readonly: true,
                            raw: operator.getText(),
                            position: this.getNodePosistion(node),
                        };
                    }

                    return type;
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

        visitTypeName(name: ts.EntityName): any {
            if (ts.isIdentifier(name)) {
                return this.visitIdentifier(name);
            }

            return {
                kind: Kinds.Types.QualifiedName,
                parts: this.flattenQualifiedName(name),
                raw: name.getText(),
                position: this.getNodePosistion(name),
            };
        }

        flattenQualifiedName(name: ts.EntityName): any[] {
            if (ts.isIdentifier(name)) {
                return [this.visitIdentifier(name)];
            }

            return [
                ...this.flattenQualifiedName(name.left),
                this.visitIdentifier(name.right),
            ];
        }
    };
}
