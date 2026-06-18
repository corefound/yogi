# Lot 06: Array Copy And Splice Methods

## Goal

This lot extends the array surface with copy and splice-style methods that do
not require callbacks:

```ts
concat(...values)
fill(value, start?, end?)
copyWithin(target, start, end?)
splice(start, deleteCount?, ...items)
toReversed()
toSpliced(start, deleteCount?, ...items)
```

## Semantics

`fill`, `copyWithin`, and `splice` mutate the receiver. They require a mutable,
non-readonly dynamic array and are rejected on tuples.

```ts
let scores: number[] = [1, 2, 3, 4]
scores.fill(9, 1, 3)
scores.copyWithin(0, 2, 4)
let removed: number[] = scores.splice(1, 2, 8, 9)
```

`concat`, `toReversed`, and `toSpliced` return new owned arrays and leave the
receiver valid:

```ts
let left: number[] = [1, 2]
let right: number[] = [3, 4]
let merged: number[] = left.concat(right, 5)

let reversed: number[] = merged.toReversed()
let changed: number[] = merged.toSpliced(1, 2, 8, 9)
```

`concat` accepts either values assignable to the receiver element type or arrays
whose element type is assignable to the receiver element type.

## Ownership Notes

Methods that return the receiver, such as `fill`, `copyWithin`, and `reverse`,
must not create a second aggregate owner when assigned:

```ts
let scores: number[] = [1, 2]
let same: number[] = scores.fill(0)
```

The backend treats `same` as an alias of `scores`, not as a newly owned
aggregate. This avoids double cleanup.

Methods that create new arrays, such as `concat`, `splice`, `toReversed`, and
`toSpliced`, return owned heap aggregates. Local variables initialized from
those calls are cleaned through the existing aggregate owner tracking.

## Runtime ABI

The LLVM backend lowers this lot through:

```txt
yogi_array_clone
yogi_array_append_array
yogi_array_fill
yogi_array_copy_within
yogi_array_splice
yogi_array_to_reversed
yogi_array_to_spliced
```

For `splice` and `toSpliced`, the backend creates a temporary insert array,
passes it to the runtime, and destroys that temporary immediately after the
runtime call.

## Tests

- `yogi_runtime_cast_test` validates the runtime operations directly.
- `yogi_pipeline_array_copy_splice_methods` validates semantic analysis, LLVM
  lowering symbols, final executable output, and negative diagnostics for
  readonly mutation, invalid concat values, and tuple mutation.

## Remaining Array Work

The main remaining array features are:

- `with`, once runtime range diagnostics are formalized.
- Callback/function-value methods such as `forEach`, `map`, `filter`, `reduce`,
  `find`, `some`, and `every`.
- String/comparator-dependent methods such as `join`, `sort`, and `toSorted`.
