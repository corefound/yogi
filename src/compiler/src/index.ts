import ts from "./ts";
import path from "path";
import util from "node:util";
import { Visitor } from "./visitor";
import { ModuleScanner } from "./dfs";
import { Helpers } from "./helpers";
import { Semantic } from "./semantic";

const scanner = new ModuleScanner(Helpers.resolveModule, Helpers.parseFile);
const graph = scanner.scan(path.resolve(process.cwd(), process.argv[2]));

console.log(graph)
const rootPath = path.resolve(process.cwd(), process.argv[2], "../");
const scc = scanner.sortModules(graph);

const tsConfig = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.NodeNext,
  strictNullChecks: false,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: false,
  allowJs: false,
};

// Visitor
const visitor = new Visitor(rootPath, graph, tsConfig);
const ast = visitor.visit();

// Semantic Analysis
const semantic = new Semantic(ast);
const sir = semantic.analyze();

console.log(util.inspect({ sir }, false, null, true));

// Program
// const program: Types.Program = {
//     entry: path.resolve(process.cwd(), process.argv[2]),
//     graph,
//     dag,
//     ast
// }

// console.log(util.inspect(program, false, null, true));
// process.stdout.write(JSON.stringify({ ok: true, program }, null, 0).toString());
// process.exit(0);
