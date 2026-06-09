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
import path from "node:path";

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
    constructor(filePath: string, rootDir: string, options?: ts.CompilerOptions) {
        super(filePath, options || {});
        this.rootDir = rootDir
    }

    public visit() {
        return {
            module: {
                absolutePath: this.filePath,
                relativePath: path.relative(this.rootDir, this.filePath)
            },
            body: this.sourceFile.statements.map((s: ts.Statement) => this.visitNode(s)),
            exports: this.exports,
        };
    }
}

export class Visitor {
    public readonly options: ts.CompilerOptions
    public readonly graph: Map<string, string[]>
    public ast: Types.Ast[]
    public rootDir: string

    constructor(rootDir: string, graph: Map<string, string[]>, options: ts.CompilerOptions) {
        this.options = options
        this.graph = graph
        this.rootDir = rootDir
    }

    public visit() {
        const modules: Types.Ast[] = []
        this.graph.forEach((_: string[], modulePath: string) => {
            const visitor = new MixinsVisitor(modulePath, this.rootDir, this.options);
            const ast = visitor.visit();

            modules.push(ast);
        })

        this.ast = modules
        return modules
    }
}