import { Types } from "../helpers/types";
import { BaseSemantic, applySemanticMixins } from "./base";
import { ConstantsSemantic } from "./constants";
import { VariablesSemantic } from "./variables";
import { LoggerSemantic } from "./loggers";
import { FunctionsSemantic } from "./functions";


export class Semantic extends applySemanticMixins(
    BaseSemantic,
    LoggerSemantic,
    ConstantsSemantic,
    VariablesSemantic,
    FunctionsSemantic
) {
    public sir: Types.Sir[] = [];

    constructor(ast: Types.Ast[]) {
        super(ast);
    }

    public analyze() {
        return this.ast.map((ast: Types.Ast) => {
            this.modulePath = ast.module;
            return {
                module: ast.module,
                sir: ast.body.map((statement: any) => this.visitNode(statement)).flat(Infinity)
            }
        }).flat(100);
    }

    public visitChildren(node: any): any {
        if (typeof node !== "object") return node;

        const result: any = { ...node };
        for (const key of Object.keys(result)) {
            result[key] = this.visitNode(result[key]);
        }

        return result;
    }

}
