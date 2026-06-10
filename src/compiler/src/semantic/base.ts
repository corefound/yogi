
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
        return `_yogi_${modulePath.replace(/[\\/]/g, "_").replace(/\./g, "_")}__${symbolName}`;
    }

    public getQualifiedName(modulePath: string, symbolName: string): string {
        return `${modulePath.replace(/[\\/]/g, ":")}:${symbolName}`;
    }

    public visitNode(node: any): any {
        if (!node) return node;

        if (Array.isArray(node)) {
            return node.flatMap(child => {
                const result = this.visitNode(child);
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

            default:
                break;
        }

        if (node.kind == Kinds.Expressions.IdentifierExpression) return this.visitIdentifierExpression(node)


        const constants = this.visitConstants(node);
        if (constants) return constants;

        const declaration = this.visitDeclarationStatement(node);
        if (declaration) return declaration;

        return this.visitChildren(node);
    }

    public visitIdentifierExpression(node: any): any {
        const symbol = this.resolveSymbol(node.value);

        if (!symbol) {
            const message = `cannot find name ${Helpers.RED}'${node.value}'${Helpers.RESET}`;
            node.arrowLength = node.value.length;
            this.throwError(message, node.position, node.fullSource, node);
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


    visitConstants(_: any): any { }
    visitChildren(_: any): any { }

    visitFunctionLikeDeclarations(_: any): any { }
    visitVariableLikeDeclarations(_: any): any { }
    visitBinaryExpression(_: any): any { }

    // Logger
    throwError(kind: string, position: any, sourceText: string, context?: any, endMessage?: string): any { }
}