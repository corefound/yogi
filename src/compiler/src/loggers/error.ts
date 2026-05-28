import ts from "typescript";
import { Loggers } from "./";


export class Errors extends Loggers {
    static typeError = (node: ts.Node, fileName: string) => {
        const position = node.getSourceFile().getLineAndCharacterOfPosition(node.pos)
        const source = node.getSourceFile().getFullText()

        this.error("Missing explicit type annotation", position, source, fileName)
    }

    static unexpectedTypeError = (node: ts.Node, fileName: string) => {        
        const position = node.getSourceFile().getLineAndCharacterOfPosition(node.pos)
        const source = node.getSourceFile().getFullText()

        this.error("Unexpected type annotation", position, source, fileName)
    }

    static unnownModuleError = (node: ts.Node, fileName: string) => {        
        const position = node.getSourceFile().getLineAndCharacterOfPosition(node.pos)
        const source = node.getSourceFile().getFullText()

        this.error("Unknown module", position, source, fileName)
    }
}