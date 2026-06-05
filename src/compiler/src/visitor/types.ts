import ts from "../ts";
import { BaseVisitor, Constructor } from "./base";
import { Kinds } from "../helpers/types";



export function TypesVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {        
        visitMethodSignature(node: ts.MethodSignature) {
            return {
                kind: Kinds.ExternMethod,
                name: node.name.getText(),
                returnType: node.type?.getText() ?? "void",
                parameters: node.parameters.map(param => ({
                    name: param.name.getText(),
                    type: param.type?.getText() ?? "any",
                    optional: !!param.questionToken,
                })),
            };
        }

        visitPropertySignature(node: ts.PropertySignature) {
            return {
                kind: Kinds.ExternProperty,
                name: node.name.getText(),
                type: node.type?.getText() ?? "any",
            };
        }

        // private visitExternMember(node: ts.ExternMember) { return this.visitNode(node); } // ExternMember
    };
}