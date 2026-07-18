# Lot 77: Native Resource Struct Field Ownership

This lot extends native extern destructor RAII into real Yogi structs.

## Goal

Native resources can now move from a local `ptr<T>` owner into a struct field:

```ts
struct NativeResource {
    id: number
}

struct Holder {
    resource: ptr<NativeResource>
}

extern algorithm from "./libnative_resource.a" {
    create(id: number): ptr<NativeResource>
    destructor(resource: ptr<void>): void
}

function run(): void {
    const resource: ptr<NativeResource> = algorithm.create(1)
    let holder: Holder = { resource: resource }
}
```

`resource` is not destroyed as a normal local after the move. The owning cleanup
moves to `holder.resource`, and the field is destroyed when `holder` leaves
scope.

## Ownership Rule

The destructor identity still comes from the producing extern call, not from the
pointer type.

```txt
ptr<NativeResource> does not mean "call destructor".
algorithm.create(...) means "this returned pointer owns cleanup destructor".
```

When such a pointer is stored in a struct field, Yogi records:

```txt
owner struct variable
field path
native destructor symbol
```

For example:

```txt
holder.resource -> destructor
nested.holder.resource -> destructor
```

## Struct Literal Moves

Inline extern call:

```ts
let holder: Holder = {
    resource: algorithm.create(1)
}
```

The field owns the returned native resource.

Move from local:

```ts
const resource: ptr<NativeResource> = algorithm.create(1)
let holder: Holder = { resource: resource }
```

The local resource cleanup is deactivated, and the struct field becomes the
active owner.

Nested structs are tracked through a field path:

```ts
struct Nested {
    holder: Holder
}

let nested: Nested = {
    holder: {
        resource: algorithm.create(2)
    }
}
```

Cleanup follows `nested.holder.resource`.

## Field Reassignment

```ts
let holder: Holder = { resource: algorithm.create(1) }
holder.resource = algorithm.create(2)
```

Yogi destroys the previous native pointer before the field starts owning the new
one. If the replacement is the same pointer value, the destroy call is skipped.

Assigning a non-owning pointer into a field that used to own a native resource
destroys the previous field value and clears the field cleanup metadata.

## Cleanup

On scope exit, struct cleanup now has two layers:

1. Native resource fields are destroyed with their recorded extern destructor.
2. Normal aggregate fields such as strings, arrays, objects, tuples, and nested
   structs are cleaned through runtime aggregate cleanup.

Pointer fields without native ownership metadata are not destroyed by Yogi.

## Tests

Program test:

```txt
tests/programs/native_resource_struct_fields.cmake
```

It builds a small C static library, compiles a Yogi program, checks LLVM/object
artifacts, links an executable, and verifies runtime output.

Covered scenarios:

- local native resource moved into a struct field
- inline native resource returned directly into a struct field
- field reassignment destroys the old native resource before storing the new one
- nested struct field ownership through `nested.holder.resource`
- nested field reassignment
- no double destruction of the moved local pointer

## Current Limitations

- Returning, copying, assigning, or passing a whole resource-owning struct by
  value is rejected by Lot 78 until explicit move/copy constructor policy
  exists.
- Interface/type adapter copies for resource-owning structs remain pending.
- Native ABI marshalling for arrays of resource-owning structs remains pending.
