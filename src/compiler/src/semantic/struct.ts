import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";
import type { SemanticStructDeclaration, SemanticLayoutMetadata } from "../types/sir";

export function StructSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitStructs(node: any): any {
            if (
                node?.kind === Kinds.Types.StructDeclaration ||
                node?.kind === "StructDeclaration"
            ) {
                return this.visitStructDeclaration(node);
            }

            return null;
        }

        public visitStructDeclaration(node: any): any {
            const name = this.getNameText(node.name);
            const body = node.body ?? node.type;
            const rawMembers = body?.members ?? [];

            // Classify members: fields vs layout() vs validate()
            const fields: any[] = [];
            let layoutMember: any = null;
            let validateMember: any = null;
            const unknownMembers: any[] = [];

            for (const member of rawMembers) {
                const memberKind = member.kind;
                const memberName = this.getMemberNameText(member);

                if (
                    memberKind === Kinds.Types.StructFieldDeclaration ||
                    memberKind === "StructFieldDeclaration" ||
                    memberKind === Kinds.Types.PropertySignature ||
                    memberKind === "PropertySignature"
                ) {
                    fields.push(member);
                } else if (
                    memberKind === Kinds.Types.StructFunctionDeclaration ||
                    memberKind === "StructFunctionDeclaration" ||
                    memberKind === Kinds.Types.MethodSignature ||
                    memberKind === "MethodSignature"
                ) {
                    // Distinguish layout() vs validate()
                    if (memberName === "layout") {
                        layoutMember = member;
                    } else if (memberName === "validate") {
                        validateMember = member;
                    } else {
                        unknownMembers.push(member);
                    }
                } else {
                    unknownMembers.push(member);
                }
            }

            // Report unknown members
            const structName = name;
            for (const member of unknownMembers) {
                const message =
                    `struct ${Helpers.RED}'${structName}'${Helpers.RESET} can only contain fields, layout(), and validate()`;

                member.arrowLength = member.raw?.length ?? 1;

                this.throwError(
                    message,
                    member.position ?? node.position,
                    node.raw ?? node.source,
                    member,
                );
            }

            // Check duplicate fields
            const fieldNames = new Set<string>();
            for (const field of fields) {
                const fieldName = this.getMemberNameText(field);
                if (fieldName && fieldNames.has(fieldName)) {
                    const message =
                        `struct ${Helpers.RED}'${structName}'${Helpers.RESET} has duplicate field ${Helpers.RED}'${fieldName}'${Helpers.RESET}`;

                    field.arrowLength = field.raw?.length ?? fieldName.length;

                    this.throwError(
                        message,
                        field.position ?? node.position,
                        node.raw ?? node.source,
                        field,
                    );
                }
                if (fieldName) {
                    fieldNames.add(fieldName);
                }
            }

            // Check layout() constraints
            if (layoutMember) {
                this.checkLayoutHook(node, layoutMember);
            }

            // Check validate() constraints
            if (validateMember) {
                this.checkValidateHook(node, validateMember);
            }

            // Resolve inheritance
            const extendsTypes = node.extends ?? [];
            let parentSymbol: any = null;
            let parentFields: any[] = [];
            let parentLayout: any = null;
            let parentHasValidate = false;
            let parentValidateChain: string[] = [];
            let parentIsScalar = false;
            let primitiveBaseType: any = null;
            let parentName: string | null = null;

            if (extendsTypes.length > 0) {
                const extendsType = extendsTypes[0];
                const extendedName = this.getTypeUsageNameText(extendsType);
                primitiveBaseType = this.getPrimitiveStructBaseType(extendedName, extendsType);
                parentName = extendedName;

                if (extendedName === structName) {
                    const message =
                        `struct ${Helpers.RED}'${structName}'${Helpers.RESET} cannot extend itself`;

                    extendsType.arrowLength = extendsType.raw?.length ?? extendedName.length;

                    this.throwError(
                        message,
                        extendsType.position,
                        node.raw ?? node.source,
                        extendsType,
                    );
                }

                if (!primitiveBaseType) {
                    parentSymbol = this.resolveSymbol(extendedName);

                    if (!parentSymbol) {
                        const message =
                            `cannot find type ${Helpers.RED}'${extendedName}'${Helpers.RESET}`;

                        extendsType.arrowLength = extendsType.raw?.length ?? extendedName.length;

                        this.throwError(
                            message,
                            extendsType.position,
                            node.raw ?? node.source,
                            extendsType,
                        );
                    }

                    if (parentSymbol &&
                        parentSymbol.kind !== Kinds.ScopeSymbols.Struct &&
                        parentSymbol.kind !== Kinds.ScopeSymbols.Interface &&
                        parentSymbol.kind !== Kinds.ScopeSymbols.Type) {
                        const message =
                            `struct ${Helpers.RED}'${structName}'${Helpers.RESET} can only extend a struct, interface, type, or primitive scalar`;

                        extendsType.arrowLength = extendsType.raw?.length ?? extendedName.length;

                        this.throwError(
                            message,
                            extendsType.position,
                            node.raw ?? node.source,
                            extendsType,
                        );
                    }

                    if (
                        parentSymbol &&
                        (
                            parentSymbol.kind === Kinds.ScopeSymbols.Interface ||
                            parentSymbol.kind === Kinds.ScopeSymbols.Type
                        ) &&
                        !(this as any).canInterfaceExtendSymbol(parentSymbol)
                    ) {
                        const message =
                            `struct ${Helpers.RED}'${structName}'${Helpers.RESET} can only extend an object-like ` +
                            `interface or type with statically known members; ${Helpers.RED}'${extendedName}'${Helpers.RESET} is not valid`;

                        extendsType.arrowLength = extendsType.raw?.length ?? extendedName.length;

                        this.throwError(
                            message,
                            extendsType.position,
                            node.raw ?? node.source,
                            extendsType,
                        );
                    }

                    if (parentSymbol) {
                        (this as any).checkTypeArguments?.(extendsType, parentSymbol);
                    }

                    if (parentSymbol?.node) {
                        parentFields = this.getStructFieldsFromSymbol(parentSymbol, extendsType);
                        parentLayout = this.getStructLayoutFromSymbol(parentSymbol);
                        parentHasValidate = this.getStructHasValidateFromSymbol(parentSymbol);
                        parentValidateChain = this.getStructValidateChainFromSymbol(parentSymbol);
                        parentIsScalar = this.getStructIsScalarFromSymbol(parentSymbol);

                        // Check duplicate inherited fields
                        for (const parentField of parentFields) {
                            const parentFieldName = this.getMemberNameText(parentField);
                            if (parentFieldName && fieldNames.has(parentFieldName)) {
                                const childField = fields.find(
                                    (f) => this.getMemberNameText(f) === parentFieldName,
                                );

                                const message =
                                    `struct ${Helpers.RED}'${structName}'${Helpers.RESET} has duplicate inherited field ` +
                                    `${Helpers.RED}'${parentFieldName}'${Helpers.RESET}`;

                                const target = childField ?? node;
                                target.arrowLength =
                                    target.raw?.length ?? parentFieldName.length;

                                this.throwError(
                                    message,
                                    target.position ?? node.position,
                                    node.raw ?? node.source,
                                    target,
                                );
                            }
                        }
                    }
                }
            }

            // Combine fields: parent fields first, then child fields
            const allFields = [...parentFields, ...fields];

            // Determine if scalar: no fields, has extends
            const isScalar = allFields.length === 0 && extendsTypes.length > 0;

            // Determine layout: child layout() overrides parent layout policy
            let resolvedLayout: any = null;
            let hasCustomLayout = false;

            if (layoutMember) {
                resolvedLayout = this.normalizeLayoutMetadata(layoutMember, node, {
                    structName,
                    parentName,
                    fieldCount: allFields.length,
                    isScalar,
                });
                hasCustomLayout = true;
            } else if (parentLayout) {
                resolvedLayout = { ...parentLayout };
                hasCustomLayout = true;
            }

            // Determine validate chain
            const hasValidate = !!validateMember || parentHasValidate;

            // Register symbol
            const linkageName = node.export
                ? this.getLinkageName(this.modulePath.relativePath, name)
                : null;

            const qualifiedName = this.getQualifiedName(
                this.modulePath.relativePath,
                name,
            );
            const validatorQualifiedName = validateMember
                ? this.getStructValidatorQualifiedName(name)
                : null;
            const validateChain = [
                ...parentValidateChain,
                ...(validatorQualifiedName ? [validatorQualifiedName] : []),
            ];

            const semanticNode: SemanticStructDeclaration = {
                kind: "StructDeclaration",
                name,
                typeParameters: node.parameters ?? node.typeParameters ?? [],
                extends: extendsTypes.length > 0
                    ? primitiveBaseType ?? extendsTypes[0].name ?? extendsTypes[0]
                    : null,
                fields: allFields.map((f: any) => ({
                    kind: "StructFieldDeclaration",
                    name: this.getMemberNameText(f) ?? "",
                    type: f.type ?? { kind: "AnyType", raw: "any" },
                    optional: f.optional ?? false,
                    readonly: f.readonly ?? false,
                    raw: f.raw ?? f.source,
                    position: f.position,
                })),
                hasLayout: hasCustomLayout,
                layout: resolvedLayout,
                hasValidate,
                validateChain,
                isScalar,
                export: node.export ?? false,
                symbolId: 0,
                scopeId: 0,
                linkageName,
                qualifiedName,
                source: node.raw ?? node.source,
                position: node.position,
            };

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Struct,
                name,
                type: semanticNode,
                mutable: false,
                storage: null,
                escapes: false,
                linkageName,
                qualifiedName,
                node: semanticNode,
            });

            semanticNode.symbolId = symbol.id;
            semanticNode.scopeId = symbol.scopeId;

            symbol.node = semanticNode;

            if (node.export) {
                this.exportSymbol(symbol);
            }

            const validatorFunction = validateMember && validatorQualifiedName
                ? this.createStructValidatorFunction(node, validateMember, validatorQualifiedName)
                : null;

            return [
                ...(validatorFunction ? [validatorFunction] : []),
                semanticNode,
            ];
        }

        // ---- Layout hook checks ----

        checkLayoutHook(structNode: any, layoutMember: any): void {
            const structName = this.getNameText(structNode.name);
            const memberName = this.getMemberNameText(layoutMember);

            // layout() must return a layout description
            if (!layoutMember.returnType) {
                const message =
                    `layout() in struct ${Helpers.RED}'${structName}'${Helpers.RESET} must have a return type`;

                layoutMember.arrowLength = layoutMember.raw?.length ?? memberName?.length ?? 1;

                this.throwError(
                    message,
                    layoutMember.position ?? structNode.position,
                    structNode.raw ?? structNode.source,
                    layoutMember,
                );
            }

            if (layoutMember.returnType && !this.isLayoutHookReturnType(layoutMember.returnType)) {
                const message =
                    `layout() in struct ${Helpers.RED}'${structName}'${Helpers.RESET} must return ` +
                    `${Helpers.BLUE}'Layout<T>'${Helpers.RESET} or ${Helpers.BLUE}'IntegerLayout'${Helpers.RESET}`;

                layoutMember.arrowLength = layoutMember.raw?.length ?? memberName?.length ?? 1;

                this.throwError(
                    message,
                    layoutMember.position ?? structNode.position,
                    structNode.raw ?? structNode.source,
                    layoutMember,
                    "  = use an explicit layout type such as 'Layout<Packet>' or 'IntegerLayout'",
                );
            }

            // layout() must have no parameters beyond the implicit this
            const parameters = layoutMember.parameters ?? [];
            if (parameters.length > 0) {
                const message =
                    `layout() in struct ${Helpers.RED}'${structName}'${Helpers.RESET} must have no parameters`;

                layoutMember.arrowLength = layoutMember.raw?.length ?? memberName?.length ?? 1;

                this.throwError(
                    message,
                    layoutMember.position ?? structNode.position,
                    structNode.raw ?? structNode.source,
                    layoutMember,
                );
            }
        }

        isLayoutHookReturnType(type: any): boolean {
            if (!type || type.kind !== Kinds.Types.TypeReference) {
                return false;
            }

            const name = this.getTypeReferenceName(type);
            const args = type.arguments ?? type.typeArguments ?? [];

            if (name === "IntegerLayout") {
                return true;
            }

            if (name !== "Layout" && name !== "layout") {
                return false;
            }

            if (args.length !== 1) {
                return false;
            }

            const arg = args[0];
            return !!arg &&
                arg.kind !== Kinds.Types.AnyType &&
                arg.kind !== Kinds.Types.UnknownType &&
                arg.kind !== Kinds.Types.UnTyped;
        }

        // ---- Validate hook checks ----

        checkValidateHook(structNode: any, validateMember: any): void {
            const structName = this.getNameText(structNode.name);
            const memberName = this.getMemberNameText(validateMember);

            // validate() must return boolean
            if (!validateMember.returnType) {
                const message =
                    `validate() in struct ${Helpers.RED}'${structName}'${Helpers.RESET} must have a return type`;

                validateMember.arrowLength = validateMember.raw?.length ?? memberName?.length ?? 1;

                this.throwError(
                    message,
                    validateMember.position ?? structNode.position,
                    structNode.raw ?? structNode.source,
                    validateMember,
                );
            }

            if (
                validateMember.returnType &&
                validateMember.returnType.kind !== Kinds.Types.BooleanType
            ) {
                const message =
                    `validate() in struct ${Helpers.RED}'${structName}'${Helpers.RESET} must return ` +
                    `${Helpers.BLUE}'boolean'${Helpers.RESET}`;

                validateMember.arrowLength = validateMember.raw?.length ?? memberName?.length ?? 1;

                this.throwError(
                    message,
                    validateMember.position ?? structNode.position,
                    structNode.raw ?? structNode.source,
                    validateMember,
                );
            }

            if (!validateMember.body) {
                const message =
                    `validate() in struct ${Helpers.RED}'${structName}'${Helpers.RESET} must have a body`;

                validateMember.arrowLength = validateMember.raw?.length ?? memberName?.length ?? 1;

                this.throwError(
                    message,
                    validateMember.position ?? structNode.position,
                    structNode.raw ?? structNode.source,
                    validateMember,
                );
            }

            // validate() must have no parameters beyond the implicit this
            const parameters = validateMember.parameters ?? [];
            if (parameters.length > 0) {
                const message =
                    `validate() in struct ${Helpers.RED}'${structName}'${Helpers.RESET} must have no parameters`;

                validateMember.arrowLength = validateMember.raw?.length ?? memberName?.length ?? 1;

                this.throwError(
                    message,
                    validateMember.position ?? structNode.position,
                    structNode.raw ?? structNode.source,
                    validateMember,
                );
            }
        }

        getPrimitiveStructBaseType(name: string, sourceType: any): any {
            const raw = sourceType?.raw ?? name;
            const position = sourceType?.position;

            switch (name) {
                case "number":
                    return { kind: Kinds.Types.NumberType, raw, position };
                case "string":
                    return { kind: Kinds.Types.StringType, raw, position };
                case "boolean":
                    return { kind: Kinds.Types.BooleanType, raw, position };
                case "undefined":
                    return { kind: Kinds.Types.UndefinedType, raw, position };
                case "null":
                    return { kind: Kinds.Types.NullType, raw, position };
                default:
                    return null;
            }
        }

        getStructValidatorQualifiedName(structName: string): string {
            return this.getQualifiedName(
                this.modulePath.relativePath,
                `${structName}.validate`,
            );
        }

        createStructValidatorFunction(
            structNode: any,
            validateMember: any,
            qualifiedName: string,
        ): any {
            const structName = this.getNameText(structNode.name);
            const thisType = {
                kind: Kinds.Types.TypeReference,
                name: {
                    kind: Kinds.Expressions.IdentifierExpression,
                    name: structName,
                    raw: structName,
                },
                arguments: [] as any[],
                raw: structName,
                position: structNode.position,
            };
            const thisParam = {
                kind: Kinds.Functions.FunctionParameter,
                name: "this",
                type: {
                    ...thisType,
                    readonly: true,
                },
                mutable: false,
                source: "this",
                position: validateMember.position,
            };

            this.enterScope();
            const semanticThisParam = (this as any).visitFunctionParameterDeclaration(
                { name: `${structName}.validate`, fullSource: validateMember.raw ?? validateMember.source },
                thisParam,
            );
            const body = (this as any).visitFunctionBody(validateMember.body);
            this.exitScope();

            return {
                kind: Kinds.Functions.FunctionDeclaration,
                name: `${structName}.validate`,
                params: [semanticThisParam],
                returnType: { kind: Kinds.Types.BooleanType, raw: "boolean" },
                body,
                symbolId: -1,
                scopeId: -1,
                mutable: false,
                flag: "const",
                export: false,
                trusted: true,
                linkageName: null,
                qualifiedName,
                effectSummary: {
                    parameterEffects: [],
                    returnsAggregate: false,
                },
                source: validateMember.raw ?? validateMember.source,
                position: validateMember.position,
            };
        }

        // ---- Layout metadata normalization ----

        normalizeLayoutMetadata(layoutMember: any, structNode: any, layoutThis: any): SemanticLayoutMetadata {
            const body = layoutMember.body;
            const metadata: SemanticLayoutMetadata = {};

            if (!body) return metadata;

            // Try to extract layout properties from return statement in body
            const statements = body.statements ?? body.body?.statements ?? [];
            for (const stmt of statements) {
                if (stmt.kind === Kinds.Statements.ReturnStatement ||
                    stmt.kind === "ReturnStatement") {
                    const value = stmt.value ?? stmt.expression;
                    this.extractLayoutProperties(value, metadata, structNode, layoutThis);
                    break;
                }
            }

            return metadata;
        }

        extractLayoutProperties(node: any, metadata: SemanticLayoutMetadata, structNode: any, layoutThis: any): void {
            if (!node) return;

            // Handle object literal: { pointer: true, mutable: true, ... }
            const properties =
                node.properties ??
                node.fields ??
                node.members ??
                [];

            for (const prop of properties) {
                const key = prop.key ?? prop.name ?? prop.property;
                const value = prop.value ?? prop.expression;

                if (!key) continue;

                const keyStr = typeof key === "string" ? key : (key.name ?? key.value ?? key.raw ?? "");

                if (!keyStr) continue;

                const normalized = this.resolveConstantValue(value, structNode, layoutThis);

                switch (keyStr) {
                    case "pointer":
                        if (typeof normalized === "boolean") metadata.pointer = normalized;
                        break;
                    case "mutable":
                        if (typeof normalized === "boolean") metadata.mutable = normalized;
                        break;
                    case "nullable":
                        if (typeof normalized === "boolean") metadata.nullable = normalized;
                        break;
                    case "bits":
                    case "size":
                        if (typeof normalized === "number") metadata.bits = normalized;
                        break;
                    case "signed":
                        if (typeof normalized === "boolean") metadata.signed = normalized;
                        break;
                    case "align":
                        if (typeof normalized === "number") metadata.align = normalized;
                        break;
                    case "packed":
                        if (typeof normalized === "boolean") metadata.packed = normalized;
                        break;
                    case "encoding":
                        if (typeof normalized === "string") metadata.encoding = normalized;
                        break;
                    case "storage":
                        if (typeof normalized === "string") metadata.storage = normalized;
                        break;
                    case "maxLength":
                        if (typeof normalized === "number") metadata.maxLength = normalized;
                        break;
                    case "nullTerminated":
                        if (typeof normalized === "boolean") metadata.nullTerminated = normalized;
                        break;
                    default:
                        // Unknown layout properties are silently ignored
                        break;
                }
            }

            this.normalizeIntegerLayoutMetadata(metadata, structNode);
        }

        normalizeIntegerLayoutMetadata(metadata: SemanticLayoutMetadata, structNode: any): void {
            if (metadata.bits === undefined || metadata.bits === null || metadata.bits === 0) {
                return;
            }

            const supportedSizes = new Set([8, 16, 32, 64, 128]);
            if (!Number.isInteger(metadata.bits) || !supportedSizes.has(metadata.bits)) {
                const structName = this.getNameText(structNode.name);
                const message =
                    `layout() in struct ${Helpers.RED}'${structName}'${Helpers.RESET} has unsupported integer size ` +
                    `${Helpers.RED}'${metadata.bits}'${Helpers.RESET}`;

                structNode.arrowLength = structNode.raw?.length ?? structName.length;

                this.throwError(
                    message,
                    structNode.position,
                    structNode.raw ?? structNode.source,
                    structNode,
                    "  = supported IntegerLayout sizes are 8, 16, 32, 64, and 128",
                );
            }

            if (metadata.signed === undefined) {
                metadata.signed = true;
            }

            if (metadata.align === undefined || metadata.align === 0) {
                metadata.align = metadata.bits === 128 ? 16 : metadata.bits / 8;
            }
        }

        resolveConstantValue(node: any, structNode?: any, layoutThis?: any): string | number | boolean | null {
            if (!node) return null;

            if (
                node.kind === Kinds.Expressions.PropertyAccessExpression ||
                node.kind === "PropertyAccessExpression"
            ) {
                return this.resolveLayoutThisValue(node, structNode, layoutThis);
            }

            // Literal values
            if (node.kind === Kinds.Literals.BooleanLiteral ||
                node.kind === "BooleanLiteral") {
                return node.value === true || node.value === "true";
            }

            if (node.kind === Kinds.Literals.NumberLiteral ||
                node.kind === "NumberLiteral" ||
                node.value !== undefined && typeof node.value === "number") {
                return Number(node.value);
            }

            if (node.kind === Kinds.Literals.StringLiteral ||
                node.kind === "StringLiteral" ||
                typeof node.value === "string") {
                return String(node.value);
            }

            // TrueKeyword / FalseKeyword from visitor
            if (node.kind === "BooleanLiteral" && typeof node.value === "boolean") {
                return node.value;
            }

            // Try value field
            if (node.value !== undefined) {
                if (typeof node.value === "boolean") return node.value;
                if (typeof node.value === "number") return node.value;
                if (typeof node.value === "string") return node.value;
            }

            // Try raw field
            if (typeof node.raw === "string") {
                if (node.raw === "true") return true;
                if (node.raw === "false") return false;
                const num = Number(node.raw);
                if (!Number.isNaN(num)) return num;
                const stripped = node.raw.replace(/^['"`]|['"`]$/g, "");
                return stripped;
            }

            return null;
        }

        resolveLayoutThisValue(node: any, structNode?: any, layoutThis?: any): string | number | boolean | null {
            const object = node.object;
            const isThis =
                object?.kind === Kinds.Expressions.ThisExpression ||
                object?.kind === "ThisExpression" ||
                object?.source === "this" ||
                object?.raw === "this";

            if (!isThis) {
                return null;
            }

            const property = node.property;

            switch (property) {
                case "name":
                    return layoutThis?.structName ?? this.getNameText(structNode?.name);
                case "parent":
                    return layoutThis?.parentName ?? "";
                case "hasParent":
                    return Boolean(layoutThis?.parentName);
                case "fieldCount":
                    return Number(layoutThis?.fieldCount ?? 0);
                case "isScalar":
                    return Boolean(layoutThis?.isScalar);
                default: {
                    const structName = this.getNameText(structNode?.name);
                    const message =
                        `layout() in struct ${Helpers.RED}'${structName}'${Helpers.RESET} cannot access runtime field ` +
                        `${Helpers.RED}'this.${property}'${Helpers.RESET}`;

                    node.arrowLength = node.source?.length ?? property?.length ?? 1;
                    this.throwError(
                        message,
                        node.position ?? structNode?.position,
                        structNode?.raw ?? structNode?.source,
                        node,
                        "  = layout() receives compile-time layout metadata, not a constructed struct instance",
                    );
                }
            }
        }

        // ---- Symbol helpers ----

        getStructFieldsFromSymbol(symbol: any, typeUsage: any = null): any[] {
            if (!symbol?.node) return [];

            if (
                symbol.kind === Kinds.ScopeSymbols.Interface ||
                symbol.kind === Kinds.ScopeSymbols.Type
            ) {
                return ((this as any).getExtensibleMembersFromSymbol?.(symbol, typeUsage) ?? [])
                    .filter((m: any) =>
                        m.kind === Kinds.Types.StructFieldDeclaration ||
                        m.kind === "StructFieldDeclaration" ||
                        m.kind === Kinds.Types.PropertySignature ||
                        m.kind === "PropertySignature"
                    );
            }

            const fields = symbol.node.fields ?? [];
            if (fields.length > 0) return fields;

            // Fallback to extracting from body members
            const body = symbol.node.body ?? symbol.node.type;
            const members = body?.members ?? [];
            return members.filter((m: any) =>
                m.kind === Kinds.Types.StructFieldDeclaration ||
                m.kind === "StructFieldDeclaration" ||
                m.kind === Kinds.Types.PropertySignature ||
                m.kind === "PropertySignature"
            );
        }

        getStructLayoutFromSymbol(symbol: any): any {
            if (!symbol?.node) return null;
            return symbol.node.layout ?? null;
        }

        getStructHasValidateFromSymbol(symbol: any): boolean {
            if (!symbol?.node) return false;
            return symbol.node.hasValidate ?? false;
        }

        getStructValidateChainFromSymbol(symbol: any): string[] {
            if (!symbol?.node) return [];
            return Array.isArray(symbol.node.validateChain)
                ? [...symbol.node.validateChain]
                : [];
        }

        getStructIsScalarFromSymbol(symbol: any): boolean {
            if (!symbol?.node) return false;
            return symbol.node.isScalar ?? false;
        }
    };
}
