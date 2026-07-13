# Lot 53: Borrowed View Object Graph Promotion

This lot extends borrowed fixed-shape array view owner promotion from direct
storage assignments to escaped aggregate graphs.

## Goal

When a borrowed view is nested inside an object or array literal that escapes to
module/global storage, Yogi must preserve observable aliasing.

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

`saved.row` must observe the later writes to `row` and `matrix`.

## Implemented Behavior

Semantic analysis now walks escaping object and array literals recursively.
Borrowed views inside the graph promote their source owner instead of being
materialized too early.

LLVM lowering now has a temporary escaped-graph mode. While that mode is active,
object/array/struct literal population:

```txt
1. lowers each field or element,
2. retains the borrowed view source when the field is a promoted view,
3. deactivates the local aggregate owner so normal scope cleanup will not drop it.
```

This keeps stack-first behavior for local graphs and only extends lifetime when
the graph actually escapes.

## Covered Cases

```ts
saved = { row: row }
saved = { inner: { row: row } }
callbackArray.forEach((index: number): void => {
    saved = row
})
```

Immediate inline callbacks are covered because they are lowered in the current
function context. They can capture a borrowed view and store it into global
storage safely.

## Remaining Work

Persistent closure values are not implemented as heap closure objects yet.
If Yogi later supports storing callbacks/functions as first-class values, those
closures will need explicit capture lifetime summaries.

Local objects that contain borrowed views and later escape by identifier need a
separate object-graph ownership summary. This lot focuses on escaping literals
and immediate inline callback captures.
