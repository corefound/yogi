
import { Kinds, Types } from "../helpers/types";
import { Helpers } from "../helpers";

import { Scope } from "./scope";
export type Constructor<T = {}> = new (...args: any[]) => T;
export type Mixin<T extends Constructor> = <TBase extends Constructor>(Base: TBase) => T & TBase;
export type MixinFunction = (base: any) => any;

type LivePointerProvenance = {
    pointerName: string;
    pointerSymbolId: number;
    pointerScopeId: number;
    rootName: string;
    rootSymbolId?: number;
    accessPath: string[];
    invalidated?: {
        operation: string;
        reason: string;
        source?: string;
        position?: any;
        maybe?: boolean;
    };
};

export function applySemanticMixins<TBase extends Constructor>(Base: TBase, ...mixins: MixinFunction[]): TBase | any {
    return mixins.reduce((current, mixin) => mixin(current), Base);
}

export class BaseSemantic {
    public modulePath: any = {};
    public sourceText = "";
    public symbolId = 0;
    public nextScopeId = 1;
    public loopDepth = 0;
    public switchDepth = 0;
    public switchBodyDeclClause: Map<string, number> | null = null;
    public switchBodyCurrentClause: number = -1;
    public switchBodyScopeId: number | null = null;
    public switchBodyKnownEntryClause: number | null = null;
    public currentFunctionReturnType: any = null;

    public globalScope: Scope;
    public currentScope: Scope;

    public ast: Types.Ast[];
    public diagnostics: Types.Diagnostics[] = [];
    public modules: Map<string, Types.SemanticModuleInfo> = new Map();
    public exportedSymbols: Map<string, Types.SemanticModuleSymbol> = new Map();
    public externalLinks: Map<string, Types.Sir.GlobalMetaLinkInput> = new Map();
    public functionEffectSummaries: Map<number, Types.Sir.SemanticFunctionEffectSummary> = new Map();
    public symbolsById: Map<number, Types.SymbolInfo> = new Map();
    public livePointerProvenance: Map<number, LivePointerProvenance> = new Map();
    public dynamicArrayKnownLengths: Map<number, number | null> = new Map();

    constructor(ast: Types.Ast[]) {
        this.ast = ast;

        this.globalScope = new Scope(0, null);
        this.currentScope = this.globalScope;
    }

    public installBuiltins() {
        if (this.globalScope.hasLocal("print")) {
            return;
        }

        const anyType = {
            kind: Kinds.Types.AnyType,
            raw: "any",
        };
        const voidType = {
            kind: Kinds.Types.VoidType,
            raw: "void",
        };
        const printNode = {
            kind: Kinds.Functions.FunctionDeclaration,
            name: "print",
            builtinMethod: "print",
            params: [
                {
                    kind: Kinds.Functions.FunctionParameter,
                    name: "value",
                    type: anyType,
                    source: "value: any",
                },
            ],
            returnType: voidType,
            type: {
                kind: Kinds.Types.FunctionType,
                raw: "(value: any) => void",
                parameters: [
                    {
                        name: "value",
                        type: anyType,
                    },
                ],
                returnType: voidType,
            },
        };
        const effectSummary: Types.Sir.SemanticFunctionEffectSummary = {
            parameterEffects: [
                {
                    index: 0,
                    returns: false,
                    stores: false,
                    escapes: false,
                    mutates: false,
                    consumes: false,
                },
            ],
            returnsAggregate: false,
            returnBorrow: {
                ownership: "owned",
                parameterIndex: -1,
                readonlyFollowsParameter: false,
                viewShape: [],
            },
        };

        const symbol = this.defineSymbol({
            kind: Kinds.ScopeSymbols.Function,
            name: "print",
            linkageName: null,
            qualifiedName: "@builtin:print",
            type: printNode.type,
            mutable: false,
            trusted: true,
            effectSummary,
            node: {
                ...printNode,
                effectSummary,
            },
        });

        this.functionEffectSummaries.set(symbol.id, effectSummary);
    }

    public createSymbolId() {
        return this.symbolId++;
    }

    public getCurrentScopeId() {
        return this.currentScope.id;
    }

    public enterScope() {
        const scope = new Scope(this.nextScopeId++, this.currentScope);
        this.currentScope = scope;
        return scope;
    }

    public exitScope() {
        const exitingScopeId = this.currentScope.id;

        for (const [pointerSymbolId, provenance] of this.livePointerProvenance.entries()) {
            if (provenance.pointerScopeId === exitingScopeId) {
                this.livePointerProvenance.delete(pointerSymbolId);
            }
        }

        if (this.currentScope.parent) {
            this.currentScope = this.currentScope.parent;
        }
    }

    public defineSymbol(symbol: Omit<Types.SymbolInfo, "id" | "scopeId">) {
        const fullSymbol: Types.SymbolInfo = {
            id: this.createSymbolId(),
            scopeId: this.getCurrentScopeId(),
            ...symbol,
        };

        this.currentScope.define(fullSymbol);
        this.symbolsById.set(fullSymbol.id, fullSymbol);

        return fullSymbol;
    }

    public exportSymbol(symbol: Types.SymbolInfo) {
        this.exportedSymbols.set(symbol.name, {
            name: symbol.name,
            kind: symbol.kind,
            type: symbol.type,
            mutable: symbol.mutable,
            linkageName: symbol.linkageName ?? null,
            qualifiedName: symbol.qualifiedName,
            sourcePath: this.modulePath.relativePath,
            effectSummary: symbol.effectSummary,
        });
    }

    public registerExternalLink(link: Types.Sir.GlobalMetaLinkInput) {
        this.externalLinks.set(`${link.kind}:${link.path}`, link);
    }

    public resolveSymbol(name: string) {
        return this.currentScope.resolve(name);
    }

    public resolveLocalSymbol(name: string) {
        return this.currentScope.resolveLocal(name);
    }

    public getLinkageName(modulePath: string, symbolName: string): string {
        return `_yogi_${modulePath?.replace(/[\\/]/g, "_").replace(/\./g, "_")}__${symbolName}`;
    }

    public getQualifiedName(modulePath: string, symbolName: string): string {
        return `${modulePath?.replace(/[\\/]/g, ":")}:${symbolName}`;
    }

    public getTypeReferenceName(type: any): string {
        if (!type) return "";

        const name = type.name ?? type;

        if (typeof name === "string") {
            return name;
        }

        if (Array.isArray(name.parts)) {
            return name.parts
                .map((part: any) => part.name ?? part.value ?? part.raw ?? "")
                .join(".");
        }

        return name.name ?? name.value ?? name.raw ?? "";
    }

    public resolveType(type: any, seen = new Set<string>()): any {
        if (!type) return type;

        if (type.kind !== Kinds.Types.TypeReference) {
            return type;
        }

        const name = this.getTypeReferenceName(type);

        if (!name || seen.has(name)) {
            return type;
        }

        const symbol = this.resolveSymbol(name);

        if (
            !symbol ||
            (
                symbol.kind !== Kinds.ScopeSymbols.Type &&
                symbol.kind !== Kinds.ScopeSymbols.Interface &&
                symbol.kind !== Kinds.ScopeSymbols.Struct
            )
        ) {
            return type;
        }

        seen.add(name);

        if (symbol.kind === Kinds.ScopeSymbols.Struct) {
            return symbol.type ?? symbol.node?.type ?? symbol.node;
        }

        const resolved = this.applyTypeArgumentsToSymbol(symbol, type);
        return this.resolveType(resolved, seen);
    }

    public applyTypeArgumentsToSymbol(symbol: any, typeUsage: any): any {
        const parameters = symbol?.node?.parameters ?? symbol?.node?.typeParameters ?? [];
        const providedArguments =
            (typeUsage?.arguments?.length ? typeUsage.arguments : null) ??
            (typeUsage?.typeArguments?.length ? typeUsage.typeArguments : null) ??
            (typeUsage?.name?.arguments?.length ? typeUsage.name.arguments : null) ??
            (typeUsage?.name?.typeArguments?.length ? typeUsage.name.typeArguments : null) ??
            [];
        const substitutions = new Map<string, any>();

        parameters.forEach((parameter: any, index: number) => {
            const name = this.getNameText(parameter.name);
            if (!name) return;

            const argument = providedArguments[index] ?? parameter.defaultType;
            if (argument) {
                substitutions.set(name, argument);
            }
        });

        const type = symbol.type ?? symbol.node?.type;
        return substitutions.size > 0
            ? this.substituteType(type, substitutions)
            : type;
    }

    public substituteType(type: any, substitutions: Map<string, any>): any {
        if (!type || typeof type !== "object") return type;

        if (type.kind === Kinds.Types.TypeReference) {
            const name = this.getTypeReferenceName(type);
            if (substitutions.has(name)) {
                return this.substituteType(substitutions.get(name), substitutions);
            }

            return {
                ...type,
                arguments: (type.arguments ?? type.typeArguments ?? []).map((argument: any) =>
                    this.substituteType(argument, substitutions),
                ),
            };
        }

        if (type.kind === Kinds.Types.ArrayType) {
            return {
                ...type,
                elementType: this.substituteType(type.elementType, substitutions),
            };
        }

        if (type.kind === Kinds.Types.PointerType) {
            const elementType = type.elementType ?? type.pointee ?? type.pointeeType;

            return {
                ...type,
                elementType: this.substituteType(elementType, substitutions),
                pointee: this.substituteType(elementType, substitutions),
                pointeeType: this.substituteType(elementType, substitutions),
            };
        }

        if (type.kind === Kinds.Types.TupleType) {
            return {
                ...type,
                elements: (type.elements ?? []).map((element: any) =>
                    this.substituteType(element, substitutions),
                ),
            };
        }

        if (type.kind === Kinds.Types.UnionType || type.kind === Kinds.Types.IntersectionType) {
            return {
                ...type,
                types: (type.types ?? []).map((item: any) =>
                    this.substituteType(item, substitutions),
                ),
            };
        }

        if (type.kind === Kinds.Types.TypeLiteral) {
            return {
                ...type,
                members: (type.members ?? []).map((member: any) =>
                    this.substituteTypeMember(member, substitutions),
                ),
            };
        }

        if (type.kind === Kinds.Types.FunctionType) {
            return {
                ...type,
                parameters: (type.parameters ?? []).map((parameter: any) => ({
                    ...parameter,
                    type: this.substituteType(parameter.type, substitutions),
                })),
                returnType: this.substituteType(type.returnType, substitutions),
            };
        }

        return type;
    }

