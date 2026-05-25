import ts from "typescript";
import { Loggers } from "@/loggers";
import { Kinds, Nodes } from "@/helpers/types";

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
    public currentFile: string;
    public currentModuleImports: any[] = [];

    constructor(filePath: string, options: ts.CompilerOptions) {
        this.filePath = filePath;
        // this.currentFile = filePath;
        this.program = ts.createProgram([filePath], options);

        const diagnostics = ts.getPreEmitDiagnostics(this.program);
        this.checkDiagnostics(diagnostics);

        this.sourceFile = this.program.getSourceFile(filePath)!;
    }

    public checkDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
        if (!diagnostics.length) return;

        diagnostics.forEach(d => {
            const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
            const position = d.file?.getLineAndCharacterOfPosition(d.start!)!;
            Loggers.error(message, position, d.file!.text, this.filePath);
        });
    }

    visitNode(node: ts.Node): any {
        // Template literals
        if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
            return this.visitTemplate(node);
        }

        // Expressions
        if (ts.isBinaryExpression(node)) {
            return this.visitBinaryExpression(node);
        }

        if (ts.isPrefixUnaryExpression(node)) {
            return this.visitUnaryExpression(node);
        }

        // Literals
        const literal = this.visitLiteral(node);
        if (literal) return literal;

        // Identifiers
        if (ts.isIdentifier(node)) {
            return this.visitIdentifier(node);
        }
    }

    // ----------------------------
    // Template literals
    // ----------------------------
    visitTemplate(node: ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression) {
        if (ts.isNoSubstitutionTemplateLiteral(node)) {
            return { kind: "StringLiteral", value: node.text };
        }

        const parts: any[] = [];

        if (node.head.text.length > 0) {
            parts.push({ kind: "StringLiteral", value: node.head.text });
        }

        for (const span of node.templateSpans) {
            parts.push(this.visitNode(span.expression));
            if (span.literal.text.length > 0) {
                parts.push({ kind: "StringLiteral", value: span.literal.text });
            }
        }

        return { kind: "InterpolationExpression", value: parts };
    }

    // ----------------------------
    // Expressions
    // ----------------------------
    visitBinaryExpression(node: ts.BinaryExpression) {
        return {
            kind: "BinaryExpression",
            operator: node.operatorToken.getText(),
            left: this.visitNode(node.left),
            right: this.visitNode(node.right),
        };
    }

    visitUnaryExpression(node: ts.PrefixUnaryExpression) {
        const argument = this.visitNode(node.operand);

        // 🔥 Constant folding: -<number or infinity>
        if (node.operator === ts.SyntaxKind.MinusToken) {
            if (argument.kind === "InfinityLiteral") {
                return { kind: argument.kind, value: "-Infinity" };
            }

            if (argument.type === "IntegerLiteral" && argument.raw === "0") {
                return argument; // redondear -0 a 0
            }

            if (argument.type === "IntegerLiteral" || argument.type === "FloatLiteral") {
                return { kind: argument.type, value: "-" + argument.raw };
            }
        }

        // +<number> → solo devolver literal
        if (node.operator === ts.SyntaxKind.PlusToken) {
            if (argument.type === "IntegerLiteral" || argument.type === "FloatLiteral") {
                return argument;
            }
        }

        return { kind: "UnaryExpression", operator: node.operator, argument };
    }

    // ----------------------------
    // Literals
    // ----------------------------
    visitLiteral(node: ts.Node) {
        if (ts.isNumericLiteral(node) || ts.isBigIntLiteral(node)) {
            const text = node.text.endsWith("n") ? node.text.slice(0, -1) : node.text;
            const numValue = Number(text);

            // Cero → Nodes.NumberLiteral("0")
            if (numValue === 0) {
                return { kind: Nodes.NumberLiteral, value: "0" };
            }

            // Entero exacto → IntegerLiteral
            if (Number.isInteger(numValue)) {
                return { kind: Nodes.NumberLiteral, value: BigInt(text).toString() };
            }

            // Float → FloatLiteral
            return { kind: Nodes.NumberLiteral, value: text };
        }

        if (ts.isStringLiteral(node)) {
            return { kind: Nodes.StringLiteral, value: node.text };
        }

        if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
            return { kind: Nodes.BooleanLiteral, value: node.kind === ts.SyntaxKind.TrueKeyword ? 1 : 0 };
        }

        if (node.kind === ts.SyntaxKind.NullKeyword) {
            return { kind: Nodes.NullLiteral, value: "null" };
        }
    }

    // ----------------------------
    // Identifiers
    // ----------------------------
    visitIdentifier(node: ts.Identifier) {
        let kind = Kinds.Identifier;
        switch (node.text) {
            case "undefined":
                kind = Kinds.Identifier;
                break;
            case "NaN":
                kind = Kinds.Identifier;
                break;
            case "Infinity":
            case "-Infinity":
                kind = Kinds.Identifier;
                break;
        }

        return { kind, value: node.text };
    }
}