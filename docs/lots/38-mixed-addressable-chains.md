# Lot 38: Mixed Addressable Chains

This lot completes mixed addressable pointer chains across runtime object cells,
array cells, and real struct projections.

The goal is that expressions such as these keep a real addressable slot all the
way to the final field:

```ts
let zip: ptr<number> = &user.address.zip
let age: ptr<number> = &users[0].age
```

## Behavior

Nested runtime object paths now resolve each intermediate object from its actual
runtime cell:

```txt
user.address -> yogi_object_cell(user, "address")
             -> yogi_cell_get(...)
             -> yogi_any_to_object(...)

user.address.zip -> yogi_object_cell(addressObject, "zip")
```

Array/object chains use the same rule:

```txt
users[0] -> yogi_array_cell(users, 0)
         -> yogi_cell_get(...)
         -> yogi_any_to_object(...)

users[0].age -> yogi_object_cell(userObject, "age")
```

The visible type remains `ptr<T>`. Internally, runtime cell pointers are tagged
so pointer read-through calls `yogi_cell_get` and pointer write-through calls
`yogi_cell_set`.

## Examples

Nested object:

```ts
type Address = {
    zip: number
}

type User = {
    address: Address
}

let user: User = { address: { zip: 10001 } }
let zip: ptr<number> = &user.address.zip

zip = 10002
print(user.address.zip) // 10002
```

Array element object:

```ts
type User = {
    age: number
}

let users: User[] = [{ age: 31 }, { age: 40 }]
let age: ptr<number> = &users[0].age

age = 32
print(users[0].age) // 32
```

Readonly provenance is preserved:

```ts
type User = {
    age: number
}

const users: User[] = [{ age: 31 }]
let age: ptr<number> = &users[0].age

age = 32 // error: cannot write through pointer
```

## Implementation Notes

- Dynamic property reads use the same runtime-object chain helper as
  address-of lowering, so intermediate object aliases are unboxed before the
  next property lookup.
- Type aliases that resolve to object/array/primitive types now box and unbox
  through the resolved runtime representation instead of falling back to `Any`.
- Direct struct projections still lower to real LLVM field addresses when the
  struct storage is available.
- Runtime object and array cells continue to use the tagged-cell pointer path.

## Tests

Covered in:

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_addressable_projections.cmake
```

Positive coverage:

- `&user.address.zip`
- `&users[0].age` where `users` is a dynamic array of typed objects
- `&users[0].age` where `users` is a dynamic array of structs stored through
  runtime object cells
- pointer read-through reflects the source field
- pointer write-through updates the source field

Negative coverage:

- writing through `&constUser.address.zip`
- writing through `&constUsers[0].age`

## Remaining Work

- Pointer invalidation diagnostics for dynamic arrays were completed in Lot 39.
- Pointer invalidation diagnostics for dynamic object storage remain pending if
  object storage becomes structurally mutable.
- Addressable partial fixed-shape views such as `&matrix[0]`.
- Optional LLVM alias/readonly metadata for raw struct projections.
