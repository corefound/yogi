import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";
import path from "path";
import { Helpers } from "../helpers";



export function ExternsVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        textOf(node: ts.Expression, sourceFile?: ts.SourceFile) {
            return node && node.getText(sourceFile);
        }

        filePathOf(fileSpecifier: ts.Expression) {
            if (ts.isStringLiteralLike(fileSpecifier)) {
                return path.resolve(path.dirname(this.filePath), fileSpecifier.text);
            }
            return this.textOf(fileSpecifier);
        }

        visitExternDeclaration(node: ts.ExternDeclaration) {
            // const resolvePath = path.resolve(path.dirname(this.filePath), node.moduleSpecifier.getText().replaceAll("\"", ""));
            return {
                kind: Kinds.ExternDeclarations,
                name: node.name.getText(),
                path: this.filePathOf(node.fileSpecifier),
                members: node.members.map((member: ts.Node) => this.visitNode(member)),
                position: this.getNodePosistion(node)
            };
        }
    };
}