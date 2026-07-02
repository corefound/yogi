# Lot 29 - Array Borrow Summaries

This lot adds interprocedural borrow summaries for fixed-shape borrowed views
returned from function parameters.

## Goal

A function may return a borrowed fixed-shape view from one of its parameters
when the compiler can summarize the relationship:

```txt
return borrows from parameter 0
```

The caller then treats the returned view as borrowing from the actual argument.

## Rules

- Returning `matrix[0]` from a parameter `matrix: number[2, 3]` is allowed.
- The returned value is a borrowed view descriptor, not an implicit copy.
- Mutating the returned view mutates the original argument storage.
- Dynamic indices keep the existing runtime range checks.
- Readonly follows the actual argument.
- A `let` binding does not make borrowed readonly storage mutable.
- Returning a borrowed view from a local owner remains rejected.
- `.copy()` returns owned storage and breaks the borrow relationship.
- Simple one-level forwarding through a known summarized function is supported.
- General borrowed-view escape analysis remains future work.

## Examples

```ts
function firstRow(matrix: number[2, 3]): number[3] {
    return matrix[0]
}

let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = firstRow(matrix)
row[2] = 99

print(matrix[0, 2]) // 99
```

Readonly propagation:

```ts
const matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = firstRow(matrix)
row[2] = 99 // rejected
```

Owned copy:

```ts
function firstRowCopy(matrix: number[2, 3]): number[3] {
    return matrix[0].copy()
}
```

## Tests

CTest:

```txt
yogi_pipeline_array_borrow_summaries
```

The suite covers:

- returning first and second rows from parameters
- mutation through a returned borrowed view
- dynamic row index runtime behavior
- 3D pixel and block views
- local `.copy()` return
- parameter `.copy()` breaking the borrow relationship
- readonly actual argument diagnostics
- union element borrowed views
- invalid union assignment through the returned view
- one-level summary forwarding
