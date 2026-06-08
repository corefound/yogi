import { Types } from "../helpers/types";
import { BaseSemantic, applySemanticMixins } from "./base";
import { ConstantsSemantic } from "./constants";
import { DeclarationsSemantic } from "./declarations";


export class Semantic extends applySemanticMixins(
    BaseSemantic,
    ConstantsSemantic,
    DeclarationsSemantic
) {
    public sir: Types.Sir[] = [];

    constructor(ast: Types.Ast[]) {
        super(ast);
    }

    public analyze() {
        return this.ast.map((ast: Types.Ast) => {
            return ast.body.map((statement: any) => {
                return this.visitNode(statement);
            })
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
