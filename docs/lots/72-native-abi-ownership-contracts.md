# Lot 72: Native ABI Ownership Contracts

This lot introduces declarative Native ABI ownership contracts for `extern`
function signatures.

The goal is to make ownership explicit before implementing advanced mutable
Native ABI behavior such as `ptr<string[]>`, native-owned string returns, or
copy-back of replaced resource values.

## Syntax

Yogi uses JSDoc-style `@abi` tags on extern function signatures.

```ts
extern native from "./libnative.a" {
    /** @abi param values borrowed */
    process(values: string[]): void

    /** @abi return native-owned free=destroyName */
    getName(): string

    destroyName(value: string): void
}
```

This keeps the source compatible with the TypeScript-like parser while letting
Yogi attach ABI-specific metadata.

## Supported Contract Forms

Parameter contracts:

```txt
@abi param <name> borrowed
@abi param <name> copy-back
@abi param <name> native-owned free=<externFunctionName>
@abi param <name> runtime-owned
```

Return contracts:

```txt
@abi return borrowed
@abi return native-owned free=<externFunctionName>
@abi return runtime-owned
```

Aliases:

```txt
@abi parameter <name> borrowed
@abi return owned by=native free=<externFunctionName>
@abi return owned by=runtime
```

## Semantic Rules

- `@abi` contracts are accepted only on extern function signatures.
- A parameter contract must reference an existing parameter.
- Only one contract may target the same parameter.
- Only one return contract is allowed.
- `copy-back` on a parameter requires a pointer type.
- `native-owned` requires a `free=<externFunctionName>` entry.
- A referenced free function must be declared in the same extern block.
- Return contracts cannot be attached to `void` functions.
- Unsupported modes fail during semantic analysis.

## What This Does Today

This lot parses and validates ownership contracts in the frontend semantic
pipeline.

It does not yet change LLVM lowering or runtime behavior.

Current implemented runtime behavior remains:

- `string[]` by value is read-only and temporary.
- `ptr<string[]>` is rejected.
- native string returns still need a future implementation lot before Yogi can
  safely own/free native-produced memory.

## Why This Exists

Without explicit contracts, this native declaration is ambiguous:

```ts
extern names from "./libnames.a" {
    getName(): string
}
```

The compiler cannot know whether the returned pointer is:

- borrowed and valid forever
- native-owned and must be freed
- runtime-owned
- invalid after the function returns

With contracts:

```ts
extern names from "./libnames.a" {
    /** @abi return native-owned free=destroyName */
    getName(): string

    destroyName(value: string): void
}
```

the ownership rule becomes part of the function signature.

## Future Implementation Work

Future lots can consume this metadata to implement:

- native-owned string returns
- `ptr<string[]>` copy-back
- output string parameters
- debug diagnostics for missing frees
- runtime adapters for library-specific free functions
- FlatBuffer serialization if/when the backend needs structured contract data

Until then, the contracts are a validated frontend design surface.
