# Lot 28 - Array Flat Depth Semantic Typing

This lot makes `flat(depth)` produce a semantic result type that matches known literal depth.

## Goal

Runtime already honored the depth argument. The missing piece was semantic typing:

```ts
let values: number[][][] = [
    [[1, 2]],
    [[3, 4]]
]

let one: number[][] = values.flat(1)
let two: number[] = values.flat(2)
```

Both assignments now type-check because the compiler removes the correct number of array nesting layers.

## Rules

- `flat()` defaults to depth `1`.
- `flat(0)` keeps the same nesting level.
- `flat(N)` removes up to `N` dynamic array nesting layers when `N` is a known numeric literal.
- Depth greater than available nesting clamps to the flattened element array type.
- Union element types are preserved.
- Known numeric literal depth must be a non-negative integer.
- Non-literal depth keeps the current conservative one-level fallback typing.

## Examples

```ts
let values: number[][] = [[1, 2], [3, 4]]
let result: number[] = values.flat()
```

```ts
let values: number[][][] = [
    [[1, 2]],
    [[3, 4]]
]

let result: number[] = values.flat(2)
```

```ts
type Cell = number | string

let values: Cell[][] = [
    [1, "A"],
    [2, "B"]
]

let result: Cell[] = values.flat(1)
```

## Diagnostics

Invalid depth type:

```ts
let result: number[] = values.flat("1")
// error: flat depth must be number
```

Invalid known literal depth:

```ts
let negative: number[] = values.flat(-1)
let fractional: number[] = values.flat(1.5)
// error: flat depth must be a non-negative integer
```

Invalid assignment remains strict:

```ts
type Cell = number | string

let values: Cell[][] = [[1, "A"], [2, "B"]]
let bad: number[] = values.flat(1)
// error: Cell[] is not assignable to number[]
```

## Tests

CTest:

```txt
yogi_pipeline_array_flat_depth_semantics
```

The suite covers:

- default depth
- `flat(0)`
- `flat(1)` from `number[][]`
- `flat(1)` from `number[][][]`
- `flat(2)` from `number[][][]`
- depth greater than nesting
- union arrays
- nested union arrays
- non-literal fallback typing
- invalid assignment
- invalid depth type
- negative and fractional literal depths
