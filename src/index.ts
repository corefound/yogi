import { Visitor } from "@/visitor";
import { Past } from '@corefound/past';
import ts from "typescript";

const visitor = new Visitor(process.argv[2], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    strictNullChecks: false,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: false
});

const ast = visitor.visit();
console.log(JSON.stringify(ast, null, 2));

const past = new Past(ast)
past.print();
// past.toExecutableFile();
