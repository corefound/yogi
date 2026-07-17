# Lot 62 - Fixed-Shape Array Assignment

## Goal

Complete fixed-size and multidimensional matrix assignment for partial
fixed-shape targets:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let row: number[3] = [7, 8, 9]

matrix[0] = row
```

This must update the first row of `matrix`, not store the row descriptor
as a single flat cell.

## Semantics

Fixed-shape arrays are still runtime-descriptor backed, but their logical
layout is flat row-major storage.

For partial assignment:

```txt
target slice = matrix[i]
source array = row
length = product of remaining dimensions
```

The backend:

1. Computes the row-major target start offset.
2. Reads each boxed source element by index.
3. Writes each boxed element into the existing target slice.

Shape compatibility remains a semantic requirement. Invalid assignments
such as `number[2]` into `number[3]` are rejected before LLVM lowering.

## Covered Cases

```ts
matrix[0] = row
matrix[1] = [7, 8, 9]
image[1] = block
image[0, 1] = pixel
matrix = [[7, 8, 9], [10, 11, 12]]
```

## LLVM Checks

The pipeline test verifies that the generated IR contains:

```txt
array.shape.slice.start
array.shape.slice.copy.index
yogi_array_get
yogi_array_set
```

Those markers prove the RHS is copied into the row-major target slice.

## Test

```txt
tests/runtime/sessions/02-variables-aggregates/fixed_shape_array_assignment.cmake
```

The test compiles, verifies generated artifacts, executes the binary, and
checks negative shape diagnostics.

## Remaining Array Work

The next recommended lot is automatic view escape and lifetime analysis
for fixed-shape and dynamic borrowed views.
