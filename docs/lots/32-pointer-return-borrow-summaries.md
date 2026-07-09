# Lot 32: Pointer Return Borrow Summaries

This lot adds borrow/lifetime summaries for functions that return pointer values
or pointer-derived views from `ptr<T>` parameters.

The goal is to let Yogi accept safe borrowed pointer returns while rejecting
views that would outlive local stack storage.

## Supported Pattern

```ts
function firstRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {
    return matrix[0]
}

function forwardRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {
    return firstRow(matrix)
}

let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: ptr<number[3]> = forwardRow(&matrix)

row[2] = 90
print(matrix[0, 2]) // 90
```

`firstRow` returns a borrowed pointer view derived from parameter `matrix`.
`forwardRow` preserves that summary through the call. At the call site, the
returned pointer inherits the argument provenance, including readonly status.

## Summary Rule

For each function that returns `ptr<T>`:

```txt
return borrows from parameter N
```

is recorded when the returned pointer root resolves to one function parameter.
The summary includes:

```txt
ownership = borrowed
parameterIndex = N
readonlyFollowsParameter = true
viewShape = fixed array shape when known
```

The caller then maps parameter `N` back to the actual argument.

## Readonly Propagation

```ts
function firstRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {
    return matrix[0]
}

const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: ptr<number[3]> = firstRow(&matrix)

row[1] = 99 // error
```

The returned pointer still points into `matrix`, so mutation is rejected because
the root storage is `const`.

## Local Storage Rejection

```ts
function bad(): ptr<number[3]> {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    let p: ptr<number[2, 3]> = &matrix

    return p[0] // error
}
```

Returning `p[0]` would leave the caller with a pointer view into `matrix`, but
`matrix` dies when `bad` returns. Yogi rejects this during semantic analysis:

```txt
cannot return pointer or pointer view derived from local storage
```

The same rule applies to returning the address of a local scalar:

```ts
function bad(): ptr<number> {
    let value: number = 1
    return &value // error
}
```

## Conflicting Return Roots

```ts
function choose(
    left: ptr<number[2, 3]>,
    right: ptr<number[2, 3]>,
    flag: boolean
): ptr<number[3]> {
    if (flag) {
        return left[0]
    }

    return right[0] // error
}
```

This is rejected because one return path borrows from parameter `left`, while the
other borrows from parameter `right`. The current summary model intentionally
requires one stable borrow root.

## Implementation Notes

- Pointer partial views now preserve root provenance through variable bindings.
- Call expressions whose callee returns a borrowed pointer map that borrowed
  parameter back to the actual argument.
- Return discovery now traverses `if` and `else` blocks, so conflicting return
  roots are detected even when one path returns inside a branch.
- This is a small conservative lifetime summary, not a Rust-style borrow
  checker.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_array_indexing.cmake
```

Positive coverage:

- direct pointer view return from a parameter
- forwarding a borrowed pointer return through another function
- returning a local pointer alias derived from a parameter
- mutating through the returned pointer and observing caller storage update
- value parameter copy still does not mutate original fixed-shape storage

Negative coverage:

- mutating a returned pointer view derived from `const` storage
- returning a pointer view derived from local fixed-shape storage
- returning the address of a local scalar
- return paths borrowing from different pointer parameters

## Remaining Work

- Explicit borrowed return/view type syntax.
- Dynamic shaped pointer views such as `ptr<Array<T, Rank>>`.
- Public pointer read/write-through replaced dereference syntax in Lot 34.
- Full escape analysis for non-pointer borrowed views.
- Cleanup/destructor policy for borrowed view descriptors that need metadata
  cleanup without owning the source storage.
