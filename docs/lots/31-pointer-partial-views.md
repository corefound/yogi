# Lot 31: Pointer Partial Views

This lot completes partial indexing for pointers to fixed-shape arrays.

Before this lot, `ptr<number[2, 3]>[0]` was rejected. Now partial indexing
returns another pointer that views the original aggregate storage:

```ts
function firstRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {
    return matrix[0]
}

let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: ptr<number[3]> = firstRow(&matrix)
row[1] = 77

print(matrix[0, 1]) // 77
```

## Rules

- Full pointer indexing still returns the element value.
- Partial pointer indexing over a fixed-shape array returns `ptr<slice>`.
- The returned pointer is a borrowed descriptor view into the same array buffer.
- The view does not copy.
- The view inherits direct pointer provenance and `readonly`/`mutable` permission.
- Mutating through the view mutates the original fixed-shape array.
- Direct assignment to the partial slice expression is rejected.

```ts
function bad(matrix: ptr<number[2, 3]>, row: number[3]): void {
    matrix[0] = row // error
}
```

The safe mutation form is:

```ts
function setSecond(row: ptr<number[3]>): void {
    row[1] = 77
}

function apply(matrix: ptr<number[2, 3]>): void {
    setSecond(matrix[0])
}
```

## LLVM Lowering

Pointers to arrays now pass the runtime array descriptor directly. This keeps
array pointer indexing as descriptor operations:

```txt
&matrix                  -> loaded array descriptor pointer
ptr<array>[i, j]         -> yogi_array_get / yogi_array_set at row-major offset
ptr<array>[i] partial    -> yogi_array_view(source, offset, remainingLength)
ptr<number[3]>[j] write  -> yogi_array_set(view, j, value)
```

The runtime view is borrowed. It references the source array storage and does
not own the backing buffer.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_array_indexing.cmake
```

Positive coverage:

- full fixed-shape pointer indexing read/write
- dynamic 1D array pointer indexing
- `ptr<number[2, 3]>[0] -> ptr<number[3]>`
- `ptr<number[2, 2, 3]>[1, 0] -> ptr<number[3]>`
- mutating through the returned pointer updates original storage
- union element assignment through pointer indexing

Negative coverage:

- missing `&` when a pointer parameter is expected
- value/pointer mismatch
- wrong fixed-shape pointee
- pointer-to-pointer mismatch
- returning `ptr<number[3]>` where `number[3]` is expected
- direct assignment to a pointer partial view
- mutating a partial view derived from `const` storage
- invalid union element assignment

## Remaining Work

- Interprocedural borrow/lifetime summaries for functions that return
  pointer-derived views.
- Reject returning pointer views derived from local storage once return-view
  lifetime validation is implemented.
- Dynamic shaped array pointers such as `ptr<Array<T, Rank>>`.
- General dereference syntax.
