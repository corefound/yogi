
import ts from "typescript";
import { Kinds, Types } from "../helpers/types";

import { Scope } from "./scope";
export type Constructor<T = {}> = new (...args: any[]) => T;
export type Mixin<T extends Constructor> = <TBase extends Constructor>(Base: TBase) => T & TBase;
export type MixinFunction = (base: any) => any;

export function applySemanticMixins<TBase extends Constructor>(Base: TBase, ...mixins: MixinFunction[]): TBase | any {
    return mixins.reduce((current, mixin) => mixin(current), Base);
}

export class BaseSemantic {
    public modulePath = "";
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

    public visitNode(node: any): any {
        if (!node) return node;

        if (Array.isArray(node)) {
            return node.flatMap(child => {
                const result = this.visitNode(child);
                return Array.isArray(result) ? result : [result];
            });
        }

        const constants = this.visitConstants(node);
        if (constants) return constants;

        const declarations = this.visitDeclarationStatement(node);
        if (declarations) return declarations;

        return this.visitChildren(node);
    }

    visitConstants(_: any): any { }
    visitChildren(_: any): any { }

    visitDeclarationStatement(_: any): any { }
    visitVariableLikeDeclarations(_: any, __: Types.DeclarationContext): any { }
    visitVariableDeclarations(_: any, __: Types.DeclarationContext): any { }

    // Logger
    typeError(kind: Kinds.ErrrorsMessage, position: any, sourceText: string): any { }
}