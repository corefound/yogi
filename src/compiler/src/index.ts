import path from "path";
import util from "node:util";
import { Visitor } from "./visitor";
import { ModuleScanner } from "./dfs";
import { Helpers } from "./helpers";
import { Semantic } from "./semantic";
import { FlatBuffer } from "./fbs";
import { Types } from "./helpers/types";

const rootPath = path.resolve(process.cwd(), process.argv[2], "../");
const cachePath = path.relative(rootPath, path.resolve(process.cwd(), process.argv[2], "../", "packages/.cache"));
const globalMetaPath = path.join(path.join(rootPath, cachePath), "meta.fb");

const scanner = new ModuleScanner(Helpers.resolveModule, Helpers.parseFile);
const graph = scanner.scan(path.resolve(process.cwd(), process.argv[2]));
const scc = scanner.sortModules(graph);

const visitor = new Visitor();
const semantic = new Semantic({
  relativePath: process.argv[2],
  absolutePath: path.resolve(process.cwd(), process.argv[2])
});


// Program
const meta: Types.GlobalMetaInput = {
  rootPath,
  outputPath: "",
  cachePath,
  modules: [],
  links: []
}

graph.forEach(async (_, moduleUrl: string) => {
  try {
    const { ast, sourceHash, astHash } = visitor.parse(moduleUrl);

    const { sir, sirHash } = semantic.analyze(ast);

    const relativePath = path.relative(rootPath, moduleUrl)
    const qualifiedName = `${relativePath?.replace(/[\\/]/g, ":")}`

    const modulePath = path.join(cachePath, "modules")
    const astPath = path.join(modulePath, qualifiedName, "/ast.json")
    const objectPath = path.join(modulePath, qualifiedName, path.basename(path.join(modulePath, relativePath)).split(".")[0] + ".o");
    const sirPath = path.join(modulePath, qualifiedName, "/sir.fb");

    const module = {
      isEntry: moduleUrl === path.resolve(process.cwd(), process.argv[2]),
      rootPath: rootPath,
      name: qualifiedName,
      shouldLower: true,
      sourcePath: relativePath,
      astPath,
      objectPath,
      sirPath,

      sourceHash,
      astHash,
      sirHash
    }

    const output = path.join(rootPath, modulePath, qualifiedName, "/sir.fb");
    const buffers = FlatBuffer.createSirModuleBuffer({
      sourcePath: relativePath,
      nodes: sir,
    });

    FlatBuffer.writeBufferToFile(buffers, output);
    meta.modules.push(module);

  } catch (error) {
    console.error(error);
  }

});


const buffer = FlatBuffer.createGlobalMetaBuffer(meta);
FlatBuffer.writeBufferToFile(buffer, globalMetaPath);

// // console.log(JSON.stringify({ ok: true, meta }, null, 4));

process.stdout.write(JSON.stringify({ ok: true, globalMetaPath }, null, 0).toString());
process.exit(0);
