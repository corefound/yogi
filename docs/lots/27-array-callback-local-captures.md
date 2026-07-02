# Lot 27 - Array Callback Local Captures

This lot adds lexical local captures for inline callbacks that are passed directly to array methods.

## Goal

Inline callbacks can now read surrounding locals:

```ts
let values: number[] = [1, 2, 3]
let offset: number = 10

let result: number[] = values.map((value: number): number => {
    return value + offset
})
```

Expected result:

```txt
[11, 12, 13]
```

## Scope

This is intentionally not general first-class closure support.

Supported:

- Inline callback passed directly to an array method.
- Read captures from surrounding lexical scopes.
- Mutable writes to captured mutable locals.
- Captured strings, arrays, fixed-shape arrays, and borrowed views.
- Shadowing by callback parameters and callback-local declarations.

Still future work:

- `let fn = (...) => ...`
- returning callbacks from functions
- storing callbacks in objects
- passing inline callbacks to unknown/non-array APIs
- heap closure objects
- lifetime extension for escaping captures

## Lowering Model

The callback is lowered immediately inside the array method loop.

```txt
outer function locals remain in context.locals
callback parameters are temporarily added on top
callback-local declarations shadow outer names
after the callback body lowers, the old locals map is restored
```

Because the callback does not escape, captured locals are referenced directly from the surrounding function storage. This means the callback observes the current value at execution time:

```ts
let offset: number = 10
offset = 20

values.map((value: number): number => value + offset)
// uses 20
```

## Mutation

Mutable capture writes are supported for ordinary mutable locals:

```ts
let total: number = 0

values.forEach((value: number): void => {
    total = total + value
})
```

Readonly and borrowed-view rules are preserved:

```ts
const matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

indices.forEach((index: number): void => {
    row[index] = 99
})
// error: cannot mutate borrowed view because it borrows from readonly source
```

## Methods Covered

The runtime pipeline test covers captures for:

- `map`
- `filter`
- `find`
- `findIndex`
- `findLastIndex`
- `some`
- `every`
- `reduce`
- `reduceRight`
- `forEach`
- `flatMap`

## Fix Included

The callback validation path now preserves non-callback arguments for callback methods. This fixes `reduce(callback, initialValue)` and `reduceRight(callback, initialValue)` so the initial value reaches SIR and LLVM lowering.

## Tests

CTest:

```txt
yogi_pipeline_array_callback_captures
```

The suite verifies:

- expression-bodied captures
- block-bodied captures
- multiple captures
- shadowing
- updated captured values
- mutable captured writes
- string captures
- captured dynamic array indexing
- captured fixed-shape indexing
- captured borrowed view indexing
- readonly borrowed view mutation rejection
- invalid captured type diagnostics

Frontend Jest:

```txt
accepts inline callback captures
```
