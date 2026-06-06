import ts from "../ts";
import { VariableVisitor } from "../visitor/variables";
import { ExpressionVisitor } from "../visitor/expressions";
import { BaseVisitor, applyMixins } from "../visitor/base";
import { ImportsVisitor } from "./imports";
import { ExportsVisitor } from "./exports";
import { LiteralsVisitor } from "./literals";
import { ExternsVisitor } from "./extern";
import { TypesVisitor } from "./types";
import { ArrayVisitor } from "./arrays";
import { DictionaryVisitor } from "./dictionary";
import { FunctionVisitor } from "./functions";
import { ConditionalVisitor } from "./conditional";
import { LoopVisitor } from "./loops";

export class Visitor extends applyMixins(
    BaseVisitor,
    ExpressionVisitor,
    VariableVisitor,
    ImportsVisitor,
    ExportsVisitor,
    LiteralsVisitor,
    ExternsVisitor,
    TypesVisitor,
    ArrayVisitor,
    DictionaryVisitor,
    FunctionVisitor,
    ConditionalVisitor,
    LoopVisitor
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