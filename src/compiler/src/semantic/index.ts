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
import { IfSemantic } from "./if";
import { Helpers } from "../helpers";
import { ModulesSemantic } from "./modules";
import { Kinds } from "../helpers/types";


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
    ModulesSemantic,
    IfSemantic,
) {
    public sir: Types.Sir[] = [];

    constructor(modulePath: any) {
        super();
        this.modulePath = modulePath
        this.modules = modulePath.modules ?? new Map();
        this.sourceText = fs.readFileSync(modulePath.absolutePath, "utf8");
        this.installBuiltins();
    }

    public analyze(ast: any[]) {
        const sir = ast
            .map((statement: any) => this.visitNode(statement))
            .flat(Infinity)
            .filter((node: any) => node !== null && node !== undefined)
            .filter((node: any) => {
                return !(
                    node.kind === Kinds.Functions.FunctionDeclaration &&
                    !node.body
                );
            });

        return {
            sir,
            sirHash: Helpers.hash(JSON.stringify(sir)),
            exports: this.exportedSymbols,
            links: [...this.externalLinks.values()],
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
