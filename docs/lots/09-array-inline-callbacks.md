# Lot 09: Array Inline Callback Expressions

## Goal

This lot adds expression-bodied inline arrow callbacks for the first callback
array batch:

```ts
let scores: number[] = [1, 2, 3]
let doubled: number[] = scores.map((value: number): number => value * 2)
```

This is TypeScript syntax, but Yogi keeps stricter semantics:

- callback parameters must be explicitly typed
- callback return type must be explicit
- expression-bodied callbacks are supported
- block-bodied callbacks with sequential statements and explicit `return` are
  supported
- captures of outer locals are rejected for now

## Supported Forms

```ts
(value: T): U => expression
(value: T, index: number): U => expression
(value: T): U => {
    let next: U = expression
    return next
}
```

These work with:

```ts
forEach
map
filter
some
every
find
findIndex
```

Predicate methods still require a `boolean` return type.

## SIR And FlatBuffers

The SIR schema now has `FunctionExpression` as a `ValueRef` field. The
serialized function expression stores:

- internal callback name
- parameters
- explicit return type
- expression-bodied block
- function type
- effect summary

This keeps callback syntax visible in SIR without pretending it is a top-level
function declaration.

## LLVM Lowering

Inline callbacks are lowered inside the generated array loop. The backend
creates temporary parameter slots for `value` and optional `index`, lowers the
implicit return expression, and uses that value as the callback result.

This avoids a full closure implementation for now while still compiling useful
TypeScript-style callback syntax end to end.

## Block Bodies

Block-bodied callbacks can declare local values and return explicitly:

```ts
scores.map((value: number): number => {
    let next: number = value + 1
    return next
})
```

The callback return type remains mandatory. If the callback return type is not
`void`, the body must contain a return value.

## Current Limitations

Callbacks that capture outer locals are rejected:

```ts
let offset: number = 2
scores.map((value: number): number => value + offset)
```

Captures need real closure and lifetime rules before lowering to LLVM.

## Tests

- `yogi_pipeline_array_inline_callbacks` validates inline callback semantic
  analysis, FlatBuffer serialization, LLVM lowering, executable output, and
  diagnostics for unsupported captures and missing block returns.
- Frontend tests validate inline callback acceptance and current limitations.
