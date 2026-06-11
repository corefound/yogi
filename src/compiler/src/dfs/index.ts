import { Helpers } from "../helpers";
import { Errors } from "../loggers/error";
import ts from "../ts";


export class ModuleScanner {
    private visited = new Set<string>();

    public graph = new Map<string, string[]>();

    constructor(private resolveModule: (from: string, specifier: string) => string, private parseFile: (filePath: string) => ts.SourceFile) {

    }

    public scan(entryFile: string) {
        this.visit(entryFile);
        return this.graph;
    }
    public topoSort(graph: Map<string, string[]>): string[] {
        const inDegree = new Map<string, number>();
        const adj = new Map<string, string[]>();

        for (const node of graph.keys()) {
            inDegree.set(node, 0);
            adj.set(node, []);
        }

        for (const [from, deps] of graph.entries()) {
            if (!inDegree.has(from)) {
                inDegree.set(from, 0);
                adj.set(from, []);
            }

            for (const dep of deps) {
                if (!inDegree.has(dep)) {
                    inDegree.set(dep, 0);
                    adj.set(dep, []);
                }

                // dep -> from
                adj.get(dep)!.push(from);
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

            for (const next of adj.get(node) ?? []) {
                inDegree.set(next, inDegree.get(next)! - 1);

                if (inDegree.get(next) === 0) {
                    queue.push(next);
                }
            }
        }

        if (order.length !== inDegree.size) {
            const cycleNodes = [...inDegree.entries()]
                .filter(([, deg]) => deg > 0)
                .map(([node]) => node);

            throw new Error(
                `Circular dependency detected: ${cycleNodes.join(" -> ")}`
            );
        }

        return order;
    }

    public getStronglyConnectedComponents(graph: Map<string, string[]>): string[][] {
        let index = 0;

        const stack: string[] = [];
        const onStack = new Set<string>();

        const indexes = new Map<string, number>();
        const lowlink = new Map<string, number>();

        const components: string[][] = [];

        const visit = (node: string) => {
            indexes.set(node, index);
            lowlink.set(node, index);
            index++;

            stack.push(node);
            onStack.add(node);

            const deps = graph.get(node) ?? [];

            for (const dep of deps) {
                if (!indexes.has(dep)) {
                    visit(dep);
                    lowlink.set(
                        node,
                        Math.min(lowlink.get(node)!, lowlink.get(dep)!)
                    );
                } else if (onStack.has(dep)) {
                    lowlink.set(
                        node,
                        Math.min(lowlink.get(node)!, indexes.get(dep)!)
                    );
                }
            }

            if (lowlink.get(node) === indexes.get(node)) {
                const component: string[] = [];

                while (true) {
                    const current = stack.pop()!;
                    onStack.delete(current);
                    component.push(current);

                    if (current === node) break;
                }

                components.push(component);
            }
        };

        for (const node of graph.keys()) {
            if (!indexes.has(node)) {
                visit(node);
            }
        }

        return components;
    }

    public sortModules(graph: Map<string, string[]>): string[][] {
        const sccs = this.getStronglyConnectedComponents(graph);

        // Aquí luego haces topo sort entre grupos,
        // no entre archivos individuales.
        return sccs;
    }

    private visit(file: string) {
        if (this.visited.has(file)) return;

        this.visited.add(file);
        const sourceFile = this.parseFile(file);
        const imports: any[] = [];

        const visitNode = (node: ts.Node) => {
            if (ts.isImportDeclaration(node)) {
                try {
                    const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
                    const resolved = this.resolveModule(file, specifier);

                    imports.push(resolved);
                    this.visit(resolved);

                } catch (error) {
                    console.log(error.toString());
                    Errors.unnownModuleError(node, file)
                }
            }

            ts.forEachChild(node, visitNode);
        };

        visitNode(sourceFile);

        this.graph.set(file, imports);
    }
}