import ts from "../ts";
import path from "path";
import { Visitor } from "../visitor";
import { ModuleScanner } from "../dfs";
import { Module, Program } from "../helpers/types";
import { Helpers } from "../helpers";
import util from "node:util";

const scanner = new ModuleScanner(Helpers.resolveModule, Helpers.parseFile);
const graph = scanner.scan(path.resolve(process.cwd(), process.argv[2]));
const dag = scanner.topoSort(graph);

const modules: Module[] = []
graph.forEach((_: string[], key: string) => {
    const visitor = new Visitor(key, {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.NodeNext,
        strictNullChecks: false,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: false,
        allowJs: false
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

console.log(util.inspect(modules, false, null, true));

// process.stdout.write(JSON.stringify({ ok: true, program }, null, 0).toString());
// process.exit(0);
