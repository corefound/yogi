# Lot 75: Runtime-Owned Native Strings

This lot makes runtime-owned single-string Native ABI contracts executable.

## Source Contracts

```ts
extern names from "./libname_native.a" {
    /** @abi return runtime-owned */
    getRuntimeName(): string

    /** @abi param name output runtime-owned */
    readRuntimeName(name: ptr<string>): void
}
```

The contract means native code returns or writes a `char*` that is already owned
by the Yogi runtime. The compiler does not copy the text and does not call a
native free function.

## Generated Flow

For a runtime-owned return:

```txt
call native function
  -> receive char*
  -> yogi_string_require_runtime_owned(char*)
  -> return the same Yogi-owned string pointer
```

For a runtime-owned output parameter:

```txt
allocate temporary native char* output slot
  -> call native function with char**
  -> load char*
  -> yogi_string_require_runtime_owned(char*)
  -> write the same Yogi-owned string through ptr<string>
```

## Semantic Rules

- `@abi return runtime-owned` is currently supported only for `string`.
- `@abi param <name> output runtime-owned` is currently supported only for
  `ptr<string>`.
- Runtime-owned contracts must not declare `free=<function>`.
- Native code must return a pointer that was allocated/registered by the Yogi
  runtime.
- If native returns `null` or an unregistered pointer, the runtime aborts with
  a pointer diagnostic.

## Difference From Native-Owned

`native-owned` means native allocated the buffer and Yogi must copy it before
calling the declared native free function.

`runtime-owned` means native is handing back a Yogi runtime string. Yogi validates
the pointer and adopts it directly.

## Current Scope

Implemented:

- runtime-owned `string` returns
- runtime-owned `ptr<string>` output parameters
- frontend diagnostics for invalid `free=...` on runtime-owned contracts
- LLVM lowering through `yogi_string_require_runtime_owned`
- program test covering IR generation and runtime output

Not implemented:

- `ptr<string[]>`
- mutable string array copy-back
- native-owned arrays or multi-level pointer ownership
- ownership contracts for non-string resources
