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

export class Visitor {
    public readonly options: ts.CompilerOptions
    public readonly graph: Map<string, string[]>
    public ast: Types.Ast[]

    constructor(graph: Map<string, string[]>, options: ts.CompilerOptions) {
        this.options = options
        this.graph = graph
    }

    public visit() {
        const modules: Types.Ast[] = []
        this.graph.forEach((_: string[], modulePath: string) => {
            const visitor = new MixinsVisitor(modulePath, this.options);
            const ast = visitor.visit();
            
            modules.push(ast);
        })

        this.ast = modules
        return modules
    }
}