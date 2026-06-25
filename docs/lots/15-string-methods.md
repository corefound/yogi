# Lot 15: String Methods

## Goal

This lot completes the first runtime-backed string method batch using
TypeScript-style syntax and Yogi runtime ABI calls.

```ts
let text: string = "  Hello Yogi Runtime  "

print(text.slice(2, 7))
print(text.substring(8, 12))
print(text.trim())
```

## Supported Methods

The following methods now pass through parser, semantic analysis, SIR
FlatBuffer, LLVM lowering, runtime execution, and pipeline tests:

- `slice(start?: number, end?: number): string`
- `substring(start?: number, end?: number): string`
- `includes(search: string, position?: number): boolean`
- `startsWith(search: string, position?: number): boolean`
- `endsWith(search: string, endPosition?: number): boolean`
- `indexOf(search: string, position?: number): number`
- `lastIndexOf(search: string, position?: number): number`
- `toUpperCase(): string`
- `toLowerCase(): string`
- `trim(): string`

## Behavior

String methods follow the same byte-oriented runtime model already used by
`length`, index access, and `for...of` string iteration.

`slice` supports negative indexes relative to the end:

```ts
print("Hello Runtime".slice(-7))
```

`substring` clamps negative values to `0` and swaps indexes when `start > end`,
matching JavaScript behavior:

```ts
print("Hello Yogi".substring(10, 6))
```

Search methods use JavaScript-style defaults:

```ts
print("bananas".indexOf("na"))
print("bananas".lastIndexOf("na"))
print("bananas".endsWith("nas"))
```

Case conversion and trim are ASCII/runtime-byte based for now:

```ts
print("YoGi".toUpperCase())
print("  YoGi  ".trim())
```

## Lowering

Semantic analysis emits builtin methods named `string.<method>`. LLVM lowering
routes those methods to runtime ABI helpers:

- `yogi_string_slice`
- `yogi_string_substring`
- `yogi_string_includes`
- `yogi_string_starts_with`
- `yogi_string_ends_with`
- `yogi_string_index_of`
- `yogi_string_last_index_of`
- `yogi_string_to_upper_case`
- `yogi_string_to_lower_case`
- `yogi_string_trim`

The backend does not call allocation functions directly. New string results are
allocated through the runtime memory manager.

## Tests

`yogi_pipeline_string_methods` covers:

- positive execution for every method above
- LLVM IR symbol checks for every runtime helper
- semantic diagnostics for wrong search argument type
- semantic diagnostics for wrong index argument type
- semantic diagnostics for invalid method arity

## Known Limitations

String indexing and method behavior remain byte-oriented. Full Unicode grapheme
or locale-aware behavior should wait for a dedicated Unicode string runtime
batch.
