# String TODO

This file tracks string work by language/runtime batch.

## Supported Now

- String literals and no-substitution template literals.
- Template interpolation through string concatenation when each interpolated
  expression is already a `string`.
- `+` and `+=` for `string + string` only. Yogi does not perform implicit
  `number`/`boolean` to `string` conversion.
- `length`
- Index access: `text[0]`
- String `for...of` iteration by character.
- Methods:
  - `slice`
  - `substring`
  - `includes`
  - `startsWith`
  - `endsWith`
  - `indexOf`
  - `lastIndexOf`
  - `toUpperCase`
  - `toLowerCase`
  - `trim`
  - `charAt`
  - `charCodeAt`
  - `concat`
  - `repeat`
  - `padStart`
  - `padEnd`
  - `trimStart`
  - `trimEnd`
- Runtime-created string cleanup for assigned local variables and module-level
  bindings through `yogi_string_destroy`.
- String equality compares contents through `yogi_string_equals`.

## Future Work

- More precise temporary cleanup for complex control-flow string expressions,
  callback-local string temporaries, and future closure/capture scenarios.
- Additional TypeScript string methods:
  - `codePointAt`
  - `endsWith` is supported; add `match`/`matchAll` later when regular
    expressions exist.
  - `normalize`
  - `replace`
  - `replaceAll`
  - `search`
  - `split`
  - `toString`
  - `valueOf`
- Unicode-aware behavior. The current runtime is byte-oriented, matching the
  existing `length`, index access, and string iteration implementation.
- Explicit cast/string-conversion syntax for non-string interpolation. This
  should be added intentionally instead of through implicit `+` conversion.
- String lifetime cleanup policy for runtime-created temporary strings. Current
  string method results are runtime allocations and should be revisited with the
  next string/resource ownership batch.
