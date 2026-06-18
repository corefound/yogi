# Yogi Package Manager CLI

Yogi's main executable is the package-manager CLI. The same binary also owns the
compiler pipeline, so users can work in two modes:

```txt
yogi <file.io>
yogi init
yogi build
yogi run
```

## Direct File Mode

For pipeline tests and quick local experiments, pass a source file directly:

```sh
yogi main.io
```

This compiles the file with the internal compiler driver and writes generated
artifacts next to the source file:

```txt
packages/.cache/meta.fb
packages/.cache/modules/<module>/ast.fb
packages/.cache/modules/<module>/sir.fb
packages/.cache/modules/<module>/<module>.ll
packages/.cache/modules/<module>/<module>.o
packages/.cache/yogi
```

`yogi run main.io` compiles the file and then executes `packages/.cache/yogi`.

## Project Mode

`yogi init` creates a minimal package project:

```txt
yogi.json
yogi.log
main.io
packages/
.gitignore
```

The default `main.io` is intentionally tiny:

```ts
function main(): number {
    return 0
}
```

The manifest points at that file:

```json
{
  "build": {
    "entry": "main.io",
    "output": "dist"
  }
}
```

## Build

`yogi build` reads `yogi.json`, compiles the configured entry with the internal
compiler driver, and copies the linked executable from:

```txt
packages/.cache/yogi
```

to:

```txt
dist/<package-name>
```

Projects with dependencies still use `yogi.log`. Projects with no dependencies
can build with the empty lockfile created by `yogi init`.

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

## Compiler Integration

The old compiler entrypoint is now an internal driver:

```cpp
yogi::core::runCompiler(...)
```

The CLI uses that function instead of shelling out to a separate `yogic`
executable. This keeps the current C++/LLVM backend as the actual compiler while
making the package manager the user-facing workflow.

