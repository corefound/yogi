# Lot 54: Borrowed View Local Object Graph Identifiers

This lot closes the array borrowed-view case where a view is first stored inside
a local aggregate graph and the graph escapes later by identifier.

## Goal

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

Before this lot, direct escaping literals were handled, but the identifier path
could hide the borrowed view inside `box`.

## Implemented Behavior

Semantic analysis now records a small ownership summary on aggregate symbols:

```txt
borrowedViewGraphSourceNames
borrowedViewGraphAggregateSymbolIds
borrowedViewGraphEscaped
```

When an aggregate identifier escapes, the compiler recursively promotes:

```txt
1. the aggregate graph containers that must outlive the local scope,
2. the borrowed view source owners inside that graph.
```

LLVM lowering then builds escaped aggregate initializers under the same graph
retention mode used for directly escaping literals. That lets the runtime retain
borrowed view sources and deactivate local cleanup for moved/promoted owners.

## Covered Cases

```ts
let box: RowBox = { row: row }
savedBox = box
```

```ts
let inner: RowBox = { row: row }
let outer: OuterBox = { inner: inner }
savedOuter = outer
```

Both preserve later writes through the borrowed view and its original array
owner.

## Remaining Work

Persistent function/closure values are still not implemented as heap closure
objects. Once Yogi supports storing callbacks as first-class values, closure
captures will need their own ownership summaries.
