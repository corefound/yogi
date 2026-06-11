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
import { Types } from "../helpers/types";
import { Helpers } from "../helpers";

class MixinsVisitor extends applyMixins(
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
    public rootDir: string
    constructor(filePath: string) {
        const tsConfig = {
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.NodeNext,
            strictNullChecks: false,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            strict: false,
            allowJs: false,
        };

        super(filePath, tsConfig);
    }

    public visit() {
        const ast = this.sourceFile.statements.map((s: ts.Statement) => this.visitNode(s)).flat(Infinity)
        return {
            ast,
            astHash: Helpers.hash(JSON.stringify(ast)),
            sourceHash: Helpers.hash(JSON.stringify(this.sourceFile.getText()))
        };
    }
}

export class Visitor {
    constructor() {

    }


    public parse(filePath: string) {
        const visitor = new MixinsVisitor(filePath);
        const ast = visitor.visit();
        return ast;
    }

}