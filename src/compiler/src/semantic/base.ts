
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

    public globalScope: Scope;
    public currentScope: Scope;

    public ast: Types.Ast[];
    public diagnostics: Types.Diagnostics[] = [];

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

        return fullSymbol;
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

        if (expectedType.kind === Kinds.Types.LiteralType) {
            return expectedType.raw === actualType.raw;
        }

        return expectedType.kind === actualType.kind;
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
        }

        const externs = this.visitExterns(node);
        if (externs !== null && externs !== undefined) return externs;

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

        return {
            ...node,
            symbolId: symbol.id,
            scopeId: symbol.scopeId,
            type: symbol.type,
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
    visitExterns(_: any): any { }
    visitControlFlow(_: any): any { }

    visitBinaryExpression(_: any): any { }

    // Logger
    throwError(kind: string, position: any, sourceText: string, context?: any, endMessage?: string): any { }
}
