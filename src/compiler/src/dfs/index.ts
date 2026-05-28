import { Errors } from "../loggers/error";
import ts from "typescript";


export class ModuleScanner {
    private visited = new Set<string>();

    public graph = new Map<string, string[]>();

    constructor(
        private resolveModule: (from: string, specifier: string) => string,
        private parseFile: (filePath: string) => ts.SourceFile
    ) { }

    public scan(entryFile: string) {
        this.visit(entryFile);
        return this.graph;
    }
    public topoSort(graph: Map<string, string[]>): string[] {
        const inDegree = new Map<string, number>();
        const adj = new Map<string, string[]>();

        // init all nodes
        for (const node of graph.keys()) {
            inDegree.set(node, 0);
            adj.set(node, []);
        }

        // build correct edges:
        // dependency -> dependent
        for (const [from, deps] of graph.entries()) {
            for (const dep of deps) {

                if (!inDegree.has(dep)) {
                    inDegree.set(dep, 0);
                    adj.set(dep, []);
                }

                if (!inDegree.has(from)) {
                    inDegree.set(from, 0);
                    adj.set(from, []);
                }

                // FIXED EDGE DIRECTION:
                // dep must run BEFORE from
                adj.get(dep)!.push(from);

                // from depends on dep
                inDegree.set(from, inDegree.get(from)! + 1);
            }
        }

        const queue: string[] = [];

        for (const [node, deg] of inDegree.entries()) {
            if (deg === 0) queue.push(node);
        }

        const order: string[] = [];

        while (queue.length) {
            const node = queue.shift()!;
            order.push(node);

            for (const next of adj.get(node) || []) {
                inDegree.set(next, inDegree.get(next)! - 1);

                if (inDegree.get(next) === 0) {
                    queue.push(next);
                }
            }
        }

        return order;
    }
    private visit(file: string) {

        if (this.visited.has(file)) return;
        this.visited.add(file);
        const sourceFile = this.parseFile(file);
        const imports: string[] = [];

        const visitNode = (node: ts.Node) => {
            if (ts.isImportDeclaration(node)) {
                try {
                    const specifier = (node.moduleSpecifier as ts.StringLiteral).text;

                    if (!specifier.endsWith(".io")) {
                        Errors.unnownModuleError(node.moduleSpecifier, file)
                    }

                    const resolved = this.resolveModule(file, specifier);
                    imports.push(resolved);

                    this.visit(resolved);

                } catch (error) {
                    Errors.unnownModuleError(node, file)
                }
            }

            ts.forEachChild(node, visitNode);
        };

        visitNode(sourceFile);

        this.graph.set(file, imports);
    }
}