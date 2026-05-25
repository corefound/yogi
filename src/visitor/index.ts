import ts from "typescript";
import { VariableVisitor } from "@/visitor/variables";
import { ExpressionVisitor } from "@/visitor/expressions";
import { BaseVisitor, applyMixins } from "@/visitor/base";
import { ImportsVisitor } from "./imports";
import { ExportsVisitor } from "./exports";
import { LiteralsVisitor } from "./literals";

export class Visitor extends applyMixins(
    BaseVisitor,
    ExpressionVisitor,
    VariableVisitor,
    ImportsVisitor,
    ExportsVisitor,
    LiteralsVisitor
) {
    constructor(filePath: string, options?: ts.CompilerOptions) {
        super(filePath, options || {});
    }

    public visit() {
        return {
            module: this.filePath,
            body: this.sourceFile.statements.map((s: ts.Statement) => this.visitNode(s))
        };
    }
}