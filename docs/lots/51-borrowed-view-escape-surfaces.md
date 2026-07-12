# Lot 51: Borrowed View Escape Surfaces

This lot extends automatic materialization for fixed-shape borrowed array
views beyond direct `return` and module/global assignment.

## Goal

Yogi keeps partial fixed-shape indexing stack-first and borrowed for local use:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]
```

`row` aliases the second row while both values are local and alive.

When that borrowed row escapes local storage and a copy is semantically
equivalent, the compiler materializes owned storage automatically.

## Covered Surfaces

Known retaining function calls:

```ts
let saved: number[3] = [0, 0, 0]

function retain(row: number[3]): void {
    saved = row
}

function save(): void {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    retain(matrix[0])
}
```

`retain` has a parameter effect summary that marks the argument as escaping.
The call site materializes `matrix[0]` before passing it.

Aggregate member stores:

```ts
type RowBox = {
    row: number[3]
}

let savedBox: RowBox = { row: [0, 0, 0] }

function save(): void {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    savedBox.row = matrix[1]
}
```

The member receives owned storage, not a dangling descriptor into the local
matrix.

Returned aggregate literals:

```ts
function makeBox(): RowBox {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    return { row: matrix[0] }
}
```

The return materialization pass walks object and array literals, so nested
borrowed views are materialized before the local owner is destroyed.

## Remaining Work

Owner promotion is still needed for cases where copying would change observable
aliasing. Callback/closure escape surfaces also need a focused pass once Yogi's
closure representation is finalized.
