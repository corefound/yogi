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

String concatenation now works when one side is a string and the other side is a
string, number, or boolean:

```ts
let label: string = "score=" + 10
let text: string = label + ", ok=" + true
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
let score: number = 10
let ok: boolean = true

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

`+` produces `string` when either operand is a string and the other operand is a
string, number, or boolean.

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
- `yogi_string_from_number(value)`
- `yogi_string_from_boolean(value)`

The backend continues to call through the Yogi runtime ABI instead of emitting
direct allocator calls.

## Tests

`yogi_pipeline_string_operators` covers:

- `values.sort().concat(values).sort()`
- string + number
- string + boolean
- `+=` with strings
- template interpolation with string, number, and boolean values
- no-substitution template literals
- semantic rejection for invalid string arithmetic
