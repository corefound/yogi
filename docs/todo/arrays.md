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
  - `toLocaleString`
  - `lastIndexOf`
  - `slice`
  - `toString`
  - `toReversed`
  - `toSpliced`
  - `toSorted`
  - `with`
  - `flat`
  - `keys`
  - `values`
  - `entries`
- Copy/mutation methods:
  - `fill`
  - `copyWithin`
  - `splice`
  - `sort`
- Comparator overloads:
  - `sort(compareFn)`
  - `toSorted(compareFn)`
- Recursive aggregate printing:
  - arrays containing arrays
  - arrays containing primitive values
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
- Depth-aware semantic result typing for `flat(depth)` beyond the first static
  nesting level.
- String element extraction from `string[]` through `.at()` when the array lives
  inside a struct field. The field type and array length are valid, but direct
  string extraction needs a focused array/string ownership lowering fix.

## Future Work

- Inline callback forms that still need deeper function-expression lowering:
  - closures that capture outer locals
- Lazy iterator objects. `for...of` now works over arrays and array-producing
  iterator methods, but `keys`, `values`, and `entries` still materialize
  arrays because Yogi does not have lazy iterator objects yet.
- Object stringification inside arrays. Primitive and nested array elements are
  stringified; object display should wait for object runtime formatting.

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
- `sort()` and `toSorted()` support JavaScript-style default string ordering and
  comparator callbacks that return `number`.
- `flat(depth)` honors the runtime depth argument. Semantic typing currently
  flattens one known static level, which is correct for the supported tests but
  should become depth-aware once Yogi has stronger compile-time numeric literal
  evaluation.
- `with` now uses runtime range diagnostics. Future range-sensitive APIs should
  reuse the same `yogi runtime range error` path unless Yogi later adds
  catchable exceptions.
