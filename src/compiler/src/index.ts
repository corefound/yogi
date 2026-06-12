import path from "path";
import { Visitor } from "./visitor";
import { ModuleScanner } from "./dfs";
import { Helpers } from "./helpers";
import { Semantic } from "./semantic";
import { FlatBuffer } from "./fbs";
import { Types } from "./helpers/types";
import { ByteBuffer } from "flatbuffers";
import { Meta } from "./fbs/generated/yogi/build";

const rootPath = path.resolve(process.cwd(), process.argv[2], "../");
const cachePath = path.relative(rootPath, path.resolve(process.cwd(), process.argv[2], "../", "packages/.cache"));
const globalMetaPath = path.join(path.join(rootPath, cachePath), "meta.fb");

const scanner = new ModuleScanner(Helpers.resolveModule, Helpers.parseFile);
const graph = scanner.scan(path.resolve(process.cwd(), process.argv[2]));
const scc = scanner.sortModules(graph);

const visitor = new Visitor();


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
    const relativePath = path.relative(rootPath, moduleUrl)
    const semantic = new Semantic({
      relativePath,
      absolutePath: moduleUrl,
    });

    const { ast, sourceHash, astHash } = visitor.parse(moduleUrl);
    const { sir, sirHash } = semantic.analyze(ast);

    const qualifiedName = `${relativePath?.replace(/[\\/]/g, ":")}`

    const modulePath = path.join(cachePath, "modules")
    const astPath = path.join(modulePath, qualifiedName, "/ast.fb")
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

    const astOutput = path.join(rootPath, modulePath, qualifiedName, "/ast.fb");
    const astBuffer = FlatBuffer.createAstModuleBuffer({
      sourcePath: relativePath,
      nodes: ast,
    });
    FlatBuffer.writeBufferToFile(astBuffer, astOutput);

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


const metaBuffer = FlatBuffer.createGlobalMetaBuffer(meta);
FlatBuffer.writeBufferToFile(metaBuffer, globalMetaPath);

// Output: this will be read by c++ by using stdout
process.stdout.write(JSON.stringify({ ok: true, globalMetaPath }, null, 0).toString());
process.exit(0);