    public substituteTypeMember(member: any, substitutions: Map<string, any>): any {
        if (!member || typeof member !== "object") return member;

        return {
            ...member,
            type: member.type ? this.substituteType(member.type, substitutions) : member.type,
            returnType: member.returnType ? this.substituteType(member.returnType, substitutions) : member.returnType,
            parameters: Array.isArray(member.parameters)
                ? member.parameters.map((parameter: any) => ({
                    ...parameter,
                    type: this.substituteType(parameter.type, substitutions),
                }))
                : member.parameters,
        };
    }

    public toSerializableType(type: any, seen = new Set<string>()): any {
        if (!type || typeof type !== "object") {
            return type;
        }

        if (type.kind === Kinds.Types.TypeReference) {
            const name = this.getTypeReferenceName(type);
            const serialized: any = {
                ...type,
                nameText: name,
            };

            if (name && !seen.has(name)) {
                const symbol = this.resolveSymbol(name);

                if (
                    symbol &&
                    (
                        symbol.kind === Kinds.ScopeSymbols.Type ||
                        symbol.kind === Kinds.ScopeSymbols.Interface ||
                        symbol.kind === Kinds.ScopeSymbols.Struct
                    )
                ) {
                    const nextSeen = new Set(seen);
                    nextSeen.add(name);
                    const resolved = this.applyTypeArgumentsToSymbol(symbol, type);
                    serialized.resolved = this.toSerializableType(
                        resolved,
                        nextSeen,
                    );
                }
            }

            return serialized;
        }

        if (type.kind === Kinds.Types.PointerType) {
            const elementType = type.elementType ?? type.pointee ?? type.pointeeType;

            return {
                ...type,
                elementType: elementType ? this.toSerializableType(elementType, seen) : elementType,
                pointee: elementType ? this.toSerializableType(elementType, seen) : elementType,
                pointeeType: elementType ? this.toSerializableType(elementType, seen) : elementType,
            };
        }

        if (Array.isArray(type.types)) {
            return {
                ...type,
                types: type.types.map((child: any) => this.toSerializableType(child, seen)),
            };
        }

        if (Array.isArray(type.elements)) {
            return {
                ...type,
                elements: type.elements.map((child: any) => this.toSerializableType(child, seen)),
            };
        }

        if (Array.isArray(type.members)) {
            return {
                ...type,
                members: type.members.map((member: any) => ({
                    ...member,
                    type: member.type ? this.toSerializableType(member.type, seen) : member.type,
                    returnType: member.returnType ? this.toSerializableType(member.returnType, seen) : member.returnType,
                    parameters: Array.isArray(member.parameters)
                        ? member.parameters.map((parameter: any) => ({
                            ...parameter,
                            type: parameter.type ? this.toSerializableType(parameter.type, seen) : parameter.type,
                        }))
                        : member.parameters,
                })),
            };
        }

        if (type.elementType) {
            return {
                ...type,
                elementType: this.toSerializableType(type.elementType, seen),
            };
        }

        return type;
    }

    public isTypeAssignable(expectedType: any, actualType: any): boolean {
        if (!expectedType || !actualType) return false;

        expectedType = this.resolveType(expectedType);
        actualType = this.resolveType(actualType);

        if (!expectedType || !actualType) return false;

        if (
            expectedType.kind === Kinds.Types.AnyType ||
            expectedType.kind === Kinds.Types.UnknownType
        ) {
            return true;
        }

        if (
            actualType.kind === Kinds.Types.AnyType ||
            actualType.kind === Kinds.Types.UnknownType
        ) {
            return false;
        }

        if (actualType.kind === Kinds.Types.NeverType) {
            return true;
        }

        if (this.isPointerType(expectedType) || this.isPointerType(actualType)) {
            return this.isPointerAssignable(expectedType, actualType);
        }

        const expectedScalarBase = this.scalarStructBaseType(expectedType);
        if (expectedScalarBase) {
            return this.isTypeAssignable(expectedScalarBase, actualType);
        }

        const actualScalarBase = this.scalarStructBaseType(actualType);
        if (actualScalarBase) {
            return this.isTypeAssignable(expectedType, actualScalarBase);
        }

        if (expectedType.kind === Kinds.Types.UnionType && actualType.kind === Kinds.Types.UnionType) {
            return (actualType.types ?? []).every((type: any) => {
                return this.isTypeAssignable(expectedType, type);
            });
        }

        if (expectedType.kind === Kinds.Types.UnionType) {
            return (expectedType.types ?? []).some((type: any) => {
                return this.isTypeAssignable(type, actualType);
            });
        }

        if (actualType.kind === Kinds.Types.UnionType) {
            return (actualType.types ?? []).every((type: any) => {
                return this.isTypeAssignable(expectedType, type);
            });
        }

        if (expectedType.kind === Kinds.Types.IntersectionType) {
            return (expectedType.types ?? []).every((type: any) => {
                return this.isTypeAssignable(type, actualType);
            });
        }

        if (actualType.kind === Kinds.Types.IntersectionType) {
            return (actualType.types ?? []).some((type: any) => {
                return this.isTypeAssignable(expectedType, type);
            });
        }

        if (expectedType.kind === Kinds.Types.ArrayType) {
            if (actualType.kind === Kinds.Types.ArrayType) {
                const expectedShape = expectedType.shape ?? [];
                const actualShape = actualType.shape ?? [];

                if (expectedShape.length > 0 || actualShape.length > 0) {
                    if (expectedShape.length !== actualShape.length) return false;
                    if (!expectedShape.every((size: number, index: number) => size === actualShape[index])) {
                        return false;
                    }
                }

                return this.isTypeAssignable(expectedType.elementType, actualType.elementType);
            }

            if (actualType.kind === Kinds.Types.TupleType) {
                if (expectedType.fixed === true && Array.isArray(expectedType.shape) && expectedType.shape.length > 0) {
                    return this.isTupleAssignableToFixedArray(expectedType, actualType, 0);
                }

                return (actualType.elements ?? []).every((element: any) => {
                    return this.isTypeAssignable(expectedType.elementType, element);
                });
            }

            return false;
        }

        if (expectedType.kind === Kinds.Types.TupleType) {
            if (actualType.kind !== Kinds.Types.TupleType) return false;

            const expectedElements = expectedType.elements ?? [];
            const actualElements = actualType.elements ?? [];

            if (expectedElements.length !== actualElements.length) return false;

            return expectedElements.every((type: any, index: number) => {
                return this.isTypeAssignable(type, actualElements[index]);
            });
        }

        if (this.isObjectLikeType(expectedType)) {
            return this.isObjectLikeAssignable(expectedType, actualType);
        }

        if (expectedType.kind === Kinds.Types.LiteralType) {
            return this.isLiteralAssignable(expectedType, actualType);
        }

        if (actualType.kind === Kinds.Types.LiteralType) {
            return this.isTypeAssignable(expectedType, this.literalTypeBase(actualType));
        }

        return expectedType.kind === actualType.kind;
    }

    public isPointerType(type: any): boolean {
        return this.resolveType(type)?.kind === Kinds.Types.PointerType;
    }

    public pointerPointeeType(type: any): any | null {
        const resolved = this.resolveType(type);

        if (resolved?.kind !== Kinds.Types.PointerType) {
            return null;
        }

        return this.resolveType(resolved.elementType ?? resolved.pointee ?? resolved.pointeeType);
    }

    public canReadThroughPointer(expectedType: any, actualType: any): boolean {
        const expected = this.resolveType(expectedType);
        const actual = this.resolveType(actualType);
        const pointee = this.pointerPointeeType(actual);

        if (!expected || !actual || !pointee) {
            return false;
        }

        if (expected.kind === Kinds.Types.PointerType) {
            return false;
        }

        if (this.isAggregateType(pointee)) {
            return false;
        }

        return this.isTypeAssignable(expected, pointee);
    }

    public createImplicitPointerReadThrough(value: any, expectedType: any, source: string): any {
        this.assertPointerTargetUsable(value, source);

        const pointerType = this.resolveType(value?.declaredType ?? value?.type);
        const pointee = this.toSerializableType(this.pointerPointeeType(pointerType) ?? {
            kind: Kinds.Types.UnknownType,
            raw: "unknown",
        });
        const identifierName = value?.kind === Kinds.Expressions.IdentifierExpression
            ? value.value ?? value.name ?? value.raw ?? null
            : null;
        const rootName =
            value?.pointerRootName ??
            value?.rootName ??
            identifierName;
        const rootSymbol =
            typeof value?.pointerRootSymbolId === "number"
                ? this.getSymbolById(value.pointerRootSymbolId)
                : typeof value?.rootSymbolId === "number"
                    ? this.getSymbolById(value.rootSymbolId)
                    : rootName
                        ? this.resolveSymbol(rootName)
                        : null;
        const permission = value?.pointerPermission ?? value?.permission ?? "mutable";
        const borrowedView = this.isAggregateType(pointee);

        return {
            kind: Kinds.Expressions.DereferenceExpression,
            target: value,
            type: pointee,
            rootName,
            rootSymbolId:
                value?.pointerRootSymbolId ??
                value?.rootSymbolId ??
                rootSymbol?.id,
            accessPath: [
                ...(value?.pointerAccessPath ?? value?.accessPath ?? []),
                "read",
            ],
            permission,
            pointerRootName: rootName,
            pointerRootSymbolId:
                value?.pointerRootSymbolId ??
                value?.rootSymbolId ??
                rootSymbol?.id,
            pointerAccessPath: [
                ...(value?.pointerAccessPath ?? value?.accessPath ?? []),
                "read",
            ],
            pointerPermission: permission,
            borrowedView,
            borrowedViewReadonly: borrowedView && permission === "readonly",
            borrowedViewSourceName: borrowedView ? rootName : null,
            readonly: permission === "readonly",
            implicitPointerReadThrough: true,
            source: value?.source ?? value?.raw ?? source,
            fullSource: value?.fullSource ?? source,
            position: value?.position,
        };
    }

