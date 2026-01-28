import ts from "typescript";
import { VariableVisitor } from "@/visitor/variables";
import { ExpressionVisitor } from "@/visitor/expressions";
import { BaseVisitor, applyMixins } from "@/visitor/base";


export class Visitor extends applyMixins(BaseVisitor, ExpressionVisitor, VariableVisitor,) {
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
        });

        return {
            name: this.filePath,
            main: body,
            modules: []
        };
    }
}