# Yogi Package Manager CLI

Yogi's main executable is the package-manager CLI. The same binary also owns the
compiler pipeline, so users can work in two modes:

```txt
yogi <file.ts>
yogi init
yogi build
yogi run
```

## Direct File Mode

For pipeline tests and quick local experiments, pass a source file directly:

```sh
yogi main.ts
```

This compiles the file with the internal compiler driver and writes generated
artifacts next to the source file:

```txt
packages/.cache/meta.fb
packages/.cache/modules/<module>/ast.fb
packages/.cache/modules/<module>/sir.fb
packages/.cache/modules/<module>/<module>.ll
packages/.cache/modules/<module>/<module>.o
packages/.cache/bin/main
packages/bin/yogi
```

`yogi run main.ts` compiles the file and then executes
`packages/.cache/bin/main`. The cached executable is the user's program. The
`packages/bin/yogi` entry is the package-manager/compiler tool symlink, so the
two paths should not share the same name.

## Project Mode

`yogi init` creates a minimal package project:

```txt
yogi.json
yogi.lock
main.ts
packages/
.gitignore
```

The default `main.ts` is intentionally tiny:

```ts
function main(): number {
    return 0
}
```

The manifest points at that file:

```json
{
  "build": {
    "entry": "main.ts",
    "output": "dist"
  }
}
```

## Command Semantics

`compile`, `build`, `run`, and `start` are intentionally separate:

| Command | Meaning today | Output |
|---|---|---|
| `yogi compile main.ts` | Ahead-of-time compile a single source file | `packages/.cache/bin/main` next to the source |
| `yogi main.ts` | Shorthand for single-file compile | `packages/.cache/bin/main` next to the source |
| `yogi build` | Ahead-of-time build the current package project | `dist/<package-name>` |
| `yogi run` | Build the project, then execute `dist/<package-name>` | executable process result |
| `yogi run main.ts` | Compile a single source file, then execute its cache binary | executable process result |
| `yogi start` | Alias for `yogi run` | executable process result |

There is no non-AOT runtime/JIT mode yet. Today, every successful `compile`,
`build`, or `run` path still goes through the compiler pipeline and produces a
native executable.

## Build

`yogi build` reads `yogi.json`, compiles the configured entry with the internal
compiler driver, and copies the linked executable from:

```txt
packages/.cache/bin/main
```

to:

```txt
dist/<package-name>
```

Projects with dependencies still use `yogi.lock`. Projects with no dependencies
can build with the empty lockfile created by `yogi init`.

## Packages

Installed packages belong under:

```txt
packages/libs/<package>/<version>/
```

The current installer can resolve dependency versions and create package folders,
but it still needs the real GitHub release download path:

1. resolve package metadata from the registry/backend
2. read the GitHub release asset URL and checksum
3. download the release archive
4. verify checksum
5. unpack into `packages/libs/<package>/<version>/`
6. write `yogi.lock`
7. expose installed package modules/libs to the compiler during `build`

## Run

`yogi run` builds the project and executes:

```txt
dist/<package-name>
```

`yogi start` is an alias for `yogi run`.

Use `--` to pass runtime arguments:

```sh
yogi run -- arg1 arg2
```

## Builtin Print

The first global builtin used for pipeline testing is:

```ts
print(value)
```

It accepts one value and currently prints `number`, `boolean`, `string`,
`null`, `undefined`, and `any` values through the runtime. This is intentionally
small; it gives executable programs visible output while the standard library is
still being designed.

Example:

```ts
function main(): number {
    print("hello from yogi")
    print(42)
    return 0
}

main()
```

The native entrypoint initializes modules and executes the entry file's top-level
statements. `main` is just a normal function name; it runs only when the source
calls it explicitly, and a file can use top-level code without declaring `main`.

## Publish

`yogi publish` treats each package version as immutable. Before creating or
pushing a release tag, the CLI checks GitHub for the release tag derived from
`yogi.json` (`v<version>`). If the release already exists, publish fails with a
clear error instead of overwriting it.

The GitHub client also treats a duplicate-release `422` response from the create
release API as a publish error. That second check protects against races where
the release appears after the preflight check.

## Compiler Integration

The old compiler entrypoint is now an internal driver:

```cpp
yogi::core::runCompiler(...)
```

The CLI uses that function instead of shelling out to a separate `yogic`
executable. This keeps the current C++/LLVM backend as the actual compiler while
making the package manager the user-facing workflow.
