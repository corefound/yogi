# Lot 59: Array Callback Ownership And Borrow Semantics

This lot closes the current ownership policy for array callbacks.

Yogi keeps the familiar JavaScript/TypeScript callback method names, but the
semantics are stricter and RAII-oriented:

```txt
callback value parameter = temporary value/borrow input
callback value parameter != mutable source-slot borrow
returned aggregate = owned by the method result
source-array structural mutation during callback = semantic error
```

## Supported Behavior

Callback methods now have a concrete ownership answer:

- `forEach`, `map`, `filter`, `some`, `every`, `find`, `findIndex`,
  `findLast`, `findLastIndex`, `reduce`, `reduceRight`, and `flatMap` borrow
  the source array while the callback runs.
- Callback value parameters may be used normally, but they are not mutable
  borrows of the source array slot.
- `map`, `flatMap`, and `reduce` can accept callback-returned aggregates; the
  returned values are transferred into the result according to normal Yogi
  ownership rules.
- A callback may mutate a different captured array.
- A callback may not mutate the same source array that is being iterated.
- The same rule applies to `sort` and `toSorted` comparator callbacks.

Safe:

```ts
let source: number[] = [1, 2, 3]
let sink: number[] = []

source.forEach((value: number): void => {
    sink.push(value * 10)
})
```

Safe aggregate return:

```ts
let values: number[] = [1, 2]
let pairs: number[][] = values.map((value: number): number[] => {
    return [value, value + 10]
})
```

Rejected:

```ts
let values: number[] = [1, 2]

values.forEach((value: number): void => {
    values.push(value)
})
```

Reason:

```txt
The callback is running while the source array is temporarily borrowed.
Mutating that same source during the callback would make traversal,
slot identity, pointer validity, and ownership cleanup ambiguous.
```

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/array_callback_ownership_borrow.cmake
```

The suite checks:

- callback value parameters do not mutate the source slot
- callbacks may mutate a different captured array
- `map` can return aggregate arrays
- `flatMap` can return aggregate arrays
- `filter` does not move the source array
- `toSorted` comparator values are borrowed/read-only callback inputs
- `reduce` can carry an aggregate accumulator
- inline callbacks cannot mutate the source array
- named callbacks cannot mutate the source array
- comparator callbacks cannot mutate the source array

## Remaining Work

This does not implement a persistent closure runtime. Inline callbacks passed
directly to array methods remain the supported closure/capture model for now.

