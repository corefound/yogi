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
            true
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
        if (ts.isFunctionDeclaration(node)) return this.visitFunctionDeclaration(node);
        if (ts.isIfStatement(node)) return this.visitIfStatement(node);
        if (ts.isBlock(node)) return node.statements.map((s: ts.Statement) => this.visitNode(s));
        if (ts.isReturnStatement(node)) {
            return {
                kind: "ReturnStatement",
                value: node.expression ? this.visitNode(node.expression) : null
            };
        }

        // expressions
        if (ts.isArrowFunction(node)) return this.visitArrowFunction(node);
        if (ts.isBinaryExpression(node)) return this.visitBinaryExpression(node);
        if (ts.isPrefixUnaryExpression(node)) return this.visitUnaryExpression(node);

        const literal = this.visitLiteral(node);
        if (literal) return literal;

        if (ts.isIdentifier(node)) {
            return {
                kind: Kinds.Identifier,
                name: node.text,
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.TrueKeyword) {
            return {
                kind: Kinds.BooleanLiteral,
                value: node.kind === ts.SyntaxKind.TrueKeyword ? 1 : 0,
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        return null;
    }

    // 
    visitMethodSignature(_: ts.MethodSignature): any { }
    visitPropertySignature(_: ts.PropertySignature): any { }

    // Imports and Exports
    visitImports(_: ts.ImportDeclaration): any { }
    visitExports(_: ts.ExportDeclaration): any { }

    // placeholders (implemented in mixins)
    visitExternDeclaration(_: ts.ExternDeclaration): any { }
    visitVariableDeclaration(_: ts.VariableStatement): any { }
    visitExpression(_: ts.ExpressionStatement): any { }
    visitFunctionDeclaration(_: ts.FunctionDeclaration): any { }
    visitIfStatement(_: ts.IfStatement): any { }
    visitArrowFunction(_: ts.ArrowFunction): any { }
    visitBinaryExpression(_: ts.BinaryExpression): any { }
    visitUnaryExpression(_: ts.PrefixUnaryExpression): any { }
    visitLiteral(_: ts.Node): any { }
    visitIdentifier(_: ts.Identifier): any { }
}