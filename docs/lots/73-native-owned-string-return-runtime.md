# Lot 73: Native-Owned String Return Runtime

This lot makes `@abi return native-owned free=...` executable for native
functions that return `string`.

## Source Contract

```ts
extern names from "./libname_native.a" {
    /** @abi return native-owned free=destroyName */
    getName(): string

    destroyName(value: string): void
}
```

The contract means the native function returns a heap-allocated `char*` owned by
the native library. Yogi may read it during the call boundary, but the native
pointer must not escape into ordinary Yogi code.

## Generated Flow

```txt
call getName()
  -> native char*
  -> yogi_string_from_native_owned(native char*)
  -> destroyName(native char*)
  -> regular Yogi string
```

The copied string is now owned by the Yogi runtime and follows the normal string
lifetime rules. The original native allocation is released immediately with the
declared free function.

The free function is compiler-managed. It is declared in the extern block so the
ABI contract can reference it, but user code cannot call it directly with a Yogi
string.

## Runtime Rule

If the native function returns `null`, Yogi aborts with a runtime pointer error.
A Yogi `string` return cannot silently become a null native pointer.

## Current Scope

Implemented:

- `string` return values
- `@abi return native-owned free=<externFunction>`
- automatic copy into a Yogi-owned runtime string
- automatic call to the declared native free function
- IR/program test proving the free function is called

Not implemented in this lot:

- `ptr<string[]>`
- `char**`
- string array copy-back
- mutable native strings
- native-owned arrays
- native-owned non-string resources

Those remain separate ABI lots.
