import path from "path";
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
const semanticModules = new Map<string, Types.SemanticModuleInfo>();
const entryPath = path.resolve(process.cwd(), process.argv[2]);

// Program
const meta: Types.GlobalMetaInput = {
  rootPath,
  outputPath: path.join(cachePath, "yogi"),
  cachePath,
  modules: [],
  links: []
}

for (const component of scc) {
  if (component.length > 1) {
    throw new Error(
      `Circular dependency detected in module component: ${component
        .map((moduleUrl) => path.relative(rootPath, moduleUrl))
        .join(" -> ")}`
    );
  }

  const moduleUrl = component[0];

  try {
    const relativePath = path.relative(rootPath, moduleUrl)
    const semantic = new Semantic({
      relativePath,
      absolutePath: moduleUrl,
      modules: semanticModules,
    });

    const sourceFile = scanner.takeSourceFile(moduleUrl);
    const { ast, sourceHash, astHash } = visitor.parse(moduleUrl, sourceFile);
    const { sir, sirHash, exports, links } = semantic.analyze(ast);

    const qualifiedName = `${relativePath?.replace(/[\\/]/g, ":")}`

    const modulePath = path.join(cachePath, "modules")
    const astPath = path.join(modulePath, qualifiedName, "/ast.fb")
    const objectPath = path.join(modulePath, qualifiedName, path.basename(path.join(modulePath, relativePath)).split(".")[0] + ".o");
    const sirPath = path.join(modulePath, qualifiedName, "/sir.fb");

    const module = {
      isEntry: moduleUrl === entryPath,
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

    for (const link of links) {
      if (!meta.links.some((current) => current.kind === link.kind && current.path === link.path)) {
        meta.links.push(link);
      }
    }

    semanticModules.set(moduleUrl, {
      absolutePath: moduleUrl,
      relativePath,
      exports,
    });

  } catch (error) {
    console.error(error);
    process.exit(1);
  }

}

console.log(JSON.stringify({ meta }, null, 3));

const metaBuffer = FlatBuffer.createGlobalMetaBuffer(meta);
FlatBuffer.writeBufferToFile(metaBuffer, globalMetaPath);

// Output: this will be read by c++ by using stdout
process.stdout.write(JSON.stringify({ ok: true, globalMetaPath }, null, 0).toString());
process.exit(0);
