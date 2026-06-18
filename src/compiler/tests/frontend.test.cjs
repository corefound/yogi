const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const compilerRoot = path.resolve(__dirname, "..");
const tsxBin = path.join(
  compilerRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx"
);

function createProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yogi-frontend-"));

  for (const [name, source] of Object.entries(files)) {
    const filePath = path.join(root, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, source.trimStart(), "utf8");
  }

  return root;
}

function runCompiler(root, entry = "main.io") {
  return spawnSync(tsxBin, ["src/index.ts", path.join(root, entry)], {
    cwd: compilerRoot,
    encoding: "utf8",
  });
}

describe("Yogi frontend semantic pipeline", () => {
  test("writes ast, sir, and global meta flatbuffers for a valid module", () => {
    const root = createProject({
      "main.io": `
        let raw: any = 10
        let value: number = raw as number
        let ok: boolean = value == 10
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const output = JSON.parse(result.stdout);
    expect(output.ok).toBe(true);
    expect(fs.existsSync(output.globalMetaPath)).toBe(true);
    expect(fs.existsSync(path.join(root, "packages/.cache/modules/main.io/ast.fb"))).toBe(true);
    expect(fs.existsSync(path.join(root, "packages/.cache/modules/main.io/sir.fb"))).toBe(true);
  });

  test("rejects var declarations because variables must use let or const", () => {
    const root = createProject({
      "main.io": `
        var value: number = 10
      `,
    });

    const result = runCompiler(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("var");
    expect(result.stderr).toContain("let");
    expect(result.stderr).toContain("const");
  });

  test("rejects assigning any to a concrete type without an explicit cast", () => {
    const root = createProject({
      "main.io": `
        let raw: any = 10
        let value: number = raw
      `,
    });

    const result = runCompiler(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("without an explicit cast");
    expect(result.stderr).toContain("any");
    expect(result.stderr).toContain("number");
    expect(result.stderr).toContain("raw");
  });

  test("resolves imports and validates exported symbols across modules", () => {
    const root = createProject({
      "math.io": `
        export let score: number = 42
      `,
      "main.io": `
        import { score } from "./math"

        let total: number = score
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(fs.existsSync(path.join(root, "packages/.cache/modules/math.io/sir.fb"))).toBe(true);
    expect(fs.existsSync(path.join(root, "packages/.cache/modules/main.io/sir.fb"))).toBe(true);
  });

  test("validates object, tuple, and array variables with readable access", () => {
    const root = createProject({
      "main.io": `
        let user: { name: string, age: number } = { name: "Ana", age: 20 }
        let userName: string = user.name

        let pair: [number, string] = [1, "ready"]
        let first: number = pair[0]
        let second: string = pair[1]

        let scores: number[] = [10, 20, 30]
        let middle: number = scores[1]
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("validates non-callback array builtin methods", () => {
    const root = createProject({
      "main.io": `
        let scores: number[] = [1, 2, 3]
        scores.unshift(0)
        scores.reverse()
        let shifted: number | undefined = scores.shift()
        let hasTwo: boolean = scores.includes(2)
        let firstTwo: number = scores.indexOf(2)
        let lastTwo: number = scores.lastIndexOf(2)
        let copy: number[] = scores.slice(0, -1)
        let last: number | undefined = scores.at(-1)
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("rejects reassignment to const variables", () => {
    const root = createProject({
      "main.io": `
        const value: number = 10
        value = 20
      `,
    });

    const result = runCompiler(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("cannot assign");
    expect(result.stderr).toContain("const");
  });

  test("rejects object literals with missing, extra, or wrongly typed properties", () => {
    const missing = runCompiler(createProject({
      "main.io": `
        let user: { name: string, age: number } = { name: "Ana" }
      `,
    }));
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("missing required property");
    expect(missing.stderr).toContain("age");

    const extra = runCompiler(createProject({
      "main.io": `
        let user: { name: string } = { name: "Ana", age: 20 }
      `,
    }));
    expect(extra.status).not.toBe(0);
    expect(extra.stderr).toContain("unknown property");
    expect(extra.stderr).toContain("age");

    const wrongType = runCompiler(createProject({
      "main.io": `
        let user: { name: string, age: number } = { name: "Ana", age: "old" }
      `,
    }));
    expect(wrongType.status).not.toBe(0);
    expect(wrongType.stderr).toContain("property");
    expect(wrongType.stderr).toContain("age");
    expect(wrongType.stderr).toContain("number");
  });

  test("rejects invalid tuple and array values", () => {
    const tupleLength = runCompiler(createProject({
      "main.io": `
        let pair: [number, string] = [1]
      `,
    }));
    expect(tupleLength.status).not.toBe(0);
    expect(tupleLength.stderr).toContain("tuple");
    expect(tupleLength.stderr).toContain("requires");

    const tupleType = runCompiler(createProject({
      "main.io": `
        let pair: [number, string] = [1, 2]
      `,
    }));
    expect(tupleType.status).not.toBe(0);
    expect(tupleType.stderr).toContain("tuple index");
    expect(tupleType.stderr).toContain("string");

    const arrayType = runCompiler(createProject({
      "main.io": `
        let scores: number[] = [1, "bad"]
      `,
    }));
    expect(arrayType.status).not.toBe(0);
    expect(arrayType.stderr).toContain("array");
    expect(arrayType.stderr).toContain("number");
  });

  test("rejects readonly aggregate writes", () => {
    const readonlyObject = runCompiler(createProject({
      "main.io": `
        let user: { readonly name: string } = { name: "Ana" }
        user.name = "Bray"
      `,
    }));
    expect(readonlyObject.status).not.toBe(0);
    expect(readonlyObject.stderr).toContain("readonly");

    const readonlyArray = runCompiler(createProject({
      "main.io": `
        let scores: readonly number[] = [1, 2]
        scores[0] = 3
      `,
    }));
    expect(readonlyArray.status).not.toBe(0);
    expect(readonlyArray.stderr).toContain("readonly");

    const readonlyLength = runCompiler(createProject({
      "main.io": `
        let scores: number[] = [1, 2]
        scores.length = 10
      `,
    }));
    expect(readonlyLength.status).not.toBe(0);
    expect(readonlyLength.stderr).toContain("readonly");
    expect(readonlyLength.stderr).toContain("length");
  });

  test("supports object and tuple destructuring with explicit types", () => {
    const root = createProject({
      "main.io": `
        let { name, age: years }: { name: string, age: number } = { name: "Ana", age: 20 }
        let label: string = name
        let ageValue: number = years

        let [first, second]: [number, string] = [1, "two"]
        let firstValue: number = first
        let secondValue: string = second
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("supports compound assignment and increment/decrement on mutable numbers", () => {
    const root = createProject({
      "main.io": `
        let value: number = 1
        value += 2
        value *= 3
        ++value
        value--
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("rejects definite assignment assertions on variables", () => {
    const root = createProject({
      "main.io": `
        let value!: number
      `,
    });

    const result = runCompiler(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("definite assignment assertion");
    expect(result.stderr).toContain("must be initialized");
  });

  test("supports satisfies and non-null expressions in variable initializers", () => {
    const root = createProject({
      "main.io": `
        let user: { name: string } = { name: "Ana" } satisfies { name: string }
        let maybe: string | undefined = "ready"
        let value: string = maybe!
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("supports foldable nullish coalescing and nullish assignment", () => {
    const root = createProject({
      "main.io": `
        let maybe: string | undefined = undefined
        let value: string = maybe ?? "fallback"
        maybe ??= "ready"

        let present: string | undefined = "set"
        let kept: string = present ?? "fallback"
        present ??= "ignored"
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("supports foldable conditional expressions", () => {
    const root = createProject({
      "main.io": `
        let ok: boolean = true
        let label: string = ok ? "yes" : "no"
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("supports optional property reads on known object literals", () => {
    const root = createProject({
      "main.io": `
        let user: { name: string, age?: number } = { name: "Ana" }
        let age: number | undefined = user.age
        let name: string = user?.name
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("supports destructuring defaults when the fallback can be folded", () => {
    const root = createProject({
      "main.io": `
        let { name = "Ana" }: { name?: string } = { }
        let label: string = name

        let [first = 10]: [number | undefined] = [undefined]
        let value: number = first
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("supports dynamic nullish and conditional expressions in semantic output", () => {
    const dynamicNullish = runCompiler(createProject({
      "main.io": `
        function pick(maybe: string | undefined): string {
          let value: string = maybe ?? "fallback"
          return value
        }
      `,
    }));
    expect(dynamicNullish.status).toBe(0);
    expect(dynamicNullish.stderr).toBe("");

    const dynamicConditional = runCompiler(createProject({
      "main.io": `
        function pick(ok: boolean): string {
          let value: string = ok ? "yes" : "no"
          return value
        }
      `,
    }));
    expect(dynamicConditional.status).toBe(0);
    expect(dynamicConditional.stderr).toBe("");

    const dynamicNullishAssignment = runCompiler(createProject({
      "main.io": `
        let owner: string | undefined = undefined
        owner ??= "platform"
      `,
    }));
    expect(dynamicNullishAssignment.status).toBe(0);
    expect(dynamicNullishAssignment.stderr).toBe("");
  });

  test("supports aggregate storage reads and writes in semantic output", () => {
    const root = createProject({
      "main.io": `
        let user: { name: string, score: number, label?: string } = { name: "Ana", score: 1 }
        user.name = "Bray"
        user.score = user.score + 9
        let label: string = user.label ?? "fallback"

        let scores: number[] = [1, 2, 3]
        scores[1] = 10
        let middle: number = scores[1]

        let pair: [number, string] = [7, "ready"]
        pair[0] = 8
        let first: number = pair[0]
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("supports ownership summaries for aggregate calls across function boundaries", () => {
    const root = createProject({
      "main.io": `
        let saved: number[] = [0]

        function makeScores(): number[] {
          let scores: number[] = [1, 2, 3]
          return scores
        }

        function sum(scores: number[]): number {
          return scores[0] + scores[1]
        }

        function touch(scores: number[]): void {
          scores[0] = scores[0] + 1
        }

        function save(scores: number[]): void {
          saved = scores
        }

        function returnAlias(scores: number[]): number[] {
          let alias: number[] = scores
          return alias
        }

        function readOnlyCaller(): number {
          let local: number[] = [1, 2, 3]
          return sum(local)
        }

        function mutatingCaller(): void {
          let local: number[] = [1, 2, 3]
          touch(local)
        }

        function retainingCaller(): void {
          let local: number[] = [1, 2, 3]
          let alias: number[] = local
          save(alias)
        }

        let result: number[] = makeScores()
        let returned: number[] = returnAlias(result)
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("treats declared unknown aggregate calls as conservative escapes", () => {
    const root = createProject({
      "main.io": `
        declare function externalUse(scores: number[]): void

        function caller(): void {
          let local: number[] = [1, 2, 3]
          externalUse(local)
        }
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("rejects aggregate use after ownership moved through retained callees and unknown calls", () => {
    const retainedByKnownCallee = runCompiler(createProject({
      "main.io": `
        let saved: number[] = [0]

        function save(scores: number[]): void {
          saved = scores
        }

        function invalid(): number {
          let local: number[] = [1, 2]
          let alias: number[] = local
          save(alias)
          return local[0]
        }
      `,
    }));
    expect(retainedByKnownCallee.status).not.toBe(0);
    expect(retainedByKnownCallee.stderr).toContain("cannot use aggregate");
    expect(retainedByKnownCallee.stderr).toContain("local");
    expect(retainedByKnownCallee.stderr).toContain("may retain or return");

    const conditionalMove = runCompiler(createProject({
      "main.io": `
        let saved: number[] = [0]

        function save(scores: number[]): void {
          saved = scores
        }

        function invalid(flag: boolean): number {
          let local: number[] = [1, 2]

          if (flag) {
            save(local)
          }

          return local[0]
        }
      `,
    }));
    expect(conditionalMove.status).not.toBe(0);
    expect(conditionalMove.stderr).toContain("cannot use aggregate");
    expect(conditionalMove.stderr).toContain("local");

    const unknownCall = runCompiler(createProject({
      "main.io": `
        declare function externalUse(scores: number[]): void

        function invalid(): number {
          let local: number[] = [1, 2]
          externalUse(local)
          return local[0]
        }
      `,
    }));
    expect(unknownCall.status).not.toBe(0);
    expect(unknownCall.stderr).toContain("cannot use aggregate");
    expect(unknownCall.stderr).toContain("unknown/external function");
  });

  test("keeps borrowed aggregate arguments usable after known non-retaining calls", () => {
    const root = createProject({
      "main.io": `
        function sum(scores: number[]): number {
          return scores[0] + scores[1]
        }

        function ok(): number {
          let local: number[] = [1, 2, 3]
          let first: number = sum(local)
          return first + local[2]
        }
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("supports loop semantics and array push as a mutating builtin borrow", () => {
    const root = createProject({
      "main.io": `
        function grow(): number {
          let scores: number[] = [1]
          let i: number = 0

          while (i < 3) {
            scores.push(i)
            i = i + 1
          }

          let total: number = 0

          for (let j: number = 0; j < 4; j = j + 1) {
            let one: number[] = [j]

            if (j == 2) {
              continue
            }

            total = total + scores[j]

            if (j == 3) {
              break
            }
          }

          return total
        }

        let value: number = grow()
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("rejects invalid array push and use after move from loop body", () => {
    const wrongPushType = runCompiler(createProject({
      "main.io": `
        function invalid(): void {
          let scores: number[] = [1]
          scores.push("bad")
        }
      `,
    }));
    expect(wrongPushType.status).not.toBe(0);
    expect(wrongPushType.stderr).toContain("push");
    expect(wrongPushType.stderr).toContain("number");

    const movedInLoop = runCompiler(createProject({
      "main.io": `
        let saved: number[] = [0]

        function save(scores: number[]): void {
          saved = scores
        }

        function invalid(flag: boolean): number {
          let local: number[] = [1, 2]

          while (flag) {
            save(local)
            break
          }

          return local[0]
        }
      `,
    }));
    expect(movedInLoop.status).not.toBe(0);
    expect(movedInLoop.stderr).toContain("cannot use aggregate");
    expect(movedInLoop.stderr).toContain("local");
  });

  test("rejects rest destructuring until aggregate copying exists", () => {
    const objectRest = runCompiler(createProject({
      "main.io": `
        let { name, ...rest }: { name: string, age: number } = { name: "Ana", age: 20 }
      `,
    }));
    expect(objectRest.status).not.toBe(0);
    expect(objectRest.stderr).toContain("object rest bindings");

    const arrayRest = runCompiler(createProject({
      "main.io": `
        let [first, ...rest]: number[] = [1, 2, 3]
      `,
    }));
    expect(arrayRest.status).not.toBe(0);
    expect(arrayRest.stderr).toContain("array rest bindings");
  });

  test("keeps TypeScript switch block scoping and default fallthrough behavior", () => {
    const root = createProject({
      "main.io": `
        function blockCaseRedeclare(x: number): number {
          switch (x) {
            case 1: {
              let value: number = 1
              return value
            }

            case 2: {
              let value: number = 2
              return value
            }

            default:
              return 0
          }
        }

        function defaultInMiddle(x: number): number {
          let value: number = 0

          switch (x) {
            case 1:
              value = value + 1

            default:
              value = value + 10

            case 2:
              value = value + 100
              break
          }

          return value
        }
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("rejects switch fallthrough use-before-init even after a nested switch", () => {
    const root = createProject({
      "main.io": `
        function invalid(x: number, y: number): number {
          switch (x) {
            case 1:
              let value: number = 1
              break

            case 2:
              switch (y) {
                default:
                  let nested: number = 0
              }

            case 3:
              return value

            default:
              return 0
          }
        }
      `,
    });

    const result = runCompiler(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("may be used before initialization");
    expect(result.stderr).toContain("value");
  });

  test("accepts grouped fallthrough switch as always-returning", () => {
    const root = createProject({
      "main.io": `
        function grouped(x: number): number {
          switch (x) {
            case 1:
            case 2:
              return 10

            default:
              return 0
          }
        }
      `,
    });

    const result = runCompiler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
