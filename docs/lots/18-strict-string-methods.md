# Lot 18: Strict String Method Batch

## Goal

This lot adds another TypeScript-shaped string method batch while preserving
Yogi's strict semantic model. The syntax is familiar, but the compiler does not
perform JavaScript-style implicit coercion.

```ts
print("yogi".charAt(1))
print("AZ".charCodeAt(1))
print("ha".repeat(3))
print("7".padStart(3, "0"))
print("7".padEnd(3, "0"))
print("yo".concat("g", "i"))
print("  yogi  ".trimStart())
print("  yogi  ".trimEnd())
```

## Supported Methods

- `charAt(index?: number): string`
- `charCodeAt(index?: number): number`
- `repeat(count: number): string`
- `padStart(targetLength: number, padString?: string): string`
- `padEnd(targetLength: number, padString?: string): string`
- `concat(...values: string[]): string`
- `trimStart(): string`
- `trimEnd(): string`

## Strict Rules

Arguments must already have the expected type:

```ts
"x".concat("y")  // ok
"x".concat(1)    // error

"7".padStart(3, "0")  // ok
"7".padStart("3")     // error
```

Template literals and `+` concatenation remain strict too. Interpolated
expressions must be strings until Yogi gets an explicit cast/string conversion
syntax:

```ts
let score: number = 10
print(`score=${score}`) // error
```

## Runtime And Lowering

The frontend emits builtin string method calls in the semantic IR. LLVM lowering
calls the Yogi runtime ABI:

- `yogi_string_char_at`
- `yogi_string_char_code_at`
- `yogi_string_repeat`
- `yogi_string_pad_start`
- `yogi_string_pad_end`
- `yogi_string_concat`
- `yogi_string_trim_start`
- `yogi_string_trim_end`

The runtime implementations are byte-oriented, matching the current behavior of
`length`, index access, and string iteration. Unicode-aware behavior remains
future work.

## Tests

`yogi_pipeline_string_extended_methods` covers:

- Runtime execution for each added method.
- LLVM IR symbol checks for each runtime ABI helper.
- Negative semantic diagnostics for invalid `concat`, `padStart`, `repeat`, and
  `charAt` arguments.
