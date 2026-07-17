# Lot 74: Native-Owned String Output Parameters

This lot makes native-owned single-string output parameters executable.

## Source Contract

```ts
extern names from "./libname_native.a" {
    /** @abi param name output native-owned free=destroyName */
    getName(name: ptr<string>): void

    destroyName(value: string): void
}
```

The contract means native code writes a newly allocated `char*` into the output
slot. Yogi adopts that text by copying it into a runtime-owned string and then
calls the declared native free function.

## Generated Flow

```txt
allocate temporary native char* output slot
  -> call getName(char**)
  -> load native char*
  -> yogi_string_from_native_owned(native char*)
  -> destroyName(native char*)
  -> write copied string through ptr<string>
```

The native allocation never escapes into normal Yogi code. After the call, the
target variable contains a normal Yogi `string`.

## Semantic Rules

- The supported form is `@abi param <name> output native-owned free=<function>`.
- The parameter type must be `ptr<string>`.
- The argument must be a mutable pointer, such as `&name` where `name` is a
  `let string`.
- The free function must be declared in the same extern block.
- The free function is compiler-managed and user code cannot call it directly.
- If native writes `null`, `yogi_string_from_native_owned` aborts with a runtime
  pointer error.

## Current Scope

Implemented:

- native `char**` output for one `ptr<string>` parameter
- automatic copy into a Yogi-owned string
- automatic native free invocation
- write-back through the original Yogi pointer
- frontend diagnostics for invalid output contracts
- program test proving IR generation, native free invocation, and runtime output

Not implemented:

- `ptr<string[]>`
- `char**` arrays
- string array copy-back
- mutable string arrays
- multi-level pointer ownership
- native-owned non-string resources
