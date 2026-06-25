# Lot 14: String Operators And Template Literals

## Goal

This lot adds TypeScript-style string composition to the full pipeline and fixes
array method chains where a mutating method is called on a temporary array.

```ts
let values: number[] = [3, 1, 20]
let sorted: number[] = values.sort().concat(values).sort()

print(sorted)
```

`concat` returns a new mutable array. Calling `sort()` on that returned value is
valid because the receiver is a temporary array, not an immutable binding.

## Added Behavior

String concatenation works only when both sides are strings. Yogi keeps
TypeScript-like syntax here, but it does not inherit JavaScript's implicit
primitive-to-string coercion:

```ts
let label: string = "score="
let score: string = "10"
let ok: string = "true"
let text: string = label + score
text += ", ok=" + ok
text += ", lang=" + "yogi"
print(text)
```

Expected output:

```txt
score=10, ok=true, lang=yogi
```

Template literals are lowered through the same string concatenation path:

```ts
let name: string = "yogi"
let score: string = "10"
let ok: string = "true"

print(`name=${name}, score=${score}, ok=${ok}`)
```

Expected output:

```txt
name=yogi, score=10, ok=true
```

No-substitution template literals are treated as normal string literals:

```ts
print(`plain`)
```

## Semantic Rules

`+` produces `number` only when both operands are numbers.

`+` produces `string` only when both operands are strings.

Mixed string/number or string/boolean operations are rejected:

```ts
let bad: string = "score=" + 10
```

Other arithmetic operators still require numbers:

```ts
let bad: string = "x" - "y"
```

This is rejected during semantic analysis.

## Lowering

Template expressions are desugared by the visitor into nested binary `+`
expressions. The semantic analyzer then types those expressions as strings.

LLVM lowering calls runtime helpers:

- `yogi_string_concat(left, right)`

The backend continues to call through the Yogi runtime ABI instead of emitting
direct allocator calls.

## Tests

`yogi_pipeline_string_operators` covers:

- `values.sort().concat(values).sort()`
- string + string
- `+=` with strings
- template interpolation with string values
- no-substitution template literals
- semantic rejection for invalid string arithmetic
- semantic rejection for implicit string + number/string + boolean coercion
