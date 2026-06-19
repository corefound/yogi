# Array TODO

This file tracks array work that is intentionally not complete yet. Keep this
updated at the end of each array-related lot so future work can start from the
known state instead of rediscovering gaps from the source code.

## Supported Now

- Array literals and explicit `T[]` declarations.
- Tuple literals and explicit tuple declarations.
- Index access: `scores[0]`.
- Array element return unboxing for primitive contexts:
  - `scores.at(0)`
  - `scores.pop()`
  - `scores.shift()`
  - `scores.find(callback)`
- Readonly `length` on arrays and tuples.
- Mutating methods:
  - `push`
  - `pop`
  - `shift`
  - `unshift`
  - `reverse`
- Non-mutating methods:
  - `at`
  - `concat`
  - `includes`
  - `indexOf`
  - `join`
  - `lastIndexOf`
  - `slice`
  - `toString`
  - `toReversed`
  - `toSpliced`
  - `toSorted`
  - `with`
- Copy/mutation methods:
  - `fill`
  - `copyWithin`
  - `splice`
  - `sort`
- Callback methods with named function references:
  - `forEach`
  - `map`
  - `filter`
  - `find`
  - `findIndex`
  - `findLast`
  - `findLastIndex`
  - `some`
  - `every`
  - `reduce`
  - `reduceRight`
  - `flatMap`
- Callback methods with expression-bodied inline arrows:
  - `(value: T): U => expression`
  - `(value: T, index: number): U => expression`
- Callback methods with block-bodied inline arrows:
  - `(value: T): U => { let next: U = expression; return next }`
  - sequential local declarations, assignments, calls, and explicit return

## In Progress / Next Lots

- Local capture/closure semantics for inline callbacks.

## Future Work

- Inline callback forms that still need deeper function-expression lowering:
  - closures that capture outer locals
- Iterator-related methods:
  - `entries`
  - `keys`
  - `values`
- Comparator overloads:
  - `sort(compareFn)`
  - `toSorted(compareFn)`
- Structural methods that need deeper array/object semantics:
  - `flat`
- Recursive aggregate printing:
  - arrays containing arrays
  - arrays containing objects

## Notes

- Callback methods should wait until function values or callable references are
  represented in semantic analysis and LLVM lowering. Named function references
  and expression-bodied inline arrows are now supported for the first callback
  batch.
- Inline callbacks currently lower inside the array loop. Captures should wait
  until Yogi has closure/lifetime rules for captured locals.
- `find`, `at`, `pop`, and `shift` return `T | undefined`. They can now unbox
  into primitive contexts that explicitly expect `T`, and they can remain boxed
  when a variable explicitly stores the union.
- `sort()` and `toSorted()` currently use the JavaScript-style default string
  ordering for primitive array elements. Comparator callbacks are still pending.
- `with` now uses runtime range diagnostics. Future range-sensitive APIs should
  reuse the same `yogi runtime range error` path unless Yogi later adds
  catchable exceptions.
