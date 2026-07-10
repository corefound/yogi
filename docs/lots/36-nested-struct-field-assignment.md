# Lot 36: Nested Struct Field Assignment

This lot fixes direct nested struct field assignment so it writes to the same
real storage used by address-of projections.

## Problem

This already worked:

```ts
let px: ptr<number> = &box.point.x
px = 10
```

But this wrote through a value-copy path instead of the nested storage slot:

```ts
box.point.x = 100
```

That was incorrect. In Yogi, assignment to a nested field is addressable
storage mutation.

## Rule

```txt
box.point.x = value
```

means:

```txt
resolve address of box.point.x
store value into that address
```

It must never mean:

```txt
load box.point as a copy
modify copy.x
discard copy
```

## Behavior

```ts
struct Point {
    x: number
    y: number
}

struct Box {
    point: Point
}

let box: Box = { point: { x: 1, y: 2 } }
box.point.x = 100
print(box)
```

Expected:

```txt
{
  point: {
    x: 100,
    y: 2
  }
}
```

Pointer write-through and direct assignment now agree:

```ts
let px: ptr<number> = &box.point.x
box.point.x = 100
px = 10
```

Both writes mutate the same nested field.

## Lowering

Native structs use the same addressable path as `&box.point.x`:

```txt
root slot -> GEP point -> GEP x -> store
```

The backend no longer reconstructs the parent struct from a copied intermediate
when the assignment target is nested.

## Safety

- A readonly root still rejects nested mutation.
- RHS assignability is checked against the final field type.
- Deeper nested fields such as `box.point.x.value = 100` are supported.
- Runtime object-cell chains such as `user.address.zip = value` are still a
  separate future lot.

## Philosophy

Yogi should avoid unnecessary helper functions for core language behavior.

If an operation is visually clear, type-safe, and has a natural interpretation
in the language, Yogi should allow it directly.

Helper functions are for algorithms, conversions, bulk operations, unsafe
operations, or special runtime behavior. They should not be required for
ordinary assignment, pointer write-through, or basic aggregate replacement.

## Tests

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_addressable_projections.cmake
```

Coverage includes:

- direct nested assignment: `box.point.x = 100`
- sibling assignment: `box.point.y = 200`
- multiple nested assignments
- deeper nested assignment: `box.point.x.value = 100`
- agreement with `&box.point.x` pointer write-through
- readonly root rejection
- RHS type mismatch rejection
