# Lot 65: Borrowed View Lifetime Analysis

## Goal

Tighten lifetime handling for fixed-shape borrowed views that escape through
normal Yogi syntax.

This lot focuses on nested borrowed-view chains such as:

```ts
let block: number[2, 3] = image[1]
let pixel: number[3] = block[0]
savedPixel = pixel
```

The compiler must keep the full source chain alive. `pixel` borrows from
`block`, and `block` borrows from `image`, so escaping `pixel` must promote both
the direct view source and the transitive owner.

## Implementation

Borrowed-view owner promotion now walks transitive borrowed sources.

When a borrowed view source is itself a borrowed view, Yogi recursively promotes
the source's source graph. This prevents early cleanup of intermediate view
descriptors or the original fixed-shape owner.

## Shadowing Fix

The C++ lowering path also now treats a declaration as a global only when its
`scope_id` is `0`.

This fixes a bug where a local variable with the same name as a module binding
could be lowered as the module global because the lowerer checked only the
variable name.

## Tests

Focused test:

```txt
tests/runtime/sessions/02-variables-aggregates/array_view_lifetime_analysis.cmake
```

Program Test:

```txt
tests/programs/matrix_report.cmake
```

The program validates fixed-shape matrix row views, returned/materialized views,
global view retention, value-parameter isolation, LLVM lowering, object
generation, linking, and runtime execution.

## Current Semantics

Direct storage/global assignment preserves aliasing when observable:

```ts
savedPixel = pixel
pixel[1] = 99
```

Retaining calls with normal value parameters may materialize a copy:

```ts
retain(block[1])
image[1, 1, 0] = 91
```

The retained row keeps the value from the call boundary instead of tracking the
later owner mutation.
