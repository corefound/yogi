
import { Kinds, Types } from "../helpers/types";
import { Helpers } from "../helpers";

import { Scope } from "./scope";
export type Constructor<T = {}> = new (...args: any[]) => T;
export type Mixin<T extends Constructor> = <TBase extends Constructor>(Base: TBase) => T & TBase;
export type MixinFunction = (base: any) => any;

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

    public globalScope: Scope;
    public currentScope: Scope;

    public ast: Types.Ast[];
    public diagnostics: Types.Diagnostics[] = [];
    public modules: Map<string, Types.SemanticModuleInfo> = new Map();
    public exportedSymbols: Map<string, Types.SemanticModuleSymbol> = new Map();
    public externalLinks: Map<string, Types.Sir.GlobalMetaLinkInput> = new Map();
    public functionEffectSummaries: Map<number, Types.Sir.SemanticFunctionEffectSummary> = new Map();
    public symbolsById: Map<number, Types.SymbolInfo> = new Map();

    constructor(ast: Types.Ast[]) {
        this.ast = ast;

        this.globalScope = new Scope(0, null);
        this.currentScope = this.globalScope;
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
                symbol.kind !== Kinds.ScopeSymbols.Interface
            )
        ) {
            return type;
        }

        seen.add(name);

        return this.resolveType(symbol.type ?? symbol.node?.type, seen);
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
                        symbol.kind === Kinds.ScopeSymbols.Interface
                    )
                ) {
                    const nextSeen = new Set(seen);
                    nextSeen.add(name);
                    serialized.resolved = this.toSerializableType(
                        symbol.type ?? symbol.node?.type,
                        nextSeen,
                    );
                }
            }

            return serialized;
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
                return this.isTypeAssignable(expectedType.elementType, actualType.elementType);
            }

            if (actualType.kind === Kinds.Types.TupleType) {
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
        return (
            resolved?.kind === Kinds.Types.TypeLiteral ||
            resolved?.kind === Kinds.Types.InterfaceDeclaration
        );
    }

    public objectMembers(type: any): any[] {
        const resolved = this.resolveType(type);
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
            .filter((member: any) => member.kind === Kinds.Types.PropertySignature);
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
            .filter((member: any) => member.kind === Kinds.Types.PropertySignature);
        const actualMembers = new Map<string, any>();

        for (const member of this.objectMembers(actualType)) {
            if (member.kind !== Kinds.Types.PropertySignature) continue;
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

        for (const element of value.elements) {
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

            case Kinds.Expressions.CallExpression:
                return this.visitCallExpression(node);

            case Kinds.Expressions.UnaryExpression:
                return this.visitUnaryExpression(node);

            case Kinds.Expressions.PropertyAccessExpression:
                return this.visitPropertyAccessExpression(node);

            case Kinds.Expressions.ElementAccessExpression:
                return this.visitElementAccessExpression(node);

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
}
