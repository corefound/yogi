# Lot 13: Iterator Protocol And Loops

## Goal

This lot connects array iteration to the full compiler pipeline and fixes an
ownership bug exposed by assigning the result of mutating array methods.

```ts
let values: number[] = [3, 1, 20]
let sorted: number[] = values.sort()

print(sorted)
```

Expected output:

```txt
[1, 20, 3]
```

`sort()` mutates and returns the same array. `sorted` must be treated as an
alias of `values`, not as a second owner.

## Added Behavior

`for...of` now works over arrays:

```ts
for (let value: number of values) {
    total = total + value
}
```

It also works with the currently materialized iterator methods:

```ts
for (let key: number of values.keys()) {}
for (let value: number of values.values()) {}
for (let entry: [number, number] of values.entries()) {}
```

`break` and `continue` use the same cleanup machinery as classic loops.

## Semantic Rules

Loop variables must be explicitly typed:

```ts
for (let value: number of values) {}
```

Missing annotations are rejected:

```ts
for (let value of values) {}
```

The element type must match the iterable element type. For example, iterating a
`number[]` with a `string` loop variable is rejected.

## Lowering

The visitor desugars `for...of` into a normal `for` statement with hidden
temporary variables. That lets the existing semantic analyzer, FlatBuffer SIR,
LLVM lowering, cleanup scheduling, `break`, and `continue` paths handle the loop
without adding a parallel IR node yet.

The generated iterable temp lives for the entire loop lifetime. This was
important for array-producing iterator methods such as `values.keys()`, because
the result must not be destroyed before the first condition check.

## Tests

`yogi_pipeline_iterator_protocol` covers:

- direct array `for...of`
- `for...of` over `keys()`
- `for...of` over `entries()`
- `break` and `continue`
- returned aggregate used as iterable
- `let sorted: number[] = values.sort()` alias ownership
- missing loop variable type diagnostics
- wrong loop variable element type diagnostics