    public pointerReadThroughMismatchMessage(expectedType: any, actualType: any): string {
        const expected = this.resolveType(expectedType);
        const actual = this.resolveType(actualType);
        const pointee = this.pointerPointeeType(actual);

        return `expected ${Helpers.BLUE}'${expectedType?.raw ?? expected?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
            `${Helpers.RED}'${actualType?.raw ?? actual?.raw ?? "unknown"}'${Helpers.RESET}` +
            (pointee
                ? ` pointing to ${Helpers.BLUE}'${pointee.raw ?? "unknown"}'${Helpers.RESET}`
                : "");
    }

    public isPointerAssignable(expectedType: any, actualType: any): boolean {
        const expected = this.resolveType(expectedType);
        const actual = this.resolveType(actualType);

        if (
            expected?.kind !== Kinds.Types.PointerType ||
            actual?.kind !== Kinds.Types.PointerType
        ) {
            return false;
        }

        return this.areTypesStructurallySame(
            expected.elementType ?? expected.pointee ?? expected.pointeeType,
            actual.elementType ?? actual.pointee ?? actual.pointeeType,
        );
    }

    public areTypesStructurallySame(leftType: any, rightType: any): boolean {
        const left = this.resolveType(leftType);
        const right = this.resolveType(rightType);

        if (!left || !right || left.kind !== right.kind) {
            return false;
        }

        if (left.kind === Kinds.Types.PointerType) {
            return this.areTypesStructurallySame(
                left.elementType ?? left.pointee,
                right.elementType ?? right.pointee,
            );
        }

        if (left.kind === Kinds.Types.ArrayType) {
            const leftShape = left.shape ?? [];
            const rightShape = right.shape ?? [];

            if (left.fixed === true || right.fixed === true) {
                if (left.fixed !== right.fixed) return false;
                if (leftShape.length !== rightShape.length) return false;
                if (!leftShape.every((size: number, index: number) => size === rightShape[index])) return false;
            }

            return this.areTypesStructurallySame(left.elementType, right.elementType);
        }

        if (left.kind === Kinds.Types.TupleType) {
            const leftElements = left.elements ?? [];
            const rightElements = right.elements ?? [];

            if (leftElements.length !== rightElements.length) return false;

            return leftElements.every((item: any, index: number) =>
                this.areTypesStructurallySame(item, rightElements[index]),
            );
        }

        if (left.kind === Kinds.Types.UnionType || left.kind === Kinds.Types.IntersectionType) {
            const leftTypes = left.types ?? [];
            const rightTypes = right.types ?? [];

            if (leftTypes.length !== rightTypes.length) return false;

            return leftTypes.every((item: any, index: number) =>
                this.areTypesStructurallySame(item, rightTypes[index]),
            );
        }

        if (left.kind === Kinds.Types.TypeReference) {
            return this.getTypeReferenceName(left) === this.getTypeReferenceName(right);
        }

        return left.raw === right.raw || left.kind === right.kind;
    }

    public fixedArraySliceType(arrayType: any, consumedDimensions: number): any {
        const shape = arrayType?.shape ?? [];
        const remainingShape = shape.slice(consumedDimensions);

        if (!remainingShape.length) {
            return arrayType?.elementType;
        }

        return {
            ...arrayType,
            elementType: arrayType?.elementType,
            fixed: true,
            shape: remainingShape,
            raw: `${arrayType?.elementType?.raw ?? "unknown"}[${remainingShape.join(", ")}]`,
        };
    }

    public isTupleAssignableToFixedArray(expectedType: any, actualType: any, dimension: number): boolean {
        const shape = expectedType?.shape ?? [];
        const elements = actualType?.elements ?? [];

        if (elements.length !== shape[dimension]) return false;

        if (dimension === shape.length - 1) {
            return elements.every((element: any) => {
                return this.isTypeAssignable(expectedType.elementType, element);
            });
        }

        return elements.every((element: any) => {
            const resolved = this.resolveType(element);
            return resolved?.kind === Kinds.Types.TupleType &&
                this.isTupleAssignableToFixedArray(expectedType, resolved, dimension + 1);
        });
    }

    public scalarStructBaseType(type: any): any {
        const resolved = this.resolveType(type);

        if (
            (
                resolved?.kind === Kinds.Types.StructDeclaration ||
                resolved?.kind === "StructDeclaration"
            ) &&
            resolved.isScalar === true &&
            resolved.extends
        ) {
            return this.resolveType(resolved.extends);
        }

        return null;
    }

    public isLiteralAssignable(expectedType: any, actualType: any): boolean {
        const expectedLiteral = expectedType.literal ?? expectedType.raw;
        const actualLiteral = actualType.literal ?? actualType.raw;

        if (actualType.kind === Kinds.Types.LiteralType) {
            return expectedLiteral === actualLiteral;
        }

        return expectedLiteral === actualType.value || expectedLiteral === actualType.raw;
    }

    public literalTypeBase(type: any): any {
        const literal = String(type.literal ?? type.raw ?? "");

        if (literal === "true" || literal === "false") {
            return { kind: Kinds.Types.BooleanType, raw: "boolean" };
        }

        if (literal === "null") {
            return { kind: Kinds.Types.NullType, raw: "null" };
        }

        if (literal === "undefined") {
            return { kind: Kinds.Types.UndefinedType, raw: "undefined" };
        }

        if (/^['"`]/.test(literal)) {
            return { kind: Kinds.Types.StringType, raw: "string" };
        }

        if (!Number.isNaN(Number(literal))) {
            return { kind: Kinds.Types.NumberType, raw: "number" };
        }

        return { kind: Kinds.Types.UnknownType, raw: "unknown" };
    }

    public isObjectLikeType(type: any): boolean {
        const resolved = this.resolveType(type);
        if (resolved?.kind === Kinds.Types.IntersectionType) {
            return (resolved.types ?? []).every((part: any) => this.isObjectLikeType(part));
        }

        return (
            resolved?.kind === Kinds.Types.TypeLiteral ||
            resolved?.kind === Kinds.Types.InterfaceDeclaration ||
            resolved?.kind === Kinds.Types.StructDeclaration ||
            resolved?.kind === "StructDeclaration"
        );
    }

    public objectMembers(type: any): any[] {
        const resolved = this.resolveType(type);
        if (resolved?.kind === Kinds.Types.IntersectionType) {
            return (resolved.types ?? []).flatMap((part: any) => this.objectMembers(part));
        }

        if (
            resolved?.kind === Kinds.Types.StructDeclaration ||
            resolved?.kind === "StructDeclaration"
        ) {
            return resolved.fields ?? [];
        }

        return resolved?.members ?? resolved?.body?.members ?? [];
    }

    public getMemberNameText(member: any): string | null {
        const name = member?.name ?? member?.key;

        if (!name) return null;

        if (typeof name === "string") return name;
        if (typeof name.name === "string") return name.name;
        if (typeof name.value === "string") return name.value;
        if (typeof name.raw === "string") return name.raw.replace(/^['"`]|['"`]$/g, "");

        return null;
    }

    public objectPropertyMap(type: any): Map<string, any> {
        const members = this.objectMembers(type)
            .filter((member: any) => {
                return member.kind === Kinds.Types.PropertySignature ||
                    member.kind === Kinds.Types.StructFieldDeclaration ||
                    member.kind === "StructFieldDeclaration";
            });
        const map = new Map<string, any>();

        for (const member of members) {
            const name = this.getMemberNameText(member);
            if (name) map.set(name, member);
        }

        return map;
    }

    public isObjectLikeAssignable(expectedType: any, actualType: any): boolean {
        if (!this.isObjectLikeType(actualType)) return false;

        const expectedMembers = this.objectMembers(expectedType)
            .filter((member: any) => {
                return member.kind === Kinds.Types.PropertySignature ||
                    member.kind === Kinds.Types.StructFieldDeclaration ||
                    member.kind === "StructFieldDeclaration";
            });
        const actualMembers = new Map<string, any>();

        for (const member of this.objectMembers(actualType)) {
            if (
                member.kind !== Kinds.Types.PropertySignature &&
                member.kind !== Kinds.Types.StructFieldDeclaration &&
                member.kind !== "StructFieldDeclaration"
            ) continue;
            const name = this.getMemberNameText(member);
            if (name) actualMembers.set(name, member);
        }

        for (const expectedMember of expectedMembers) {
            const name = this.getMemberNameText(expectedMember);
            if (!name) continue;

            const actualMember = actualMembers.get(name);
            if (!actualMember) {
                if (expectedMember.optional) continue;
                return false;
            }

            if (!this.isTypeAssignable(expectedMember.type, actualMember.type)) {
                return false;
            }
        }

        return true;
    }

    public isStructResolvedType(type: any): boolean {
        const resolved = this.resolveType(type);
        return (
            resolved?.kind === Kinds.Types.StructDeclaration ||
            resolved?.kind === "StructDeclaration"
        );
    }

    public isObjectContractResolvedType(type: any): boolean {
        const resolved = this.resolveType(type);
        return (
            resolved?.kind === Kinds.Types.TypeLiteral ||
            resolved?.kind === Kinds.Types.InterfaceDeclaration
        );
    }

    public rejectsImplicitObjectContractConversion(expectedType: any, value: any): boolean {
        if (!expectedType || !value?.type) return false;

        const expectedIsStruct = this.isStructResolvedType(expectedType);
        const actualIsStruct = this.isStructResolvedType(value.type);
        const expectedIsContract = this.isObjectContractResolvedType(expectedType);
        const actualIsContract = this.isObjectContractResolvedType(value.type);

        if (expectedIsStruct && value.kind === Kinds.Collections.DictionaryExpression) {
            return false;
        }

        return (
            (expectedIsContract && actualIsStruct) ||
            (expectedIsStruct && actualIsContract)
        );
    }

    public throwImplicitObjectContractConversionError(expectedType: any, value: any, source: string, context: any): never {
        const expectedRaw = expectedType?.raw ?? "unknown";
        const actualRaw = value?.type?.raw ?? "unknown";
        const message =
            `cannot implicitly convert ${Helpers.RED}'${actualRaw}'${Helpers.RESET} to ` +
            `${Helpers.BLUE}'${expectedRaw}'${Helpers.RESET} because they use different runtime representations`;

        value.arrowLength = value.source?.length ?? context?.name?.length ?? 1;

        this.throwError(
            message,
            value.position ?? context?.position,
            source,
            value,
            "  = structs lower to real LLVM values\n  = interfaces and object-like type aliases lower to object-runtime values\n  = use an object literal adapter or declare the parameter as the concrete struct type",
        );

        throw new Error(message);
    }

    public validateTypeUsages(type: any, source: string): void {
        if (!type || typeof type !== "object") return;

        if (type.kind === Kinds.Types.UnknownType && type.reason === "invalid array shape syntax") {
            const message = `invalid array shape syntax`;
            type.arrowLength = type.raw?.length ?? 1;
            this.throwError(
                message,
                type.position,
                source,
                type,
                "  = use 'number[2, 3]' instead",
            );
        }

        if (type.kind === Kinds.Types.TypeReference) {
            const name = this.getTypeReferenceName(type);
            const symbol = name ? this.resolveSymbol(name) : null;

            if (!symbol && name === "prt") {
                type.arrowLength = name.length;
                this.throwError(
                    `unknown type ${Helpers.RED}'${name}'${Helpers.RESET}`,
                    type.position,
                    source,
                    type,
                    `  = did you mean 'ptr<${(type.arguments ?? type.typeArguments ?? [])[0]?.raw ?? "T"}>'?`,
                );
            }

            if (symbol) {
                (this as any).checkTypeArguments?.(type, symbol);
            }

            for (const argument of type.arguments ?? type.typeArguments ?? []) {
                this.validateTypeUsages(argument, source);
            }
            return;
        }

        if (type.elementType) {
            this.validateTypeUsages(type.elementType, source);
        }

        if (type.pointee) {
            this.validateTypeUsages(type.pointee, source);
        }

        for (const child of type.types ?? type.elements ?? []) {
            this.validateTypeUsages(child, source);
        }

        for (const member of type.members ?? []) {
            this.validateTypeUsages(member.type, source);
            this.validateTypeUsages(member.returnType, source);
            for (const parameter of member.parameters ?? []) {
                this.validateTypeUsages(parameter.type, source);
            }
        }

        for (const parameter of type.parameters ?? []) {
            this.validateTypeUsages(parameter.type, source);
        }

        this.validateTypeUsages(type.returnType, source);
    }

    public validateAggregateAssignment(expectedType: any, value: any, context: any, source: string): void {
        const resolvedType = this.resolveType(expectedType);

        if (!resolvedType || !value) return;

        if (value.kind === Kinds.Collections.DictionaryExpression && this.isObjectLikeType(resolvedType)) {
            this.validateObjectLiteralAssignment(resolvedType, value, context, source);
            return;
        }

        if (value.kind === Kinds.Collections.ArrayExpression) {
            if (resolvedType.kind === Kinds.Types.TupleType) {
                this.validateTupleLiteralAssignment(resolvedType, value, context, source);
                return;
            }

            if (resolvedType.kind === Kinds.Types.ArrayType) {
                this.validateArrayLiteralAssignment(resolvedType, value, context, source);
            }
        }
    }

    public validateObjectLiteralAssignment(expectedType: any, value: any, context: any, source: string): void {
        const expectedProperties = this.objectPropertyMap(expectedType);
        const actualProperties = new Map<string, any>();

        for (const property of value.properties ?? []) {
            const name = property.key ?? property.name;
            if (!name) continue;

            if (!expectedProperties.has(name)) {
                const message =
                    `object for ${Helpers.BLUE}'${context.name ?? "value"}'${Helpers.RESET} has unknown property ` +
                    `${Helpers.RED}'${name}'${Helpers.RESET}`;

                property.arrowLength = property.source?.length ?? String(name).length;

                this.throwError(
                    message,
                    property.position ?? value.position ?? context.position,
                    source,
                    property,
                    `  = declare '${name}' in the object type or remove it from the initializer`,
                );
            }

            actualProperties.set(name, property);
        }

        for (const [name, expectedProperty] of expectedProperties.entries()) {
            const actualProperty = actualProperties.get(name);

            if (!actualProperty) {
                if (expectedProperty.optional) continue;

                const message =
                    `object for ${Helpers.BLUE}'${context.name ?? "value"}'${Helpers.RESET} is missing required property ` +
                    `${Helpers.RED}'${name}'${Helpers.RESET}`;

                value.arrowLength = value.source?.length ?? 1;

                this.throwError(
                    message,
                    value.position ?? context.position,
                    source,
                    value,
                    `  = add '${name}: ${expectedProperty.type?.raw ?? "unknown"}' to the initializer`,
                );
            }

            if (!this.isTypeAssignable(expectedProperty.type, actualProperty.type)) {
                const message =
                    `property ${Helpers.RED}'${name}'${Helpers.RESET} must be ` +
                    `${Helpers.BLUE}'${expectedProperty.type?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                    `${Helpers.RED}'${actualProperty.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                actualProperty.arrowLength = actualProperty.source?.length ?? String(name).length;

                this.throwError(
                    message,
                    actualProperty.position ?? value.position ?? context.position,
                    source,
                    actualProperty,
                );
            }
        }
    }

    public validateArrayLiteralAssignment(expectedType: any, value: any, context: any, source: string): void {
        if (!Array.isArray(value.elements)) {
            const message =
                `${Helpers.BLUE}'${context.name ?? "value"}'${Helpers.RESET} must be initialized with an array literal`;

            this.throwError(message, value.position ?? context.position, source, value);
        }

        const shape = expectedType.shape ?? [];
        if (expectedType.fixed === true && shape.length > 0) {
            this.validateFixedArraySpreadAssignment(expectedType, value, context, source);
            this.validateFixedArrayLiteralShape(expectedType, value, context, source, 0);
            this.validateFixedArrayLiteralElementTypes(expectedType, value, context, source, 0);
            return;
        }

        for (const element of value.elements) {
            const elementExpectedType = this.resolveType(expectedType.elementType);

            if (element.kind === Kinds.Expressions.SpreadElement) {
                this.validateArraySpreadElement(expectedType.elementType, element, context, source);
                continue;
            }

            if (element.kind === Kinds.Collections.DictionaryExpression) {
                if (this.isObjectLikeType(elementExpectedType)) {
                    this.validateObjectLiteralAssignment(elementExpectedType, element, context, source);
                    continue;
                }
            }

            if (element.kind === Kinds.Collections.ArrayExpression) {
                if (
                    elementExpectedType?.kind === Kinds.Types.ArrayType ||
                    elementExpectedType?.kind === Kinds.Types.TupleType
                ) {
                    this.validateAggregateAssignment(elementExpectedType, element, context, source);
                    continue;
                }
            }

            if (!this.isTypeAssignable(expectedType.elementType, element.type)) {
                const message =
                    `array ${Helpers.BLUE}'${context.name ?? "value"}'${Helpers.RESET} can only contain ` +
                    `${Helpers.BLUE}'${expectedType.elementType?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                    `${Helpers.RED}'${element.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                element.arrowLength = element.source?.length ?? 1;

                this.throwError(
                    message,
                    element.position ?? value.position ?? context.position,
                    source,
                    element,
                );
            }
        }
    }

    public validateArraySpreadElement(expectedElementType: any, spread: any, context: any, source: string): void {
        const spreadType = this.resolveType(spread.expression?.type ?? spread.type);
        const spreadElementTypes = spreadType?.kind === Kinds.Types.TupleType
            ? spreadType.elements ?? []
            : spreadType?.kind === Kinds.Types.ArrayType
                ? [spreadType.elementType]
                : [];

        for (const elementType of spreadElementTypes) {
            if (this.isTypeAssignable(expectedElementType, elementType)) {
                continue;
            }

            const message =
                `array spread for ${Helpers.BLUE}'${context.name ?? "value"}'${Helpers.RESET} can only contain ` +
                `${Helpers.BLUE}'${expectedElementType?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                `${Helpers.RED}'${elementType?.raw ?? "unknown"}'${Helpers.RESET}`;

            spread.arrowLength = spread.source?.length ?? 1;
            this.throwError(message, spread.position ?? context.position, source, spread);
        }
    }

    public validateFixedArraySpreadAssignment(expectedType: any, value: any, context: any, source: string): void {
        if (!this.arrayLiteralContainsSpread(value)) {
            return;
        }

        const shape = expectedType.shape ?? [];
        if (shape.length !== 1) {
            const message =
                `spread inside fixed-shape array ${Helpers.BLUE}'${expectedType.raw ?? "array"}'${Helpers.RESET} ` +
                `is only supported for one-dimensional fixed arrays`;

            value.arrowLength = value.source?.length ?? 1;
            this.throwError(message, value.position ?? context.position, source, value);
        }

        const length = this.arrayLiteralKnownLength(value, context, source);
        const expectedLength = Number(shape[0] ?? 0);

        if (length !== expectedLength) {
            const message =
                `fixed-size array ${Helpers.BLUE}'${expectedType.raw ?? "array"}'${Helpers.RESET} expects ` +
                `${Helpers.BLUE}'${expectedLength}'${Helpers.RESET} element(s), got ${Helpers.RED}'${length}'${Helpers.RESET}`;

            value.arrowLength = value.source?.length ?? 1;
            this.throwError(message, value.position ?? context.position, source, value);
        }
    }

    public arrayLiteralContainsSpread(value: any): boolean {
        return (value.elements ?? []).some((element: any) => {
            return element?.kind === Kinds.Expressions.SpreadElement ||
                (element?.kind === Kinds.Collections.ArrayExpression && this.arrayLiteralContainsSpread(element));
        });
    }

    public arrayLiteralKnownLength(value: any, context: any, source: string): number {
        let length = 0;

        for (const element of value.elements ?? []) {
            if (element.kind !== Kinds.Expressions.SpreadElement) {
                length++;
                continue;
            }

            const spreadType = this.resolveType(element.expression?.type ?? element.type);

            if (spreadType?.kind === Kinds.Types.TupleType) {
                length += spreadType.elements?.length ?? 0;
                continue;
            }

            if (
                spreadType?.kind === Kinds.Types.ArrayType &&
                spreadType.fixed === true &&
                Array.isArray(spreadType.shape) &&
                spreadType.shape.length === 1
            ) {
                length += Number(spreadType.shape[0] ?? 0);
                continue;
            }

            const message =
                `cannot spread dynamic array ${Helpers.RED}'${spreadType?.raw ?? "unknown"}'${Helpers.RESET} ` +
                `into fixed-size array ${Helpers.BLUE}'${context.name ?? "value"}'${Helpers.RESET}; ` +
                `the spread length must be known at compile time`;

            element.arrowLength = element.source?.length ?? 1;
            this.throwError(message, element.position ?? value.position ?? context.position, source, element);
        }

        return length;
    }

    public validateFixedArrayLiteralShape(expectedType: any, value: any, context: any, source: string, dimension: number): void {
        const shape = expectedType.shape ?? [];
        const elements = value.elements ?? [];
        const expectedLength = shape[dimension];
        const actualLength = dimension === shape.length - 1 && this.arrayLiteralContainsSpread(value)
            ? this.arrayLiteralKnownLength(value, context, source)
            : elements.length;

        if (actualLength !== expectedLength) {
            const label = shape.length === 1 ? "fixed-size array" : "fixed-shape array";
            const dimensionText = shape.length === 1
                ? `${Helpers.BLUE}'${expectedLength}'${Helpers.RESET} element(s)`
                : `dimension ${Helpers.BLUE}'${dimension}'${Helpers.RESET} length ${Helpers.BLUE}'${expectedLength}'${Helpers.RESET}`;
            const message =
                `${label} ${Helpers.BLUE}'${expectedType.raw ?? "array"}'${Helpers.RESET} expects ` +
                `${dimensionText}, got ${Helpers.RED}'${actualLength}'${Helpers.RESET}`;

            value.arrowLength = value.source?.length ?? 1;
            this.throwError(message, value.position ?? context.position, source, value);
        }

        if (dimension >= shape.length - 1) {
            return;
        }

        for (const element of elements) {
            if (element.kind !== Kinds.Collections.ArrayExpression) {
                const message =
                    `fixed-shape array ${Helpers.BLUE}'${expectedType.raw ?? "array"}'${Helpers.RESET} expects ` +
                    `dimension ${Helpers.BLUE}'${dimension + 1}'${Helpers.RESET} to be initialized with array literals`;

                element.arrowLength = element.source?.length ?? 1;
                this.throwError(message, element.position ?? value.position ?? context.position, source, element);
            }

            this.validateFixedArrayLiteralShape(expectedType, element, context, source, dimension + 1);
        }
    }

    public validateFixedArrayLiteralElementTypes(expectedType: any, value: any, context: any, source: string, dimension: number): void {
        const shape = expectedType.shape ?? [];

        if (dimension < shape.length - 1) {
            for (const element of value.elements ?? []) {
                this.validateFixedArrayLiteralElementTypes(expectedType, element, context, source, dimension + 1);
            }
            return;
        }

        for (const element of value.elements ?? []) {
            if (element.kind === Kinds.Expressions.SpreadElement) {
                this.validateArraySpreadElement(expectedType.elementType, element, context, source);
                continue;
            }

            if (!this.isTypeAssignable(expectedType.elementType, element.type)) {
                const message =
                    `expected ${Helpers.BLUE}'${expectedType.elementType?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                    `${Helpers.RED}'${element.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                element.arrowLength = element.source?.length ?? 1;
                this.throwError(
                    message,
                    element.position ?? value.position ?? context.position,
                    source,
                    element,
                );
            }
        }
    }

    public validateTupleLiteralAssignment(expectedType: any, value: any, context: any, source: string): void {
        const expectedElements = expectedType.elements ?? [];
        const actualElements = value.elements ?? [];

        if (expectedElements.length !== actualElements.length) {
            const message =
                `tuple ${Helpers.BLUE}'${context.name ?? "value"}'${Helpers.RESET} requires ` +
                `${Helpers.BLUE}'${expectedElements.length}'${Helpers.RESET} element(s), got ` +
                `${Helpers.RED}'${actualElements.length}'${Helpers.RESET}`;

            value.arrowLength = value.source?.length ?? 1;

            this.throwError(
                message,
                value.position ?? context.position,
                source,
                value,
            );
        }

        expectedElements.forEach((expectedElement: any, index: number) => {
            const actualElement = actualElements[index];

            const resolvedExpected = this.resolveType(expectedElement);

            if (actualElement?.kind === Kinds.Collections.DictionaryExpression) {
                if (this.isObjectLikeType(resolvedExpected)) {
                    this.validateObjectLiteralAssignment(resolvedExpected, actualElement, context, source);
                    return;
                }
            }

            if (actualElement?.kind === Kinds.Collections.ArrayExpression) {
                if (
                    resolvedExpected?.kind === Kinds.Types.ArrayType ||
                    resolvedExpected?.kind === Kinds.Types.TupleType
                ) {
                    this.validateAggregateAssignment(resolvedExpected, actualElement, context, source);
                    return;
                }
            }

            if (!this.isTypeAssignable(expectedElement, actualElement?.type)) {
                const message =
                    `tuple index ${Helpers.BLUE}'${index}'${Helpers.RESET} must be ` +
                    `${Helpers.BLUE}'${expectedElement?.raw ?? "unknown"}'${Helpers.RESET}, got ` +
                    `${Helpers.RED}'${actualElement?.type?.raw ?? "unknown"}'${Helpers.RESET}`;

                actualElement.arrowLength = actualElement.source?.length ?? 1;

                this.throwError(
                    message,
                    actualElement?.position ?? value.position ?? context.position,
                    source,
                    actualElement ?? value,
                );
            }
        });
    }

    public isReadonlyType(type: any): boolean {
        const resolved = this.resolveType(type);
        return resolved?.readonly === true;
    }

    public isAggregateType(type: any): boolean {
        const resolved = this.resolveType(type);
        return (
            resolved?.kind === Kinds.Types.ArrayType ||
            resolved?.kind === Kinds.Types.TupleType ||
            this.isObjectLikeType(resolved)
        );
    }

    public isDynamicArrayType(type: any): boolean {
        const resolved = this.resolveType(type);
        const target = resolved?.kind === Kinds.Types.PointerType
            ? this.resolveType(resolved.elementType ?? resolved.pointee ?? resolved.pointeeType)
            : resolved;

        return target?.kind === Kinds.Types.ArrayType && target.fixed !== true;
    }

    public registerPointerProvenance(symbol: Types.SymbolInfo, value?: any): void {
        if (!symbol || !this.isPointerType(symbol.declaredType ?? symbol.type)) {
            return;
        }

        const rootName =
            symbol.pointerRootName ??
            value?.pointerRootName ??
            value?.rootName ??
            null;
        const rootSymbolId =
            symbol.pointerRootSymbolId ??
            value?.pointerRootSymbolId ??
            value?.rootSymbolId;
        const rootSymbol =
            this.getSymbolById(rootSymbolId) ??
            (rootName ? this.resolveSymbol(rootName) : null);
        const accessPath = symbol.pointerAccessPath ?? value?.pointerAccessPath ?? value?.accessPath ?? [];
        const rootType = rootSymbol?.declaredType ?? rootSymbol?.type;
        const sourcePointerSymbol = this.pointerSymbolFromValue(value);
        const sourceInvalidation = sourcePointerSymbol
            ? this.livePointerProvenance.get(sourcePointerSymbol.id)?.invalidated
            : undefined;

        if (
            !rootName ||
            !rootSymbol ||
            accessPath.length === 0 ||
            !this.isDynamicArrayType(rootType)
        ) {
            this.livePointerProvenance.delete(symbol.id);
            return;
        }

        this.livePointerProvenance.set(symbol.id, {
            pointerName: symbol.name,
            pointerSymbolId: symbol.id,
            pointerScopeId: symbol.scopeId,
            rootName,
            rootSymbolId: rootSymbol.id,
            accessPath,
            invalidated: sourceInvalidation ? { ...sourceInvalidation } : undefined,
        });
    }

    public assertPointerTargetUsable(value: any, source: string): void {
        const symbol = this.pointerSymbolFromValue(value);
        if (!symbol) {
            return;
        }

        const provenance = this.livePointerProvenance.get(symbol.id);
        if (!provenance?.invalidated) {
            return;
        }

        const target = value ?? {};
        const path = `${provenance.rootName}${provenance.accessPath.join("")}`;
        const maybe = provenance.invalidated.maybe === true;
        const message =
            `pointer ${Helpers.RED}'${provenance.pointerName}'${Helpers.RESET} ${maybe ? "may be" : "is"} used after its target ` +
            `dynamic array element ${Helpers.RED}'${path}'${Helpers.RESET} was removed by ` +
            `${Helpers.BLUE}'${provenance.invalidated.operation}'${Helpers.RESET}`;

        target.arrowLength = target.source?.length ?? target.raw?.length ?? provenance.pointerName.length;
        this.throwError(
            message,
            target.position ?? provenance.invalidated.position,
            source,
            target,
            `  = ${provenance.invalidated.reason}`,
        );
    }

    public setKnownDynamicArrayLength(symbol: Types.SymbolInfo | null | undefined, length: number | null): void {
        if (!symbol || !this.isDynamicArrayType(symbol.declaredType ?? symbol.type)) {
            return;
        }

        this.dynamicArrayKnownLengths.set(symbol.id, length);
    }

    public knownDynamicArrayLength(symbol: Types.SymbolInfo | null | undefined): number | null {
        if (!symbol || !this.isDynamicArrayType(symbol.declaredType ?? symbol.type)) {
            return null;
        }

        if (this.dynamicArrayKnownLengths.has(symbol.id)) {
            return this.dynamicArrayKnownLengths.get(symbol.id) ?? null;
        }

        const literalLength = this.arrayLiteralLength(symbol.node);
        this.dynamicArrayKnownLengths.set(symbol.id, literalLength);
        return literalLength;
    }

    public arrayLiteralLength(value: any): number | null {
        return value?.kind === Kinds.Collections.ArrayExpression
            ? value.elements?.length ?? 0
            : null;
    }

    public updateKnownDynamicArrayLength(
        symbol: Types.SymbolInfo | null | undefined,
        updater: (length: number | null) => number | null,
    ): void {
        if (!symbol || !this.isDynamicArrayType(symbol.declaredType ?? symbol.type)) {
            return;
        }

        this.setKnownDynamicArrayLength(symbol, updater(this.knownDynamicArrayLength(symbol)));
    }

    public markDynamicArrayPointersRemovedByIndex(
        rootName: string | null | undefined,
        rootSymbol: Types.SymbolInfo | null | undefined,
        operation: string,
        source: string,
        context: any,
        isRemovedIndex: (index: number) => boolean,
        maybe = false,
    ): void {
        if (!rootName || !rootSymbol || !this.isDynamicArrayType(rootSymbol.declaredType ?? rootSymbol.type)) {
            return;
        }

        for (const provenance of this.livePointerProvenance.values()) {
            if (
                provenance.invalidated ||
                (
                    provenance.rootSymbolId !== rootSymbol.id &&
                    provenance.rootName !== rootName
                )
            ) {
                continue;
            }

            const index = this.firstDynamicArrayIndexFromAccessPath(provenance.accessPath);
            if (index === null || !isRemovedIndex(index)) {
                continue;
            }

            const path = `${provenance.rootName}${provenance.accessPath.join("")}`;
            provenance.invalidated = {
                operation,
                reason: `slot ${index} in '${rootName}' was removed; pointer '${provenance.pointerName}' still points to '${path}'`,
                source,
                position: context?.position,
                maybe,
            };
        }
    }

    public markDynamicArrayPointersRemovedByEffect(
        rootName: string | null | undefined,
        rootSymbol: Types.SymbolInfo | null | undefined,
        effect: any,
        operation: string,
        source: string,
        context: any,
    ): boolean {
        if (!effect || !rootName || !rootSymbol || !this.isDynamicArrayType(rootSymbol.declaredType ?? rootSymbol.type)) {
            return false;
        }

        const knownLength = this.knownDynamicArrayLength(rootSymbol);
        const maybe = effect.maybe === true;

        switch (effect.kind) {
            case "shift":
                this.markDynamicArrayPointersRemovedByIndex(
                    rootName,
                    rootSymbol,
                    operation,
                    source,
                    context,
                    (index) => index === 0,
                    maybe,
                );
                return true;

            case "pop": {
                if (typeof knownLength !== "number" || knownLength <= 0) {
                    return false;
                }

                const removedIndex = knownLength - 1;
                this.markDynamicArrayPointersRemovedByIndex(
                    rootName,
                    rootSymbol,
                    operation,
                    source,
                    context,
                    (index) => index === removedIndex,
                    maybe,
                );
                return true;
            }

            case "splice": {
                if (typeof effect.start !== "number" || !Number.isInteger(effect.start)) {
                    return false;
                }

                const start = effect.start < 0
                    ? typeof knownLength === "number"
                        ? Math.max(knownLength + effect.start, 0)
                        : null
                    : effect.start;

                if (start === null) {
                    return false;
                }

                const deleteCount = typeof effect.deleteCount === "number"
                    ? Math.max(effect.deleteCount, 0)
                    : null;

                this.markDynamicArrayPointersRemovedByIndex(
                    rootName,
                    rootSymbol,
                    operation,
                    source,
                    context,
                    (index) => {
                        if (index < start) {
                            return false;
                        }

                        return deleteCount === null
                            ? true
                            : index < start + deleteCount;
                    },
                    maybe,
                );
                return true;
            }

            case "replace": {
                if (typeof effect.newLength !== "number" || !Number.isInteger(effect.newLength)) {
                    return false;
                }

                this.markDynamicArrayPointersRemovedByIndex(
                    rootName,
                    rootSymbol,
                    operation,
                    source,
                    context,
                    (index) => index >= effect.newLength,
                    maybe,
                );
                return true;
            }

            default:
                return false;
        }
    }

    public capturePointerInvalidationState(): Map<number, LivePointerProvenance> {
        const snapshot = new Map<number, LivePointerProvenance>();

        for (const [id, provenance] of this.livePointerProvenance.entries()) {
            snapshot.set(id, this.clonePointerProvenance(provenance));
        }

        return snapshot;
    }

    public restorePointerInvalidationState(snapshot: Map<number, LivePointerProvenance>): void {
        this.livePointerProvenance = new Map(
            [...snapshot.entries()].map(([id, provenance]) => [
                id,
                this.clonePointerProvenance(provenance),
            ]),
        );
    }

    public mergePointerInvalidationState(
        ...snapshots: Array<Map<number, LivePointerProvenance> | null | undefined>
    ): void {
        const reachable = snapshots.filter((snapshot): snapshot is Map<number, LivePointerProvenance> => !!snapshot);

        if (reachable.length === 0) {
            this.livePointerProvenance.clear();
            return;
        }

        const pointerIds = new Set<number>();
        reachable.forEach((snapshot) => {
            snapshot.forEach((_, id) => pointerIds.add(id));
        });

        const merged = new Map<number, LivePointerProvenance>();

        for (const pointerId of pointerIds) {
            const states = reachable
                .map((snapshot) => snapshot.get(pointerId) ?? null)
                .filter((state): state is LivePointerProvenance => !!state);

            if (states.length === 0) {
                continue;
            }

            const invalidatedStates = states.filter((state) => state.invalidated);
            const representative = invalidatedStates.length > 0
                ? this.clonePointerProvenance(invalidatedStates[0])
                : this.mergePointerProvenanceShape(states);

            if (invalidatedStates.length > 0) {
                const invalidated = invalidatedStates[0].invalidated!;
                const maybe =
                    states.length !== reachable.length ||
                    invalidatedStates.length !== states.length ||
                    invalidatedStates.some((state) => state.invalidated?.maybe === true);

                representative.invalidated = {
                    ...invalidated,
                    maybe,
                    reason: maybe
                        ? `${invalidated.reason}; this invalidation occurs only on some control-flow paths`
                        : invalidated.reason,
                };
            } else {
                delete representative.invalidated;
            }

            merged.set(pointerId, representative);
        }

        this.livePointerProvenance = merged;
    }

    public captureDynamicArrayLengthState(): Map<number, number | null> {
        return new Map(this.dynamicArrayKnownLengths);
    }

    public restoreDynamicArrayLengthState(snapshot: Map<number, number | null>): void {
        this.dynamicArrayKnownLengths = new Map(snapshot);
    }

    public mergeDynamicArrayLengthState(
        ...snapshots: Array<Map<number, number | null> | null | undefined>
    ): void {
        const reachable = snapshots.filter((snapshot): snapshot is Map<number, number | null> => !!snapshot);

        if (reachable.length === 0) {
            this.dynamicArrayKnownLengths.clear();
            return;
        }

        const ids = new Set<number>();
        reachable.forEach((snapshot) => {
            snapshot.forEach((_, id) => ids.add(id));
        });

        const merged = new Map<number, number | null>();

        for (const id of ids) {
            const values = reachable.map((snapshot) =>
                snapshot.has(id) ? snapshot.get(id) ?? null : null,
            );
            const first = values[0];
            const allSame = values.every((value) => value === first);

            merged.set(id, allSame ? first : null);
        }

        this.dynamicArrayKnownLengths = merged;
    }

    public clonePointerProvenance(provenance: LivePointerProvenance): LivePointerProvenance {
        return {
            ...provenance,
            accessPath: [...provenance.accessPath],
            invalidated: provenance.invalidated
                ? { ...provenance.invalidated }
                : undefined,
        };
    }

    public mergePointerProvenanceShape(states: LivePointerProvenance[]): LivePointerProvenance {
        const first = this.clonePointerProvenance(states[0]);
        const sameRoot = states.every((state) =>
            state.rootName === first.rootName &&
            state.rootSymbolId === first.rootSymbolId,
        );
        const samePath = states.every((state) =>
            state.accessPath.length === first.accessPath.length &&
            state.accessPath.every((part, index) => part === first.accessPath[index]),
        );

        if (!sameRoot) {
            return {
                ...first,
                rootName: first.rootName,
                rootSymbolId: first.rootSymbolId,
                accessPath: ["[?]"],
            };
        }

        return {
            ...first,
            accessPath: samePath ? first.accessPath : ["[?]"],
        };
    }

    public pointerSymbolFromValue(value: any): Types.SymbolInfo | null {
        if (!value) {
            return null;
        }

        if (typeof value.symbolId === "number") {
            return this.getSymbolById(value.symbolId);
        }

        if (value.kind !== Kinds.Expressions.IdentifierExpression) {
            return null;
        }

        const name = value.value ?? value.name ?? value.raw;
        return name ? this.resolveSymbol(name) : null;
    }

    public firstDynamicArrayIndexFromAccessPath(accessPath: string[]): number | null {
        const first = accessPath.find((part) => /^\[\s*-?\d+\s*\]$/.test(part));
        if (!first) {
            return null;
        }

        const value = Number(first.slice(1, -1).trim());
        return Number.isInteger(value) ? value : null;
    }

    public forgetPointerProvenance(symbol: Types.SymbolInfo | null | undefined): void {
        if (!symbol) {
            return;
        }

        this.livePointerProvenance.delete(symbol.id);
    }

    public findLivePointerIntoContainer(rootName: string | null | undefined, rootSymbol?: Types.SymbolInfo | null): LivePointerProvenance | null {
        if (!rootName && !rootSymbol) {
            return null;
        }

        for (const provenance of this.livePointerProvenance.values()) {
            if (
                (rootSymbol && provenance.rootSymbolId === rootSymbol.id) ||
                (rootName && provenance.rootName === rootName)
            ) {
                return provenance;
            }
        }

        return null;
    }

    public assertNoLivePointerIntoDynamicContainer(
        rootName: string | null | undefined,
        rootSymbol: Types.SymbolInfo | null | undefined,
        operation: string,
        source: string,
        context: any,
    ): void {
        if (!rootName || !rootSymbol || !this.isDynamicArrayType(rootSymbol.declaredType ?? rootSymbol.type)) {
            return;
        }

        const provenance = this.findLivePointerIntoContainer(rootName, rootSymbol);

        if (!provenance) {
            return;
        }

        const path = `${provenance.rootName}${provenance.accessPath.join("")}`;
        const operationLabel = operation === "replace"
            ? `replace ${Helpers.RED}'${rootName}'${Helpers.RESET}`
            : `call ${Helpers.RED}'${operation}'${Helpers.RESET} on ${Helpers.RED}'${rootName}'${Helpers.RESET}`;
        const message =
            `cannot ${operationLabel} while pointer ${Helpers.RED}'${provenance.pointerName}'${Helpers.RESET} ` +
            `points into ${Helpers.RED}'${path}'${Helpers.RESET}`;

        context.arrowLength = context.source?.length ?? context.raw?.length ?? rootName.length;
        this.throwError(message, context.position, source, context);
    }

    public markDynamicArrayStorageForGrowth(
        rootName: string | null | undefined,
        rootSymbol: Types.SymbolInfo | null | undefined,
        operation: string,
    ): void {
        if (!rootName || !rootSymbol || !this.isDynamicArrayType(rootSymbol.declaredType ?? rootSymbol.type)) {
            return;
        }

        const provenance = this.findLivePointerIntoContainer(rootName, rootSymbol);
        if (!provenance) {
            return;
        }

        const path = `${provenance.rootName}${provenance.accessPath.join("")}`;
        rootSymbol.dynamicArrayStorageMode = "pointer_safe_chunked_mode";
        rootSymbol.dynamicArrayStorageReasons = [
            ...(rootSymbol.dynamicArrayStorageReasons ?? []),
            `live pointer '${provenance.pointerName}' points into '${path}' during '${operation}'`,
        ];
    }

    public applyDynamicArrayStorageDecisions(nodes: any[]): any[] {
        const visit = (node: any): any => {
            if (!node || typeof node !== "object") {
                return node;
            }

            if (Array.isArray(node)) {
                return node.map(visit);
            }

            const result = { ...node };

            if (
                result.kind === Kinds.Statements.VariableDeclaration &&
                result.value?.kind === Kinds.Collections.ArrayExpression
            ) {
                const symbol = this.getSymbolById(result.symbolId);
                const isDynamicArray = this.isDynamicArrayType(symbol?.declaredType ?? symbol?.type ?? result.type);
                if (isDynamicArray) {
                    result.value = {
                        ...result.value,
                        storageMode: symbol?.dynamicArrayStorageMode ?? "contiguous_fast_path",
                    };
                }
            }

            for (const key of Object.keys(result)) {
                if (key === "type" || key === "declaredType") {
                    continue;
                }

                result[key] = visit(result[key]);
            }

            return result;
        };

        return nodes.map(visit);
    }

    public applyBorrowedViewOwnerPromotions(nodes: any[]): any[] {
        const visit = (node: any): any => {
            if (!node || typeof node !== "object") {
                return node;
            }

            if (Array.isArray(node)) {
                return node.map(visit);
            }

            const result = { ...node };

            if (
                (
                    result.kind === Kinds.Statements.VariableDeclaration ||
                    result.kind === Kinds.Statements.ArrayDeclaration
                ) &&
                typeof result.symbolId === "number"
            ) {
                const symbol = this.getSymbolById(result.symbolId);

                if (symbol?.borrowedViewOwnerPromoted === true) {
                    result.escapes = true;
                    result.storage = Kinds.Storage.stack;
                }

                if (symbol?.borrowedViewGraphEscaped === true) {
                    result.escapes = true;
                    result.storage = Kinds.Storage.stack;
                }
            }

            for (const key of Object.keys(result)) {
                if (key === "type" || key === "declaredType") {
                    continue;
                }

                result[key] = visit(result[key]);
            }

            return result;
        };

        return nodes.map(visit);
    }

    public getSymbolById(symbolId: number | undefined | null): Types.SymbolInfo | null {
        if (typeof symbolId !== "number" || symbolId < 0) {
            return null;
        }

        return this.symbolsById.get(symbolId) ?? null;
    }

    public getIdentifierName(node: any): string | null {
        if (!node) return null;
        return node.value ?? node.name ?? node.raw ?? null;
    }

    public getAggregateOwnerSymbol(symbol: Types.SymbolInfo | null | undefined): Types.SymbolInfo | null {
        if (!symbol) return null;

        const ownerId = typeof symbol.aggregateOwnerSymbolId === "number"
            ? symbol.aggregateOwnerSymbolId
            : symbol.id;

        return this.getSymbolById(ownerId) ?? symbol;
    }

    public getAggregateSymbolFromExpression(node: any): Types.SymbolInfo | null {
        if (!node) return null;

        if (node.kind !== Kinds.Expressions.IdentifierExpression) {
            return null;
        }

        const name = this.getIdentifierName(node);
        const symbol = name ? this.resolveSymbol(name) : null;

        if (!symbol || !this.isAggregateType(symbol.type)) {
            return null;
        }

        return symbol;
    }

    public getAggregateOwnerFromExpression(node: any): Types.SymbolInfo | null {
        return this.getAggregateOwnerSymbol(this.getAggregateSymbolFromExpression(node));
    }

    public setAggregateOwner(symbol: Types.SymbolInfo, owner: Types.SymbolInfo | null): void {
        if (!this.isAggregateType(symbol.type)) {
            return;
        }

        const ownerSymbol = owner ? this.getAggregateOwnerSymbol(owner) : symbol;
        symbol.aggregateOwnerSymbolId = ownerSymbol?.id ?? symbol.id;
        symbol.moved = false;
        symbol.moveReason = undefined;
        symbol.movePosition = undefined;
        symbol.moveSource = undefined;
    }

    public transferAggregateOwner(target: Types.SymbolInfo, source: Types.SymbolInfo, reason: string, context: any): void {
        const sourceOwner = this.getAggregateOwnerSymbol(source);

        if (!sourceOwner || !this.isAggregateType(sourceOwner.type) || !this.isAggregateType(target.type)) {
            return;
        }

        target.aggregateOwnerSymbolId = target.id;
        target.moved = false;
        target.moveReason = undefined;
        target.movePosition = undefined;
        target.moveSource = undefined;

        for (const symbol of this.symbolsById.values()) {
            if (
                symbol.id === target.id ||
                !this.isAggregateType(symbol.type)
            ) {
                continue;
            }

            const owner = this.getAggregateOwnerSymbol(symbol);
            if (owner?.id === sourceOwner.id) {
                this.markAggregateSymbolMoved(symbol, reason, context);
            }
        }
    }

    public markAggregateExpressionMoved(value: any, reason: string, context: any): void {
        const symbol = this.getAggregateSymbolFromExpression(value);
        if (!symbol) return;

        const owner = this.getAggregateOwnerSymbol(symbol);
        if (!owner) return;

        for (const candidate of this.symbolsById.values()) {
            if (!this.isAggregateType(candidate.type)) continue;

            const candidateOwner = this.getAggregateOwnerSymbol(candidate);
            if (candidateOwner?.id === owner.id) {
                this.markAggregateSymbolMoved(candidate, reason, context);
            }
        }
    }

    public markAggregateSymbolMoved(symbol: Types.SymbolInfo, reason: string, context: any): void {
        symbol.moved = true;
        symbol.moveReason = reason;
        symbol.movePosition = context?.position;
        symbol.moveSource = context?.source ?? context?.raw ?? context?.fullSource;
    }

    public assertAggregateExpressionUsable(node: any, sourceText?: string): void {
        const symbol = this.getAggregateSymbolFromExpression(node);
        if (!symbol) return;

        const owner = this.getAggregateOwnerSymbol(symbol);
        const movedSymbol = symbol.moved ? symbol : owner?.moved ? owner : null;

        if (!movedSymbol) {
            return;
        }

        const name = this.getIdentifierName(node) ?? symbol.name;
        const moveReason = movedSymbol.moveReason ?? "ownership was moved";
        const message =
            `cannot use aggregate ${Helpers.RED}'${name}'${Helpers.RESET} after it was moved`;

        node.arrowLength = node.source?.length ?? name.length ?? 1;

        this.throwError(
            message,
            node.position,
            sourceText ?? node.fullSource ?? node.source ?? movedSymbol.moveSource ?? name,
            node,
            `  = moved because ${moveReason}`,
        );
    }

    public captureMoveState(): Map<number, any> {
        const snapshot = new Map<number, any>();

        for (const [id, symbol] of this.symbolsById.entries()) {
            snapshot.set(id, {
                aggregateOwnerSymbolId: symbol.aggregateOwnerSymbolId,
                moved: symbol.moved,
                moveReason: symbol.moveReason,
                movePosition: symbol.movePosition,
                moveSource: symbol.moveSource,
            });
        }

        return snapshot;
    }

    public restoreMoveState(snapshot: Map<number, any>): void {
        for (const [id, state] of snapshot.entries()) {
            const symbol = this.getSymbolById(id);
            if (!symbol) continue;

            symbol.aggregateOwnerSymbolId = state.aggregateOwnerSymbolId;
            symbol.moved = state.moved;
            symbol.moveReason = state.moveReason;
            symbol.movePosition = state.movePosition;
            symbol.moveSource = state.moveSource;
        }
    }

    public mergeMoveState(...snapshots: Array<Map<number, any> | null | undefined>): void {
        for (const snapshot of snapshots) {
            if (!snapshot) continue;

            for (const [id, state] of snapshot.entries()) {
                if (state?.moved !== true) continue;

                const symbol = this.getSymbolById(id);
                if (!symbol) continue;

                symbol.aggregateOwnerSymbolId = state.aggregateOwnerSymbolId;
                symbol.moved = true;
                symbol.moveReason = state.moveReason;
                symbol.movePosition = state.movePosition;
                symbol.moveSource = state.moveSource;
            }
        }
    }

    public literalIndexValue(index: any): number | string | null {
        if (!index) return null;

        if (index.kind === Kinds.Sir.NumberConstant) return index.value;
        if (index.kind === Kinds.Sir.StringConstant) return index.value;
        if (typeof index.value === "number" || typeof index.value === "string") return index.value;

        return null;
    }

    public areTypesComparable(leftType: any, rightType: any): boolean {
        if (!leftType || !rightType) return false;

        leftType = this.resolveType(leftType);
        rightType = this.resolveType(rightType);

        if (!leftType || !rightType) return false;

        if (
            leftType.kind === Kinds.Types.AnyType ||
            leftType.kind === Kinds.Types.UnknownType ||
            rightType.kind === Kinds.Types.AnyType ||
            rightType.kind === Kinds.Types.UnknownType
        ) {
            return false;
        }

        if (leftType.kind === Kinds.Types.UnionType) {
            return (leftType.types ?? []).some((type: any) => {
                return this.areTypesComparable(type, rightType);
            });
        }

        if (rightType.kind === Kinds.Types.UnionType) {
            return (rightType.types ?? []).some((type: any) => {
                return this.areTypesComparable(leftType, type);
            });
        }

        return leftType.kind === rightType.kind;
    }

    public visitNode(node: any): any {
        if (!node) return node;

        if (Array.isArray(node)) {
            return node.flatMap((child) => {
                const result = this.visitNode(child);
                if (result === null || result === undefined) return [];
                return Array.isArray(result) ? result : [result];
            });
        }

        switch (node.kind) {
            case Kinds.Expressions.BinaryExpression:
                return this.visitBinaryExpression({
                    ...node,
                    fullSource: node.fullSource ?? node.source,
                    value: node,
                });

            case Kinds.Expressions.CastExpression:
                return this.visitCastExpression(node);

            case Kinds.Expressions.SatisfiesExpression:
                return this.visitSatisfiesExpression(node);

            case Kinds.Expressions.NonNullExpression:
                return this.visitNonNullExpression(node);

            case Kinds.Expressions.ConditionalExpression:
                return this.visitConditionalExpression(node);

            case Kinds.Expressions.ParenthesizedExpression:
                return this.visitBinaryExpression({
                    ...node,
                    fullSource: node.fullSource ?? node.source,
                    value: node,
                });

            case Kinds.Expressions.ThisExpression:
                return this.visitIdentifierExpression({
                    ...node,
                    kind: Kinds.Expressions.IdentifierExpression,
                    name: "this",
                    value: "this",
                    raw: "this",
                    source: node.source ?? "this",
                });

            case Kinds.Expressions.CallExpression:
                return this.visitCallExpression(node);

            case Kinds.Expressions.UnaryExpression:
                return this.visitUnaryExpression(node);

            case Kinds.Expressions.PropertyAccessExpression:
                return this.visitPropertyAccessExpression(node);

            case Kinds.Expressions.ElementAccessExpression:
                return this.visitElementAccessExpression(node);

            case Kinds.Expressions.AddressOfExpression:
                return this.visitAddressOfExpression(node);

            case Kinds.Expressions.DereferenceExpression:
                return this.visitDereferenceExpression(node);

            case Kinds.Expressions.SpreadElement:
                return this.visitSpreadElement(node);

            case Kinds.Collections.ArrayExpression:
                return this.visitArrayExpression(node);

            case Kinds.Collections.DictionaryExpression:
                return this.visitDictionaryExpression(node);

            case Kinds.Statements.ReturnStatement:
                return this.visitReturnStatement(node);
        }

        const externs = this.visitExterns(node);
        if (externs !== null && externs !== undefined) return externs;

        const moduleStatement = this.visitModuleStatement(node);
        if (moduleStatement !== null && moduleStatement !== undefined) return moduleStatement;

        const structs = this.visitStructs(node);
        if (structs !== null && structs !== undefined) return structs;

        const types = this.visitAliasTypes(node);
        if (types !== null) return types;

        const constants = this.visitConstants(node);
        if (constants !== null && constants !== undefined) return constants;

        if (node.kind === Kinds.Expressions.IdentifierExpression) {
            return this.visitIdentifierExpression(node);
        }

        const controlFlow = this.visitControlFlow(node);
        if (controlFlow !== null && controlFlow !== undefined) return controlFlow;

        const declaration = this.visitDeclarationStatement(node);
        if (declaration !== null && declaration !== undefined) return declaration;

        return this.visitChildren(node);
    }

    public visitIdentifierExpression(node: any): any {
        const identifierName = node.value ?? node.name ?? node.raw;
        const symbol = this.resolveSymbol(identifierName);

        if (!symbol) {
            const message = `cannot find name ${Helpers.RED}'${identifierName}'${Helpers.RESET}`;
            node.arrowLength = identifierName?.length ?? 1;
            this.throwError(message, node.position, node.fullSource ?? node.source ?? node.raw, node);
        }

        const switchDeclClause = this.switchBodyDeclClause?.get(identifierName);
        const switchMayEnterAfterDeclaration =
            this.switchBodyKnownEntryClause === null ||
            (
                switchDeclClause !== undefined &&
                this.switchBodyKnownEntryClause > switchDeclClause
            );

        if (
            symbol.scopeId === this.switchBodyScopeId &&
            switchDeclClause !== undefined &&
            switchDeclClause < this.switchBodyCurrentClause &&
            switchMayEnterAfterDeclaration
        ) {
            const message =
                `variable ${Helpers.RED}'${identifierName}'${Helpers.RESET} may be used before initialization`;
            node.arrowLength = identifierName?.length ?? 1;
            this.throwError(
                message,
                node.position,
                node.fullSource ?? node.source ?? node.raw,
                node,
            );
        }

        this.assertAggregateExpressionUsable(
            {
                ...node,
                symbolId: symbol.id,
                scopeId: symbol.scopeId,
                type: symbol.type,
            },
            node.fullSource ?? node.source ?? node.raw,
        );

        return {
            ...node,
            symbolId: symbol.id,
            scopeId: symbol.scopeId,
            type: symbol.type,
            linkageName: symbol.linkageName ?? null,
            qualifiedName: symbol.qualifiedName,
            pointerRootName: symbol.pointerRootName ?? null,
            pointerRootSymbolId: symbol.pointerRootSymbolId,
            pointerAccessPath: symbol.pointerAccessPath ?? [],
            pointerPermission: symbol.pointerPermission,
            borrowedView: symbol.borrowedView === true || symbol.node?.borrowedView === true,
            borrowedViewReadonly: symbol.borrowedViewReadonly === true || symbol.node?.borrowedViewReadonly === true,
            borrowedViewSourceName:
                symbol.borrowedViewSourceName ??
                symbol.node?.borrowedViewSourceName ??
                (symbol.node?.object ? (this as any).getAggregateRootIdentifier(symbol.node.object) : null),
        };
    }


    public visitDeclarationStatement(node: any) {
        if (node.kind === Kinds.Statements.DeclarationStatement) {
            return node.declarations.map((declaration: any) => {
                if (declaration.kind === Kinds.Functions.FunctionDeclaration) {
                    return this.visitFunctionLikeDeclarations({
                        ...declaration,
                        flag: {
                            name: node.flag,
                            position: node.position,
                        },
                        export: node.export,
                        fullSource: node.source,
                        source: declaration.source,
                    })
                }

                if (declaration.kind === Kinds.Statements.VariableDeclaration) {
                    return this.visitVariableLikeDeclarations({
                        ...declaration,
                        flag: {
                            name: node.flag,
                            position: node.position,
                        },
                        export: node.export,
                        fullSource: node.source,
                        source: declaration.source,
                    })
                }

                if (declaration.kind === Kinds.Statements.ArrayDeclaration) {
                    return this.visitArrayLikeDeclarations({
                        ...declaration,
                        flag: {
                            name: node.flag,
                            position: node.position,
                        },
                        export: node.export,
                        fullSource: node.source,
                        source: declaration.source,
                    });
                }

                return this.visitNode(declaration);
            });
        }

        if (node.kind === Kinds.Functions.FunctionDeclaration) {
            return this.visitFunctionLikeDeclarations({
                ...node,
                flag: {
                    name: node.flag,
                    position: node.position,
                },
                export: node.export,
                fullSource: node.source,
                source: node.source,
            })
        }



        return null;
    }

    visitAliasTypes(_: any): any { }

    visitConstants(_: any): any { }
    visitChildren(_: any): any { }

    visitFunctionLikeDeclarations(_: any): any { }
    visitVariableLikeDeclarations(_: any): any { }
    visitArrayLikeDeclarations(_: any): any { }
    visitArrayExpression(_: any): any { }
    visitSpreadElement(_: any): any { }
    visitAddressOfExpression(_: any): any { }
    visitDereferenceExpression(_: any): any { }
    visitDictionaryExpression(_: any): any { }
    visitReturnStatement(_: any): any { }
    visitExterns(_: any): any { }
    visitModuleStatement(_: any): any { }
    visitControlFlow(_: any): any { }

    visitBinaryExpression(_: any): any { }
    visitCastExpression(_: any): any { }
    visitSatisfiesExpression(_: any): any { }
    visitNonNullExpression(_: any): any { }
    visitConditionalExpression(_: any): any { }
    visitCallExpression(_: any): any { }
    visitUnaryExpression(_: any): any { }
    visitPropertyAccessExpression(_: any): any { }
    visitElementAccessExpression(_: any): any { }
    // Logger
    throwError(kind: string, position: any, sourceText: string, context?: any, endMessage?: string): any { }

    visitStructs(_: any): any { }

    getNameText(name: any): string {
        if (!name) return "";
        if (typeof name === "string") return name;
        if (typeof name.name === "string") return name.name;
        if (typeof name.value === "string") return name.value;
        if (typeof name.raw === "string") return name.raw;
        return String(name);
    }

    getTypeUsageNameText(typeUsage: any): string {
        if (!typeUsage) return "";
        if (typeUsage.kind === Kinds.Types.TypeReference) return this.getTypeReferenceName(typeUsage);
        if (typeUsage.name?.kind === Kinds.Types.TypeReference) return this.getTypeReferenceName(typeUsage.name);
        if (typeUsage.name) return this.getQualifiedNameText(typeUsage.name);
        if (typeUsage.expression?.kind === Kinds.Types.TypeReference) return this.getTypeReferenceName(typeUsage.expression);
        if (typeUsage.expression) return this.getQualifiedNameText(typeUsage.expression);
        return this.getNameText(typeUsage);
    }

    getQualifiedNameText(name: any): string {
        if (!name) return "";
        if (typeof name === "string") return name;
        if (name.kind === Kinds.Types.TypeReference) return this.getTypeReferenceName(name);
        if (Array.isArray(name.parts)) return name.parts.map((part: any) => this.getNameText(part)).join(".");
        return this.getNameText(name);
    }
}
