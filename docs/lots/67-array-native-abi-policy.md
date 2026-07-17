# Lot 67: Array Native ABI Policy

## Goal

Define the current native ABI boundary for arrays without pretending the full
FFI story is complete.

Yogi arrays currently lower through runtime descriptors and adaptive storage.
Dynamic arrays may use contiguous storage or pointer-safe storage depending on
provenance and live interior pointers. Because of that, an array value cannot
silently cross an external native ABI by value.

## Implemented

`extern ... from "lib"` declarations now reject array types with a dedicated
native ABI diagnostic.

Rejected examples:

``` ts
extern native from "./libnative.a" {
    process(values: number[]): void
    processFixed(values: number[4]): void
    load(): [number, string]
    readonly values: string[]
}
```

The diagnostic explains:

``` txt
array native ABI is not implicit in Yogi
use an explicit pointer or descriptor boundary when that ABI is modeled
```

This is intentionally stricter than TypeScript syntax because Yogi lowers to
native code.

## Current Storage ABI

Array literals still lower through:

``` txt
yogi_array_create_with_storage(length, storageMode)
```

The compiler/runtime choose:

``` txt
contiguous_fast_path
pointer_safe_chunked_mode
```

Fixed-shape arrays still use the runtime array descriptor today. They are
row-major and contiguous in their logical layout, but they are not yet emitted
as raw native LLVM `[N x T]` ABI values.

## Tests

Focused test:

``` txt
tests/runtime/sessions/02-variables-aggregates/array_native_abi_policy.cmake
```

Program test:

``` txt
tests/programs/array_storage_policy_report.cmake
```

The program verifies that normal arrays can remain contiguous while arrays with
live interior pointers use pointer-safe storage, and that both paths still
execute correctly.

## Remaining

``` txt
explicit native array descriptor type
copy-in/copy-out rules
ptr<T> native pointer ABI policy for primitive buffers
fixed-shape raw LLVM ABI lowering
array-of-struct ABI
string array ABI
extern function symbol integration with explicit array ABI
```
