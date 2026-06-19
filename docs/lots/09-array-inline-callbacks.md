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
- only expression-bodied callbacks are supported in this lot
- captures of outer locals are rejected for now

## Supported Forms

```ts
(value: T): U => expression
(value: T, index: number): U => expression
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

## Current Limitations

Block-bodied callbacks are rejected:

```ts
scores.map((value: number): number => {
    return value + 1
})
```

Callbacks that capture outer locals are also rejected:

```ts
let offset: number = 2
scores.map((value: number): number => value + offset)
```

Both features need real closure and lifetime rules before lowering to LLVM.

## Tests

- `yogi_pipeline_array_inline_callbacks` validates inline callback semantic
  analysis, FlatBuffer serialization, LLVM lowering, executable output, and
  diagnostics for unsupported captures/block bodies.
- Frontend tests validate inline callback acceptance and current limitations.
