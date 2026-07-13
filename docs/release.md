# Release Notes

This file tracks user-visible language/runtime behavior added by recent lots.

## Borrowed Views Through Local Object Graph Identifiers

Borrowed fixed-shape views can now be stored inside a local object graph and
escape later by assigning that graph identifier to module/global storage.

```ts
type RowBox = {
    row: number[3]
}

let saved: RowBox = { row: [0, 0, 0] }

function save(): void {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    let row: number[3] = matrix[1]
    let box: RowBox = { row: row }

    saved = box
    row[0] = 91
    matrix[1, 1] = 92
}
```

`saved.row` observes `91, 92, 6`. Nested local graph identifiers are also
covered, such as `let outer = { inner }; savedOuter = outer`.

## Borrowed Views Inside Escaping Object Graphs

Borrowed fixed-shape views stored inside escaping object or array literals now
preserve observable aliasing by promoting the source owner instead of copying
too early.

```ts
type RowBox = {
    row: number[3]
}

let saved: RowBox = { row: [0, 0, 0] }

function save(): void {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    let row: number[3] = matrix[1]

    saved = { row: row }
    row[0] = 41
    matrix[1, 1] = 51
}
```

After `save()`, `saved.row` observes `41, 51, 6`. Nested object literals follow
the same rule. Immediate inline callbacks can also capture a borrowed view and
store it into module/global storage safely; persistent escaping closures remain
future work.

## Borrowed View Owner Promotion

Fixed-shape borrowed array views that escape through module/global storage or
aggregate member storage can now preserve observable aliasing instead of always
materializing a copy.

```ts
let saved: number[3] = [0, 0, 0]

function save(): void {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    let row: number[3] = matrix[1]

    saved = row
    row[0] = 40
    matrix[1, 1] = 50
}
```

`saved` remains a view of the promoted owner, so later writes through `row` or
`matrix` are visible after `save()` returns.

## Borrowed View Escape Surfaces

Automatic materialization for fixed-shape borrowed array views now also covers
known retaining calls, aggregate member stores, and nested views inside returned
aggregate literals.

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

The call site sees that `retain` may store the parameter and materializes an
owned row before the local matrix is cleaned up.

## Automatic Borrowed View Materialization

Fixed-shape partial views can now escape local stack storage through `return` or
module/global assignment without forcing the user to write `.copy()`.

```ts
function row(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1]
}
```

The compiler materializes an owned result before the local source is cleaned up.
The same applies when a borrowed view identifier escapes:

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

`saved` receives safe owned storage, not a dangling view into `matrix`.

Local-only partial views still use lightweight borrowed descriptors, and
explicit `.copy()` remains available when the programmer wants an owned copy at
a specific point.

## Dynamic Array Iteration and Structural Mutation

Dynamic-array `for...of` now supports structural mutation while keeping
iteration predictable.

Yogi chooses the lowering strategy per loop:

```txt
fast path:
  used when structural mutation is not possible
  lowers to direct length/index access
  does not allocate a stable iteration plan

stable slot plan:
  used when the loop may mutate the array, passes &array to a call, or iterates
  as ptr<T>
  captures the slots that existed at loop entry
  uses runtime slot validity as the source of truth
```

Stable iteration rules:

- Elements added after the loop starts are not visited.
- Elements removed before their turn are skipped.
- Surviving slots remain visitable even if their logical index changes.
- `sort()` and `reverse()` mutate the array immediately but do not reorder the
  current iteration plan.
- Whole-array assignment keeps preserved slot identities and skips planned slots
  removed by the assignment.

By-value iteration and pointer iteration are intentionally different:

```ts
for (let value: number of values) {
    value = 99
}
```

`value` is a local value, not an implicit pointer.

```ts
for (let value: ptr<number> of values) {
    value = 99
}
```

`value` is an explicit pointer to the current array slot and mutates the original
slot if it is still valid.

Nested pointer-array calls also participate:

```ts
function dropFirst(values: ptr<number[]>): void {
    values.shift()
}

for (let value: number of values) {
    dropFirst(&values)
}
```

The loop uses a stable plan because `dropFirst(&values)` may structurally mutate
the iterated array.

Sequential `shift()` behavior is runtime-consistent:

```txt
shift on [A, B, C] removes A
next shift removes B
next shift removes C
shift on [] returns undefined and removes nothing
```

Strict indexing remains strict:

```ts
values[0]
```

If `values` is empty, this still reports the normal Yogi range error.
