import { Types } from "../helpers/types";

export class Scope {
    symbols = new Map<string, Types.SymbolInfo>();

    constructor(public id: number, public parent: Scope | null) {

    }

    define(symbol: Types.SymbolInfo) {
        if (this.symbols.has(symbol.name)) {
            throw new Error(`Symbol '${symbol.name}' already declared`);
        }

        this.symbols.set(symbol.name, symbol);
    }

    resolve(name: string): Types.SymbolInfo | null {
        return this.symbols.get(name) ?? this.parent?.resolve(name) ?? null;
    }
}