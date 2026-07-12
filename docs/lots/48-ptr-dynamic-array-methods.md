# Lot 48: Mutating Dynamic Array Methods Through ptr<T[]>

This lot allows JavaScript-style dynamic array methods to operate through a
pointer to an array descriptor.

```ts
function dropFirst(users: ptr<User[]>): void {
    users.shift()
}

let users: User[] = [{ age: 20 }, { age: 30 }]
dropFirst(&users)
```

Unlike a normal `User[]` parameter, `ptr<User[]>` mutates the caller's array
storage.

## Supported Behavior

The semantic receiver for `ptr<T[]>` is checked as `T[]`, while mutability comes
from pointer provenance:

```ts
let values: number[] = [3, 1, 2]
const p: ptr<number[]> = &values

p.push(4) // OK: const pointer binding, mutable pointee
```

This remains rejected:

```ts
const values: number[] = [1, 2]
let p: ptr<number[]> = &values

p.push(3) // error: pointer is derived from const storage
```

The LLVM lowerer now recognizes pointer receivers for array methods. If the
receiver is `ptr<T[]>`, it loads/forwards the array descriptor through the
existing pointer-array descriptor path before calling `yogi_array_*`.

## Invalidation Across Calls

Function summaries from Lot 47 now work end-to-end for pointer array parameters:

```ts
function dropFirst(users: ptr<User[]>): void {
    users.shift()
}

let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[0].age

dropFirst(&users)
age = 99 // semantic error
```

The function summary records `shift`, the call site maps it back to the caller
root `users`, and the live pointer to slot `0` is invalidated.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/dynamic_array_pointer_validity_tracking.cmake
```

Added coverage:

```txt
ptr_array_methods_mutate_caller_storage
ptr_array_binding_shift_mutates_caller_and_preserves_surviving_pointer
ptr_array_parameter_shift_mutates_caller_and_preserves_surviving_pointer
const_pointer_binding_can_mutate_mutable_array
ptr_array_parameter_shift_invalidates_removed_caller_pointer
readonly_array_pointer_method_rejected
```

## Completed

- ✅ `ptr<T[]>` receivers validate as dynamic arrays
- ✅ mutating array methods lower through the pointer array descriptor path
- ✅ const pointer bindings can mutate mutable pointee storage
- ✅ pointers derived from const array storage reject mutating methods
- ✅ function-summary invalidation works from `ptr<T[]>` callees to callers

## Pending / Future

- ⬜ serialize invalidation summaries into FlatBuffers if cross-module semantic
  imports need them
- ⬜ dynamic/non-literal invalidation summaries that defer to runtime checks
- ⬜ dynamic shaped array pointer receivers: `ptr<Array<T, Rank>>`
