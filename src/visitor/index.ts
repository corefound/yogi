import ts from "typescript";
import { VariableVisitor } from "@/visitor/variables";
import { ExpressionVisitor } from "@/visitor/expressions";
import { BaseVisitor, applyMixins } from "@/visitor/base";
import { ScannerVisitor } from "./scanner";


export class Visitor extends applyMixins(BaseVisitor, ExpressionVisitor, VariableVisitor, ScannerVisitor) {
    constructor(filePath: string, options?: ts.CompilerOptions) {
        super(filePath, options || {});
    }
    public visit() {
        const body: any[] = [];
        this.sourceFile.statements.forEach((stmt: ts.Statement) => {
            if (ts.isVariableStatement(stmt)) {
                body.push(this.visitVariableDeclaration(stmt));
            }

            if (ts.isExpressionStatement(stmt)) {
                body.push(this.visitExpression(stmt));
            }

            if (ts.isImportDeclaration(stmt)) {
                body.push(this.visitAllImports(stmt));
            }
        });

        return {
            module: this.filePath,
            body,            
        };
    }
}