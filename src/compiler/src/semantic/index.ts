import { Types } from "../helpers/types";


export class Semantic {
    private ast: Types.Ast[];
    private diagnostics: Types.Diagnostics[];

    constructor(ast: Types.Ast[]) {
        this.ast = ast
    }


    public analyze() {
        this.ast.forEach((ast: Types.Ast) => {
            console.log(ast.module)
        })

        return this.ast
    }
}