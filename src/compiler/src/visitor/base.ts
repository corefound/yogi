import fs from "fs"
import ts from "../ts";
import { Loggers } from "../loggers";
import { Kinds } from "../helpers/types";
import { ZodSchemas } from "../schemas";
import { z } from "zod";

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
    public diagnostics: z.infer<typeof ZodSchemas.DiagnosticsSchema>[] = [];

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

    public checkDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
        if (!diagnostics.length) return;

        diagnostics.forEach(d => {
            const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
            const position = d.file?.getLineAndCharacterOfPosition(d.start!)!;
            Loggers.error(message, position, d.file!.text, this.filePath);

            const diagnostics = ZodSchemas.DiagnosticsSchema.safeParse({
                kind: d.code,
                category: d.category,
                message,
                position,
                source: d.source,
                fileName: this.filePath
            })

            if (diagnostics.success) {
                this.diagnostics.push(diagnostics.data);
            } else {
                process.stderr.write(JSON.stringify(diagnostics.error));
            }
        });
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
                        kind: Kinds.Unknown,
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
        if (ts.isIfStatement(node)) return this.visitIfStatement(node);
        if (ts.isBlock(node)) return node.statements.map((s: ts.Statement) => this.visitNode(s));
        if (ts.isReturnStatement(node)) {
            return {
                kind: "ReturnStatement",
                value: node.expression ? this.visitNode(node.expression) : null
            };
        }

        // functions
        const functions = this.visitFunctions(node);
        if (functions) return functions;

        // expressions
        const expressions = this.visitExpressions(node);
        if (expressions) return expressions;


        // literals
        const literal = this.visitLiterals(node);
        if (literal) return literal;

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

    // placeholders (implemented in mixins)
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
}
