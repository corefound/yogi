# Lot 25: Fixed-Shape Array Copy

This lot adds explicit `.copy()` for arrays and fixed-shape borrowed views.

## Rule

```txt
matrix[1]        = borrowed view for local use
matrix[1].copy() = owned copy
```

Yogi does not automatically copy borrowed partial views on return. If a borrowed
view from a local owner would escape, the compiler rejects it and asks the user
to make ownership explicit with `.copy()`.

## Local Borrowed View

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

row[2] = 99
print(matrix[1, 2]) // 99
```

`row` borrows from `matrix`; no copy happens.

## Explicit Owned Copy

```ts
let copy: number[3] = matrix[1].copy()

copy[2] = 99

print(copy[2])      // 99
print(matrix[1, 2]) // 6
```

The copy owns independent storage.

## Return

```ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1].copy()
}
```

Returning `matrix[1]` without `.copy()` is rejected because the borrowed view
would outlive the local owner.

## Readonly Owners

Borrowed views from readonly owners remain readonly:

```ts
const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: number[3] = matrix[1]

row[2] = 99 // rejected
```

But `.copy()` creates owned mutable storage when assigned to a mutable binding:

```ts
let copy: number[3] = matrix[1].copy()
copy[2] = 99 // ok
```

## Lowering

The backend lowers `array.copy` by:

```txt
receiver = lower array/view expression
length   = yogi_array_length(receiver)
copy     = yogi_array_create(length)
loop i:
  value = yogi_array_get(receiver, i)
  yogi_array_set(copy, i, value)
return copy
```

Dynamic partial indices keep their existing range checks before the copy loop.
Union element arrays keep boxed element representation.

## Current Coverage

- local borrowed view still mutates the owner
- `.copy()` from borrowed fixed-shape view is independent
- `.copy()` works in return expressions
- `.copy()` from readonly borrowed storage produces owned mutable storage
- `.copy()` works for 3D partial views and larger partial shapes
- `.copy()` preserves union element semantics
- `.copy()` keeps dynamic index runtime bounds checks
- `.copy()` works on owned fixed arrays

## Future Work

- explicit borrowed-view type/syntax
- interprocedural borrowed-view summaries
- native fixed-shape ABI without runtime array descriptors
