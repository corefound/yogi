import fs from "fs"
import ts from "../ts";
import { Kinds } from "../helpers/types";
import { Nodes } from "@/nodes";

export type Constructor<T = {}> = new (...args: any[]) => T;
export type Mixin<T extends Constructor> = <TBase extends Constructor>(Base: TBase) => T & TBase;
export type MixinFunction = (base: any) => any;

export function applyMixins<TBase extends Constructor>(Base: TBase, ...mixins: MixinFunction[]): TBase | any {
    return mixins.reduce((current, mixin) => mixin(current), Base);
}

export class BaseVisitor {
    public filePath: string;
    public program: ts.Program;
    public sourceFile: ts.SourceFile;
    public diagnostics: Nodes.Diagnostics[] = [];
    public exports: Map<string, any> = new Map<string, any>();

    constructor(filePath: string) {
        this.filePath = filePath;
        const code = fs.readFileSync(filePath, "utf8");

        this.sourceFile = ts.createSourceFile(
            filePath,
            code,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        );
    }

    // =========================
    // ONLY DISPATCHER
    // =========================
    visitNode(node: ts.Node): any {
        if (!node) return null;

        // -----------------------------------
        // ARRAY LITERAL
        // -----------------------------------
        if (ts.isArrayLiteralExpression(node)) {
            return this.visitArrayLiteral(node);
        }

        if (ts.isTypeElement(node)) {
            switch (node.kind) {
                case ts.SyntaxKind.PropertySignature:
                    return this.visitPropertySignature(node as ts.PropertySignature);

                case ts.SyntaxKind.MethodSignature:
                    return this.visitMethodSignature(node as ts.MethodSignature);

                default:
                    return {
                        kind: Kinds.Miscellaneous.Unknown,
                        text: node.getText(),
                        type: ts.SyntaxKind[node.kind],
                    };
            }
        }

        // extern
        if (ts.isExternDeclaration(node)) {
            return this.visitExternDeclaration(node)
        };

        // imports
        if (ts.isExportDeclaration(node)) return this.visitExports(node);
        if (ts.isImportDeclaration(node)) return this.visitImports(node);


        // statements
        if (ts.isVariableStatement(node)) return this.visitVariableDeclaration(node);
        if (ts.isExpressionStatement(node)) return this.visitExpression(node);
        if (ts.isBlock(node)) return node.statements.map((s: ts.Statement) => this.visitNode(s));
        if (ts.isReturnStatement(node)) {
            return {
                kind: Kinds.Statements.ReturnStatement,
                value: node.expression ? this.visitNode(node.expression) : null
            };
        }

        // loops
        const loops = this.visitLoops(node);
        if (loops) return loops;

        // functions
        const functions = this.visitFunctions(node);
        if (functions) return functions;

        // expressions
        const expressions = this.visitExpressions(node);
        if (expressions) return expressions;


        // literals
        const literal = this.visitLiterals(node);
        if (literal) return literal;

        // types
        const conditionals = this.visitConditionals(node);
        if (conditionals) return conditionals;

        throw new Error(`Unsupported node type: ${ts.SyntaxKind[node.kind]}`);
    }

    visitExpressions(_: ts.Node): any { }
    visitFunctions(_: ts.Node): any { }

    // Functions
    transformFunctionDeclaration(_: ts.Node): any { }
    visitFunctionDeclaration(_: ts.Node): any { }
    visitDictionaryDeclaration(_: ts.Node): any { }
    visitReturnStatement(_: ts.Node): any { }

    // Type Aliases
    visitTypeAliasDeclaration(_: ts.Node): any { }
    visitArrayDeclaration(_: ts.Node): any { }
    visitArrayLiteral(_: ts.Node): any { }
    visitType(_?: ts.Node): any { }

    // Type Elements
    visitMethodSignature(_: ts.Node): any { }
    visitPropertySignature(_: ts.Node): any { }

    // Imports and Exports
    visitImports(_: ts.Node): any { }
    visitExports(_: ts.Node): any { }

    visitCallExpression(_: ts.Node): any { }
    visitExternDeclaration(_: ts.Node): any { }
    visitVariableDeclaration(_: ts.Node): any { }
    visitExpression(_: ts.Node): any { }
    visitIfStatement(_: ts.Node): any { }
    visitArrowFunction(_: ts.Node): any { }
    visitBinaryExpression(_: ts.Node): any { }
    visitUnaryExpression(_: ts.Node): any { }
    visitIdentifier(_: ts.Node): any { }

    visitLiterals(_: ts.Node): any { }
    visitConditionals(_: ts.Node): any { }
    transformDeclaration(_: ts.Node): any { }
    visitLoops(_: ts.Node): any { }

    getNodePosistion(node: ts.Node) {
        const position = node.getSourceFile().getLineAndCharacterOfPosition(node.pos);

        return {
            line: position.line,
            character: position.character
        }
    }
}
