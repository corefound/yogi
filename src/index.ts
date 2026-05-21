import { Visitor } from "@/visitor";
import { Past } from '@corefound/past';
import ts from "typescript";
import { ModuleScanner } from "./dfs";
import fs from "fs";
import path from "path";
import { Module, Program } from "./helpers/types";

const parseFile = (filePath: string): ts.SourceFile => {
    const code = fs.readFileSync(filePath, "utf-8");

    return ts.createSourceFile(
        filePath,
        code,
        ts.ScriptTarget.Latest,
        true
    );
};

const resolveModule = (fromFile: string, specifier: string): string => {
    if (specifier.startsWith(".")) {
        return path.resolve(path.dirname(fromFile), specifier) + ".ts";
    }

    // fallback for now (node_modules etc.)
    return specifier;
};

const scanner = new ModuleScanner(resolveModule, parseFile);
const graph = scanner.scan(path.resolve(process.cwd(), process.argv[2]));
const dag = scanner.topoSort(graph);

const modules: Module[] = []
graph.forEach((_, key) => {
    const visitor = new Visitor(key, {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.NodeNext,
        strictNullChecks: false,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: false
    });

    const ast = visitor.visit();
    modules.push(ast);
})

const program: Program = {
    entry: path.resolve(process.cwd(), process.argv[2]),
    graph,
    dag,
    modules
}

console.log(program);
