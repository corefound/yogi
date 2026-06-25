# String TODO

This file tracks string work by language/runtime batch.

## Supported Now

- String literals and no-substitution template literals.
- Template interpolation through string concatenation.
- `+` and `+=` when one side is `string` and the other side is `string`,
  `number`, or `boolean`.
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
- Runtime-created string cleanup for assigned local variables and module-level
  bindings through `yogi_string_destroy`.

## Future Work

- Expression temporary cleanup for runtime strings that are never assigned to a
  variable, for example direct `print(("a" + 1).trim())` chains.
- Cleanup for intermediate conversion strings produced during concatenation and
  template interpolation, such as the temporary `number -> string` conversion in
  `"score=" + 10`.
- Additional TypeScript string methods:
  - `charAt`
  - `charCodeAt`
  - `codePointAt`
  - `concat`
  - `endsWith` is supported; add `match`/`matchAll` later when regular
    expressions exist.
  - `normalize`
  - `padStart`
  - `padEnd`
  - `repeat`
  - `replace`
  - `replaceAll`
  - `search`
  - `split`
  - `toString`
  - `trimStart`
  - `trimEnd`
  - `valueOf`
- Unicode-aware behavior. The current runtime is byte-oriented, matching the
  existing `length`, index access, and string iteration implementation.
- String lifetime cleanup policy for runtime-created temporary strings. Current
  string method results are runtime allocations and should be revisited with the
  next string/resource ownership batch.
