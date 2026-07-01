# Lot 24: Borrowed View Escape Materialization

This lot keeps partial fixed-shape indexing borrowed for local use, but makes
`return matrix[i]` safe and scripting-friendly.

## Rule

```txt
Local partial indexing = borrowed view.
Partial view returned from a local owner = owned materialized copy.
```

Example:

```ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1]
}

let row: number[3] = getRow()
row[2] = 99
print(row[2]) // 99
```

The returned `row` owns its descriptor and storage. It does not borrow from the
local `matrix`, and `matrix` is still cleaned at function exit.

## Copy Shape

Yogi copies only the selected view shape:

```txt
number[2, 3]   return matrix[1]    -> copy number[3]
number[2,2,3]  return image[1]     -> copy number[2, 3]
number[2,2,3]  return image[1, 0]  -> copy number[3]
```

It does not retain or copy the full owner unless the selected view is the full
shape.

## Lowering

The backend creates the same borrowed view used for local partial indexing, then
materializes it before emitting `ret`:

```txt
yogi_array_view(source, offset, visibleLength)
yogi_array_create(visibleLength)
loop:
  value = yogi_array_get(view, i)
  yogi_array_set(copy, i, value)
return copy
```

Dynamic indices keep the existing runtime range checks before the copy loop.
Union element arrays keep their boxed element representation.

## Still Borrowed Locally

This remains a borrowed view and mutates the original owner:

```ts
let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: number[3] = matrix[1]

row[2] = 99
print(matrix[1, 2]) // 99
```

Readonly borrowed views also remain readonly for local use:

```ts
const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: number[3] = matrix[1]

row[2] = 99 // rejected
```

Returning from a `const` local owner materializes an owned mutable copy because
the returned value no longer borrows the readonly storage.

## Future Work

- explicit `.copy()` or view/copy syntax
- interprocedural borrowed-view summaries
- explicit borrowed return types
- native fixed-shape ABI without runtime array descriptors
