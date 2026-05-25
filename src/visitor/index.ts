import ts from "typescript";
import { VariableVisitor } from "@/visitor/variables";
import { ExpressionVisitor } from "@/visitor/expressions";
import { BaseVisitor, applyMixins } from "@/visitor/base";
import { ImportsVisitor } from "./imports";
import { ExportsVisitor } from "./exports";
import { DictionaryVisitor } from "./object";


export class Visitor extends applyMixins(BaseVisitor, ExpressionVisitor, VariableVisitor, ImportsVisitor, ExportsVisitor) {
    constructor(filePath: string, options?: ts.CompilerOptions) {
        super(filePath, options || {});
    }
    public visit() {
        const body: any[] = [];
        this.sourceFile.statements?.forEach((stmt: ts.Statement) => {

            if (ts.isFunctionDeclaration(stmt)) {
                body.push(this.visitFunctionDeclaration(stmt));
            }

            if (ts.isVariableStatement(stmt)) {
                body.push(this.visitVariableDeclaration(stmt));
            }

            if (ts.isExpressionStatement(stmt)) {
                body.push(this.visitExpression(stmt));
            }

            if (ts.isImportDeclaration(stmt)) {
                body.push(this.visitAllImports(stmt));
            }

            if (ts.isExportDeclaration(stmt)) {
                body.push(this.visitExportDeclaration(stmt));
            }



            const visitExports = this.visitExports(stmt);
            if (visitExports) {
                body.push(visitExports);
            }
        });

        return {
            module: this.filePath,
            body,
        };
    }
}