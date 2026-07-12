# Lot 50: Automatic Borrowed View Materialization

This lot starts the automatic view lifetime model for fixed-shape arrays.

Yogi users still write normal array syntax:

```ts
function row(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1]
}
```

The compiler no longer requires `.copy()` just because a partial fixed-shape
view escapes a local scope. If the view borrows from stack/parameter storage and
escapes through `return` or module/global assignment, semantic analysis
materializes it as an owned copy.

## Rules Added

- Local partial fixed-shape views may be returned without explicit `.copy()`.
- Borrowed view identifiers may be returned without explicit `.copy()`.
- Borrowed view identifiers assigned into module/global storage are materialized
  before the source local is cleaned up.
- Returned/copied views from const sources become owned results, so mutating the
  returned copy does not mutate the const source.
- Local-only partial views still remain lightweight borrowed descriptors.
- Borrowed views from global storage do not need forced materialization for
  lifetime safety.

## Examples

Direct local return:

```ts
function firstLocalRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[0]
}
```

Indirect local return:

```ts
function firstLocalRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]
    let row: number[3] = matrix[0]

    return row
}
```

Assignment into module/global storage:

```ts
let saved: number[3] = [0, 0, 0]

function save(): void {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]
    let row: number[3] = matrix[1]

    saved = row
}
```

`saved` receives an owned materialized array, not a borrowed descriptor pointing
into `matrix`.

## Implementation Notes

Semantic analysis rewrites escaping borrowed views from stack storage to an
internal equivalent of:

```ts
view.copy()
```

That keeps the LLVM/backend path simple because array `.copy()` already lowers
to owned storage.

The existing local borrowed-view behavior remains unchanged:

```ts
let row: number[3] = matrix[1]
```

If `row` stays inside the source lifetime, it can remain a non-owning borrowed
descriptor.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/array_indexing_semantics.cmake
tests/runtime/sessions/02-variables-aggregates/array_borrow_summaries.cmake
```

Added coverage:

- direct local partial view returned without `.copy()`
- local borrowed view identifier returned without `.copy()`
- const-source returned copy is mutable without mutating the source
- local borrowed view assigned into global storage materializes before source
  cleanup

## Remaining Work

- Views stored inside struct/object fields.
- Views passed to unknown/external functions.
- Views escaping through callbacks/closures.
- Interprocedural provenance for non-trivial view chains.
- Owner promotion when aliasing must be preserved instead of materialization.
