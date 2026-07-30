# Lot 94: Fixed-Shape Array and Matrix Iteration

## Goal

Complete end-to-end iteration for fixed arrays and multidimensional
matrices without losing shape metadata or leaking borrowed row-view
descriptors.

## Frontend

Yogi keeps source declarations explicit, but compiler-generated
`for...of` temporaries may infer their internal type from the iterable.
This is required for expressions such as:

```ts
for (let row: number[3] of createMatrix()) {
    for (let value: number of row) {
        print(value)
    }
}
```

Type aliases containing comma-separated fixed dimensions are normalized
before parsing. Function parameters and return types are resolved before
SIR serialization, preserving `fixed` and `shape` metadata across the
frontend/backend boundary.

## LLVM Model

A fixed matrix remains a flat row-major runtime array descriptor.
Partial indexing creates a borrowed descriptor:

```txt
number[2, 3]
  matrix[0] -> borrowed number[3] view
  matrix[1, 2] -> scalar cell at row-major offset 5
```

`.length` is rank-aware:

```txt
number[2, 3].length       = 2
number[2, 3][0].length    = 3
ptr<number[2, 3]>.length  = 2
```

The flattened runtime storage length is an implementation detail and is
not exposed as the logical matrix length.

## View Cleanup

Each local partial fixed-shape view schedules
`yogi_array_release`. The cleanup releases only the heap-allocated view
descriptor; it does not destroy borrowed matrix storage.

The existing control-flow cleanup machinery executes this obligation for:

```txt
normal scope exit
continue
break
early return
```

Returning a local view cancels that local cleanup before ownership is
handed to the return path. Direct partial-view returns continue to use the
existing safe materialization behavior.

## Tests

Focused pipeline coverage:

```txt
tests/runtime/sessions/02-variables-aggregates/fixed_shape_array_iteration.cmake
```

It checks nested iteration, function-return iterables, mutation,
`continue`, `break`, early return, pointer dimensions, readonly
diagnostics, shape mismatches, explicit source types, LLVM verification,
and required IR symbols.

Complete Program Test:

```txt
tests/programs/fixed_matrix_iteration_report.cmake
tests/programs/manifests/fixed_matrix_iteration_report.json
```

The program models a quarterly sales report and validates executable
output, `.ll`, `.o`, final linking, stable ownership decisions, cleanup
obligations, frames, and sanitizer diagnostics.

## Deep Bug Found

The original implementation returned correct numeric output while leaking
every row-view descriptor. Functional assertions alone did not detect it.
Strict Program Observability identified the live `array view`, and this
lot now proves balanced creation/release across all tested exits.

## Remaining Work

```txt
anonymous owned aggregate call arguments need expression cleanup
runtime AnyValue boxes need a complete release policy
escaped dynamic-shape views need full lifetime analysis
native fixed-shape value ABI remains descriptor-based
```
