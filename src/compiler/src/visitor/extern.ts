import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";
import path from "path";
import { Helpers } from "../helpers";



export function ExternsVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        visitExternDeclaration(node: ts.ExternDeclaration) {
            const resolvePath = path.resolve(path.dirname(this.filePath), node.moduleSpecifier.getText().replaceAll("\"", ""));
            return {
                kind: Kinds.ExternDeclarations,
                name: node.name.getText(),
                path: resolvePath,
                members: node.members.map((member: ts.TypeElement) => this.visitNode(member)),
            };
        }
    };
}