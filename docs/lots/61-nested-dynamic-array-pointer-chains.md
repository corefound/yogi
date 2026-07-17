# Lot 61: Nested Dynamic Array Pointer Chains

## Goal

Close pointer validity gaps for jagged dynamic arrays such as
`number[][]`.

The main rule is:

```txt
A pointer into an inner dynamic array keeps the provenance path of the
container it came from.

&matrix[0][1] tracks:
  root: matrix
  container path: [0]
  element path: [1]
```

## Implemented

```txt
✅ nested access paths for dynamic array element expressions
✅ known length tracking for nested containers such as matrix[0]
✅ pop/shift/splice invalidation on the actual nested container path
✅ assignment to matrix[0] invalidates pointers into the replaced row storage
✅ whole matrix replacement invalidates nested row pointers when rows are replaced
✅ unrelated row mutation does not invalidate pointers into another row
✅ positive and negative runtime pipeline coverage
```

## Examples

This remains valid because `push` does not remove the pointed slot:

```ts
let matrix: number[][] = [[1, 2], [3, 4]]
let cell: ptr<number> = &matrix[0][1]

matrix[0].push(5)
cell = 99

print(matrix[0][1]) // 99
print(matrix[0][2]) // 5
```

This is rejected because the inner slot was removed:

```ts
let matrix: number[][] = [[1, 2], [3, 4]]
let cell: ptr<number> = &matrix[0][1]

matrix[0].pop()
cell = 99
```

This is rejected because replacing the row changes the row's inner
storage:

```ts
let matrix: number[][] = [[1, 2], [3, 4]]
let cell: ptr<number> = &matrix[0][1]

matrix[0] = [7, 8]
cell = 99
```

## Tests

The focused pipeline suite is:

```txt
tests/runtime/sessions/02-variables-aggregates/nested_dynamic_array_pointer_chains.cmake
```

It covers:

```txt
✅ nested cell pointer survives inner push
✅ unrelated row mutation keeps pointer valid
✅ row pointer mutates the original row
✅ outer push keeps nested pointer valid
✅ inner pop rejects later pointer use
✅ inner shift rejects later pointer use
✅ row replacement rejects nested pointer use
✅ whole matrix replacement rejects nested pointer use
```

## Next Recommended Lot

```txt
Fixed arrays and multidimensional matrix completion
```

That lot should focus on fixed-shape ABI/lowering gaps, native
row-major storage, and remaining `number[N, M]` behavior rather than
jagged `T[][]` ownership.
