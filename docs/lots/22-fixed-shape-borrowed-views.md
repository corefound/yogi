# Lot 22: Fixed-Shape Borrowed Views

This lot changes partial indexing of fixed-shape arrays from a copied slice into
a borrowed view.

## Rule

Full indexing returns an element. Partial indexing of a fixed-shape array
returns a borrowed view into the same row-major storage whenever it can be
represented safely.

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

matrix[1, 2] // full indexing -> number
matrix[1]    // partial indexing -> number[3]
```

## Borrowed View Behavior

```ts
let row: number[3] = matrix[1]

row[2] = 99
print(matrix[1, 2]) // 99
```

`row` is a descriptor view into `matrix`, not an independent copy. It stores a
source descriptor, a base offset, and the visible length for the remaining fixed
shape. `yogi_array_get` and `yogi_array_set` forward through the view to the
source descriptor.

## Readonly Propagation

Borrowed views inherit mutability from the storage they borrow. A view from a
mutable owner stays mutable:

```ts
let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: number[3] = matrix[1]

row[2] = 99
print(matrix[1, 2]) // 99
```

A view from a `const` or readonly owner is readonly, even if the view binding is
declared with `let`:

```ts
const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: number[3] = matrix[1]

print(row[2]) // ok
row[0] = 99  // rejected
```

Diagnostic:

```text
cannot mutate borrowed view 'row' because it borrows from readonly source 'matrix'
```

Nested views preserve the same source:

```ts
const image: number[2, 2, 3] = [
    [[1, 2, 3], [4, 5, 6]],
    [[7, 8, 9], [10, 11, 12]]
]

let row: number[2, 3] = image[1]
let pixel: number[3] = row[0]

pixel[1] = 88 // rejected; pixel still borrows from readonly image
```

## Runtime ABI

The backend emits:

```text
yogi_array_view(source, baseOffset, visibleLength)
```

The returned descriptor is heap tracked like other aggregate descriptors, but it
is non-owning. Destroying the view destroys only the descriptor, not the source
storage.

## Lifetime Safety And Return Materialization

Local partial indexing remains borrowed:

```ts
let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: number[3] = matrix[1]

row[2] = 99
print(matrix[1, 2]) // 99
```

When a partial view from a local fixed-shape owner escapes through `return`, the
compiler materializes an owned copy:

```ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1]
}
```

The copy contains only the selected `number[3]` row. It does not keep the whole
`number[2, 3]` owner alive. Returning from a `const` local owner also produces an
owned mutable copy because the result no longer borrows readonly storage.

Interprocedural borrowed-view summaries and explicit borrowed return types are
future work.

## Current Status

Working:

- local non-escaping partial indexing uses borrowed views
- writes through the view update original storage
- dynamic partial indices keep runtime range checks
- union element fixed-shape views preserve assignment validation
- views borrowed from `const` or readonly owners reject indexed mutation
- nested readonly borrowed views preserve the original readonly source
- mutating array methods reject readonly borrowed view receivers
- returning a partial view from a local fixed-shape owner materializes an owned copy

TODO:

- model borrowed views in interprocedural ownership summaries
- explicit `.copy()` / explicit borrowed-view syntax
- native fixed-shape ABI without runtime descriptors
