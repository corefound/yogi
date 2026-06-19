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
  - `lastIndexOf`
  - `slice`
  - `toReversed`
  - `toSpliced`
  - `with`
- Copy/mutation methods:
  - `fill`
  - `copyWithin`
  - `splice`
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
- String/comparator-dependent methods:
  - `join`
  - `toString`
  - `sort`
  - `toSorted`
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
- `sort` and `join` should wait until string runtime semantics are stronger.
- `sort` and `toSorted` need comparator lowering plus runtime/native sorting
  semantics; they are intentionally not part of the callback loop batch yet.
- `with` now uses runtime range diagnostics. Future range-sensitive APIs should
  reuse the same `yogi runtime range error` path unless Yogi later adds
  catchable exceptions.
