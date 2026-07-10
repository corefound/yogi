# Lot 37: Struct Projections Through Pointers

This lot lets `ptr<Struct>` values use normal field projection syntax.

Yogi pointers are explicit in types, not noisy in expressions. Do not require
helper functions or C/C++-style syntax for natural pointer navigation when the
operation is type-safe and visually clear.

## Supported

```ts
function update(box: ptr<Box>): void {
    box.point.x = 999
}
```

The compiler resolves `box.point.x` through the pointee storage:

```txt
box: ptr<Box>
GEP .point
GEP .x
store 999
```

Reads use the same addressable path:

```ts
function readX(box: ptr<Box>): number {
    return box.point.x
}
```

Field pointers can be returned from pointer parameters:

```ts
function getX(box: ptr<Box>): ptr<number> {
    return &box.point.x
}
```

The returned pointer is borrowed from the parameter, so calls preserve the
caller-side provenance and readonly permission.

## Mutability

`const p: ptr<Box>` means the pointer binding cannot be rebound. It does not
make the pointed storage readonly:

```ts
let box: Box = { point: { x: 1, y: 2 } }
const p: ptr<Box> = &box
p.point.x = 100
```

A pointer derived from readonly storage cannot mutate projected fields:

```ts
const box: Box = { point: { x: 1, y: 2 } }
let p: ptr<Box> = &box
p.point.x = 100 // rejected
```

Function summaries also track projected pointer mutation:

```ts
function update(box: ptr<Box>): void {
    box.point.x = 999
}

const box: Box = { point: { x: 1, y: 2 } }
update(&box) // rejected
```

## Tests

The focused pipeline test is:

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_addressable_projections.cmake
```

Coverage includes:

- assignment through `ptr<Struct>`
- sibling and deeper nested field assignment
- read through `ptr<Struct>`
- returning `&box.point.x`
- returning `&box.point`
- pointer rebind followed by projection
- `const ptr` binding behavior
- readonly pointee rejection
- missing field rejection
- RHS type mismatch rejection
- field projection from `ptr<number>` rejection

## Still Pending

- Natural aggregate pointer replacement: `ptr<T> = T`.
- Nested runtime object cell chains: `&user.address.zip`.
- Mixed array/object/struct chains: `&users[0].age`.
- Dynamic array pointer invalidation diagnostics started in Lot 39. Lot 40
  allows pointer-safe `push` and keeps conservative diagnostics for destructive
  operations. Dynamic object structural invalidation remains pending if object
  storage becomes structurally mutable.
- Partial address-of views such as `&matrix[0]`.
