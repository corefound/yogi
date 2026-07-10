# Lot 34: Pointer Read/Write-Through And Struct Field Addressability

This lot replaces public `*p` dereference syntax with Yogi's direct pointer
read/write-through model.

## Public Syntax

```ts
let age: number = 31
let p: ptr<number> = &age

print(p)          // reads through ptr<number>
let copy: number = p
p = 32            // writes through the pointee

let q: ptr<number> = p
p = &age          // rebinds when p is a mutable pointer binding
```

Rules:

- `ptr<T>` remains distinct from `T`.
- Scalar `ptr<T>` can read through when the expected type is scalar `T`.
- Scalar `p = value` writes through to the pointee.
- `p = &other` rebinds the pointer when the pointer binding is mutable.
- `const p: ptr<T>` cannot be rebound, but can write through if the pointee
  provenance is mutable.
- Pointers derived from `const` storage are readonly for write-through.
- Public `*p` and `(*p) = value` are rejected.

## Aggregates

Aggregate pointers do not silently become owned aggregate values.

```ts
let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let p: ptr<number[2, 3]> = &matrix

p[1, 2] = 99      // ok
p = [[7, 8, 9], [10, 11, 12]] // rejected
```

This avoids hidden deep copies, accidental owner transfers, and unclear cleanup
responsibility.

## Addressable Projections

Direct real struct fields can now be addressed:

```ts
struct Point {
    x: number
    y: number
}

let point: Point = { x: 1, y: 2 }
let px: ptr<number> = &point.x

px = 10
print(point.x)
```

Semantic metadata preserves:

```txt
root symbol: point
access path: .x
permission: mutable | readonly
```

LLVM lowering uses the real struct field index:

```txt
&point.x -> CreateStructGEP(Point, pointStorage, fieldIndexOfX)
```

Runtime object/dictionary properties are still rejected because they are stored
through runtime object APIs, not as stable native field slots:

```ts
type Box = { value: number }
let box: Box = { value: 1 }
let p: ptr<number> = &box.value // rejected for now
```

Array element addressability is also rejected while arrays use runtime
descriptors:

```ts
let matrix: number[2, 2] = [[1, 2], [3, 4]]
let p: ptr<number> = &matrix[0, 1] // supported in Lot 35
```

Pointer indexing remains the supported mutation path:

```ts
let p: ptr<number[2, 2]> = &matrix
p[0, 1] = 9
```

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_core.cmake
tests/runtime/sessions/02-variables-aggregates/pointer_array_indexing.cmake
tests/runtime/sessions/02-variables-aggregates/pointer_addressable_projections.cmake
```

Positive coverage includes scalar read-through, scalar write-through, pointer
copy, pointer rebind, scalar pointer call/return read-through, `const ptr<T>`
write-through to mutable roots, and `&struct.field` lowering.

Negative coverage includes public `*p`, public `(*p) = value`, write-through to
readonly provenance, aggregate replacement through pointers, and partial
fixed-shape view address-of.

## Remaining Work

- Nested runtime object field cells such as `&user.address.zip`.
- Object cells inside array elements such as `&users[0].age`.
- Cell invalidation diagnostics when a dynamic array/object reallocates after a
  cell pointer was created.
- Optional LLVM alias/readonly metadata once provenance summaries are mature.
