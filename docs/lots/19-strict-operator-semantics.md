# Lot 19: Strict Operator Semantics

## Goal

This lot formalizes Yogi's strict primitive operator behavior. Yogi keeps
TypeScript-like syntax, but operators do not use JavaScript coercion.

```ts
1 == 1       // ok
"a" == "a"   // ok
"a" == 1     // error
```

## Equality Rules

`==`, `!=`, `===`, and `!==` require comparable operand types.

Supported primitive comparisons:

```ts
1 == 1
"a" == "a"
true == false
```

Rejected mixed comparisons:

```ts
"a" == 1
1 == true
"a" !== false
```

For now, Yogi treats `==` and `===` with the same strict typing rule. There is
no loose equality/coercion path.

## Relational And Logical Rules

Relational operators are numeric-only:

```ts
2 > 1      // ok
"a" < 1    // error
```

Logical operators are boolean-only:

```ts
true && false  // ok
true && 1      // error
```

Control-flow conditions must be boolean:

```ts
if (true) {}
if (1) {}     // error
```

## String Equality Lowering

String equality now compares string contents through the runtime ABI instead of
comparing pointer addresses:

```ts
let left: string = "yo".concat("gi")
let right: string = "yo".concat("gi")

if (left == right) {
    print("same")
}
```

LLVM lowering calls:

- `yogi_string_equals(left, right)`

This keeps runtime-created strings and literals consistent.

## Tests

`yogi_pipeline_strict_operators` covers:

- number equality
- string literal equality
- boolean equality
- runtime-created string content equality
- runtime-created string inequality
- numeric relational operators
- semantic rejection for mixed equality
- semantic rejection for mixed relational/logical operators
- semantic rejection for non-boolean `if` conditions
