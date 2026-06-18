# Array TODO

This file tracks array work that is intentionally not complete yet. Keep this
updated at the end of each array-related lot so future work can start from the
known state instead of rediscovering gaps from the source code.

## Supported Now

- Array literals and explicit `T[]` declarations.
- Tuple literals and explicit tuple declarations.
- Index access: `scores[0]`.
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
  - `some`
  - `every`

## In Progress / Next Lots

- Inline callback/function-expression support for callback-based array methods.

## Future Work

- Callback/function-value methods that still need more semantic machinery:
  - `reduce`
  - `reduceRight`
  - `findLast`
  - `findLastIndex`
  - `flatMap`
- Inline callback forms:
  - `(value: T): U => ...`
  - `(value: T, index: number): U => ...`
  - block-bodied inline callbacks
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

## Notes

- Callback methods should wait until function values or callable references are
  represented in semantic analysis and LLVM lowering. Named function references
  are now supported for the first callback batch; inline callbacks still need a
  real `FunctionExpression` SIR/lowering model.
- `find` returns `T | undefined`. The method is lowered and executable, but
  ergonomic consumption of the returned union still depends on stronger
  union-narrowing/cast behavior.
- `sort` and `join` should wait until string runtime semantics are stronger.
- `with` now uses runtime range diagnostics. Future range-sensitive APIs should
  reuse the same `yogi runtime range error` path unless Yogi later adds
  catchable exceptions.
