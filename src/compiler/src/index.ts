import ts from "./ts";
import path from "path";
import util from "node:util";
import { Visitor } from "./visitor";
import { ModuleScanner } from "./dfs";
import { Types } from "./helpers/types";
import { Helpers } from "./helpers";

const scanner = new ModuleScanner(Helpers.resolveModule, Helpers.parseFile);
const graph = scanner.scan(path.resolve(process.cwd(), process.argv[2]));
const dag = scanner.topoSort(graph);

const tsConfig = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    strictNullChecks: false,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: false,
    allowJs: false
}

const visitor = new Visitor(graph, tsConfig);
const ast = visitor.visit();
const program: Types.Program = {
    entry: path.resolve(process.cwd(), process.argv[2]),
    graph,
    dag,
    ast
}

console.log(util.inspect(program, false, null, true));

// process.stdout.write(JSON.stringify({ ok: true, program }, null, 0).toString());
// process.exit(0);
