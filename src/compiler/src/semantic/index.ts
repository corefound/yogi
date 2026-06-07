import { Types } from "../helpers/types";

export class Semantic {
    private ast: Types.Ast[];
    private diagnostics: Types.Diagnostics[] = [];

    constructor(ast: Types.Ast[]) {
        this.ast = ast;
    }

    public analyze() {
        return this.ast.map((ast: Types.Ast) => {
            ast.body.map((statement: any) => {
                
            })
            return {
                ...ast,
                module: this.visitNode(ast.module),
            };
        });
    }

    private visitNode(node: any): any {
        if (!node) return node;

        if (Array.isArray(node)) {
            return node.map(child => this.visitNode(child));
        }

        switch (node.kind) {
            case "NumberLiteral":
                return this.visitNumberLiteral(node);

            case "StringLiteral":
                return this.visitStringLiteral(node);

            case "BooleanLiteral":
                return this.visitBooleanLiteral(node);

            case "NullLiteral":
                return this.visitNullLiteral(node);

            default:
                return this.visitChildren(node);
        }
    }

    private visitChildren(node: any): any {
        if (typeof node !== "object") return node;

        const result: any = { ...node };

        for (const key of Object.keys(result)) {
            result[key] = this.visitNode(result[key]);
        }

        return result;
    }

    private visitNumberLiteral(node: any) {
        return {
            kind: "NumberConstant",
            type: {
                kind: "NumberType",
                raw: "number",
            },
            value: node.value,
            source: node.source,
            position: node.position,
        };
    }

    private visitStringLiteral(node: any) {
        return {
            kind: "StringConstant",
            type: {
                kind: "StringType",
                raw: "string",
            },
            value: node.value,
            source: node.source,
            position: node.position,
        };
    }

    private visitBooleanLiteral(node: any) {
        return {
            kind: "BooleanConstant",
            type: {
                kind: "BooleanType",
                raw: "boolean",
            },
            value: Boolean(node.value),
            source: node.source,
            position: node.position,
        };
    }

    private visitNullLiteral(node: any): any {
        return {
            kind: "NullConstant",
            type: {
                kind: "NullType",
                raw: "null",
            },
            value: null,
            source: node.source,
            position: node.position,
        };
    }
}