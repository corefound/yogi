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

## Runtime ABI

The backend emits:

```text
yogi_array_view(source, baseOffset, visibleLength)
```

The returned descriptor is heap tracked like other aggregate descriptors, but it
is non-owning. Destroying the view destroys only the descriptor, not the source
storage.

## Lifetime Safety

The compiler rejects obvious dangling borrowed slices:

```ts
function bad(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1]
}
```

Diagnostic:

```text
cannot return borrowed slice from local fixed-shape array 'matrix'
```

This is intentionally conservative. Richer interprocedural borrowed-view
summaries are future work.

## Current Status

Working:

- local non-escaping partial indexing uses borrowed views
- writes through the view update original storage
- dynamic partial indices keep runtime range checks
- union element fixed-shape views preserve assignment validation
- returning a borrowed slice from a local fixed-shape array is rejected

TODO:

- propagate source const/readonly through borrowed views
- model borrowed views in interprocedural ownership summaries
- native fixed-shape ABI without runtime descriptors
