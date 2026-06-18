# Lot 05: Non-Callback Array Methods

## Goal

This lot extends arrays beyond `push`, `pop`, `at`, and `length` while staying
inside features that do not require callback function values.

Supported in this lot:

```ts
shift()
unshift(...values)
includes(value, fromIndex?)
indexOf(value, fromIndex?)
lastIndexOf(value, fromIndex?)
reverse()
slice(start?, end?)
```

Also included: numeric unary `+` and `-` for expressions such as `arr.at(-1)`
and `arr.slice(0, -1)`.

## Semantics

Mutating methods require a mutable dynamic array:

```ts
let scores: number[] = [2, 3]
scores.unshift(0, 1)
scores.reverse()
scores.shift()
```

Readonly arrays and tuples reject mutating calls:

```ts
let scores: readonly number[] = [1, 2]
scores.reverse() // error

let pair: [number, string] = [1, "ready"]
pair.unshift(0) // error
```

Search methods validate the search value against the array element type:

```ts
let scores: number[] = [10, 20, 30]
let ok: boolean = scores.includes(20)
let bad: boolean = scores.includes("20") // error
```

`slice` returns a new owned dynamic array. It does not move ownership from the
source array:

```ts
let scores: number[] = [1, 2, 3, 4]
let middle: number[] = scores.slice(1, -1)
```

## Runtime ABI

The LLVM backend lowers the methods through the Yogi runtime ABI:

```txt
yogi_array_shift
yogi_array_unshift
yogi_array_includes
yogi_array_index_of
yogi_array_last_index_of
yogi_array_reverse
yogi_array_slice
yogi_array_at_index
```

The backend still never calls allocator functions directly. `slice` creates a
new array through runtime allocation, so ownership and cleanup continue to flow
through the existing aggregate owner tracking.

## JavaScript Compatibility Notes

- `at(-1)` reads from the end of the array.
- `slice` accepts negative `start` and `end` values.
- `includes` uses SameValueZero-style comparison, so `NaN` can match `NaN`.
- `indexOf` and `lastIndexOf` use strict equality-style comparison.
- `unshift(a, b)` preserves JavaScript order and produces `[a, b, ...old]`.

## Tests

- `yogi_runtime_cast_test` validates runtime behavior directly.
- `yogi_pipeline_array_methods` validates semantic analysis, SIR generation,
  LLVM lowering, object generation, final executable output, and negative
  diagnostics for readonly arrays, wrong search value types, and tuple mutation.

## Remaining Array Work

The array surface is not fully complete yet. Remaining methods depend on other
language features:

- Callback/function-value methods: `map`, `filter`, `reduce`, `find`, `some`,
  `every`, `forEach`, `flatMap`.
- Comparator-dependent methods: `sort`, `toSorted`.
- String-dependent methods: `join`, `toString`.
- Range-error-sensitive copy method: `with`.
- Comparator/string-dependent methods: `sort`, `toSorted`, `join`, `toString`.
- Callback/function-value methods listed above.
