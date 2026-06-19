# Lot 08: Array Named Callback Methods

## Goal

This lot starts callback-based array support without introducing closures yet.
The supported callback form is a named function reference:

```ts
function doubleValue(value: number): number {
    return value * 2
}

let scores: number[] = [1, 2, 3]
let doubled: number[] = scores.map(doubleValue)
```

Inline callbacks such as `(value: number): number => value * 2` are covered by
Lot 09.

## Supported Methods

The first callback batch supports:

```ts
forEach(callback)
map(callback)
filter(callback)
some(callback)
every(callback)
find(callback)
findIndex(callback)
```

The callback must accept:

```ts
(value: T): R
(value: T, index: number): R
```

`filter`, `some`, `every`, `find`, and `findIndex` require a boolean-returning
callback. `map` returns an array based on the callback return type. `forEach`
returns `void`.

## Lowering

The LLVM backend lowers these methods directly as loops over the runtime array:

```txt
yogi_array_length
yogi_array_get
yogi_array_create
yogi_array_push
```

Each element is unboxed to the callback parameter type, the callback function is
called directly, and the method either pushes into a result array or performs
short-circuit control flow.

## Examples

```ts
function isLarge(value: number, index: number): boolean {
    return value + index > 3
}

let scores: number[] = [1, 2, 3]
let filtered: number[] = scores.filter(isLarge)
let hasLarge: boolean = scores.some(isLarge)
let firstIndex: number = scores.findIndex(isLarge)
```

## Current Limitations

- Block-bodied inline callbacks are not lowered yet.
- Closures/captured outer locals are not modeled yet.
- `reduce`, `reduceRight`, `findLast`, `findLastIndex`, and `flatMap` remain
  future work.
- `find` returns `T | undefined`; the method lowers and executes, but smooth
  consumption of the returned union still depends on stronger union narrowing
  and cast behavior.

## Tests

- `yogi_pipeline_array_named_callbacks` validates semantic analysis, LLVM IR,
  executable output, and negative diagnostics for inline callbacks and invalid
  predicate return types.
- Frontend tests validate named callback acceptance and inline callback
  rejection.
