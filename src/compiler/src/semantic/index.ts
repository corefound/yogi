import fs from "node:fs";
import { Types } from "../helpers/types";
import { BaseSemantic, applySemanticMixins } from "./base";
import { ConstantsSemantic } from "./constants";
import { VariablesSemantic } from "./variables";
import { LoggerSemantic } from "./loggers";
import { FunctionsSemantic } from "./functions";
import { ExpressionsSemantic } from "./expressions";
import { ArraysSemantic } from "./arrays";
import { TypesSemantic } from "./types";
import { ExternsSemantic } from "./externs";
import { Helpers } from "../helpers";


export class Semantic extends applySemanticMixins(
    BaseSemantic,
    LoggerSemantic,
    ConstantsSemantic,
    VariablesSemantic,
    FunctionsSemantic,
    ExpressionsSemantic,
    ArraysSemantic,
    TypesSemantic,
    ExternsSemantic,
) {
    public sir: Types.Sir[] = [];

    constructor(modulePath: any) {
        super();
        this.modulePath = modulePath
        this.sourceText = fs.readFileSync(modulePath.absolutePath, "utf8");
    }

    public analyze(ast: any[]) {
        const sir = ast.map((statement: any) => this.visitNode(statement)).flat(Infinity)
        return {
            sir,
            sirHash: Helpers.hash(JSON.stringify(sir))
        }
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
