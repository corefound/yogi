# Lot 35: Addressable Projections

This lot completes the next pointer step: nested addressable projections and
real runtime cells for array/object field pointers.

## Goals

```txt
&box.point.x
&matrix[i, j]
&object.field
```

These expressions must not pretend that every `ptr<T>` is a raw LLVM address.
Yogi now has two pointer representations under the same visible `ptr<T>` type:

```txt
raw pointer       -> direct LLVM storage address
runtime cell ptr  -> tagged pointer to a runtime AnyValue* slot
```

The visible type stays simple:

```ts
let p: ptr<number> = &value
```

The backend decides whether `p` is raw or cell-backed.

## Nested Struct Projections

Struct fields lower to real LLVM struct storage. Nested fields are lowered with
recursive GEP:

```ts
struct Point {
    x: number
    y: number
}

struct Box {
    point: Point
}

let box: Box = { point: { x: 1, y: 2 } }
let px: ptr<number> = &box.point.x
px = 10
```

Backend behavior:

```txt
&box.point.x -> raw ptr<number>
write        -> LLVM store through raw pointer
read         -> LLVM load through raw pointer
```

## Runtime Object Cells

Typed objects still use runtime object storage today. `&object.field` therefore
cannot be lowered as a raw field offset. Instead, the runtime exposes the real
property slot:

```ts
type User = {
    age: number
    name: string
}

let user: User = { age: 31, name: "Ada" }
let age: ptr<number> = &user.age
age = 32
print(user.age)
```

Backend behavior:

```txt
&user.age -> yogi_object_cell(user, "age")
ptr tag   -> low-bit tagged runtime cell pointer
read      -> yogi_cell_get(cell), then unbox
write     -> box value, then yogi_cell_set(cell, boxed)
```

The pointer can cross function boundaries because the tag travels with the
pointer value:

```ts
function set(value: ptr<number>): void {
    value = 33
}

set(&user.age)
```

## Runtime Array Cells

Dynamic and fixed-shape arrays expose addressable element cells:

```ts
let values: number[] = [1, 2, 3]
let first: ptr<number> = &values[0]
first = 10
```

Fixed-shape arrays use row-major offsets:

```ts
let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let cell: ptr<number> = &matrix[1, 2]
cell = 60
```

Backend behavior:

```txt
&values[i]    -> yogi_array_cell(values, i)
&matrix[i, j] -> row-major offset, then yogi_array_cell(matrix, offset)
```

## Safety Rules

- Temporaries are still not addressable.
- `&[1, 2, 3]` and `&{ value: 1 }` are still rejected.
- `&constRoot.field` and `&constRoot[index]` are valid, but write-through is rejected.
- Partial fixed-shape borrowed views such as `&matrix[0]` are rejected for now.
- Pointer arithmetic is still rejected.

## Runtime ABI Added

```cpp
extern "C" void* yogi_object_cell(void* object, const char* name);
extern "C" void* yogi_array_cell(void* array, unsigned long long index);
extern "C" void* yogi_cell_get(void* cell);
extern "C" void  yogi_cell_set(void* cell, void* value);
```

The backend never calls `malloc`/`free` for these cells. A cell is a pointer to
an existing runtime slot.

## Tests

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_addressable_projections.cmake
tests/runtime/sessions/02-variables-aggregates/pointer_core.cmake
tests/runtime/sessions/02-variables-aggregates/pointer_array_indexing.cmake
```

Coverage includes:

- nested struct field `&box.point.x`
- object field `&user.age`
- fixed-shape matrix cell `&matrix[1, 2]`
- dynamic array cell `&values[0]`
- function calls receiving cell-backed `ptr<number>`
- readonly rejection for const object/array roots
- rejection for partial fixed-shape borrowed view address-of

Follow-up lot 36 fixed direct nested struct field assignment so
`box.point.x = value` now writes to the same storage addressed by
`&box.point.x`.

Follow-up lot 37 added natural projections through `ptr<Struct>`, so
`pBox.point.x = value` and `return &box.point.x` from a pointer parameter use
the same addressable struct field path.

## Remaining Work

- Nested runtime object cells such as `&user.address.zip` were completed in Lot 38.
- Object cells inside array elements such as `&users[0].age` were completed in Lot 38.
- Cell invalidation diagnostics when a dynamic array/object reallocates after a
  cell pointer was created.
- Optional LLVM alias/readonly metadata for raw struct pointers.
