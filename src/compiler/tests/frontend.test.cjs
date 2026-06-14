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

  test("rejects rest destructuring until aggregate runtime storage exists", () => {
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
});
