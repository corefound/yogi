# Lot 39: Pointer Invalidation Diagnostics

This lot originally added conservative semantic diagnostics for dynamic arrays.
Lot 40 replaces the conservative `push` rule with pointer-safe dynamic array
growth. Later lots replace many remaining conservative diagnostics with
slot-identity runtime validity:

```txt
Lot 42: mutating/removing/reordering methods preserve or invalidate slots
Lot 43: dynamic array assignment performs in-place slot replacement
```

## Rule

```txt
If a live ptr<T> is rooted in a dynamic array and has an internal access path,
then operations that destroy, remove, reorder, compact, or replace existing
storage are rejected.
```

Historical note: this was the Lot 39 rule. Current dynamic arrays now preserve
slot identity for many of these operations and report runtime pointer errors only
when a removed slot pointer is actually used.

Example:

```ts
struct User {
    age: number
}

let users: User[] = [{ age: 20 }]
let age: ptr<number> = &users[0].age

users.push({ age: 30 }) // error
```

This example was rejected by Lot 39. It is now allowed by Lot 40 because
`push` preserves existing element cells.

Current rejected example:

```ts
users.sort() // error while age is live
```

Diagnostic:

```txt
cannot call 'sort' on 'users' while pointer 'age' points into 'users[0].age'
```

The destructive-operation check is conservative by design. Yogi does not yet
try to prove that a particular index would survive a removal/reorder.

## Structural Mutations

The semantic checker rejects these operations while a live internal pointer
protects the same dynamic array root:

```txt
pop
shift
unshift
splice
sort
reverse
```

It also rejects whole-container replacement:

```ts
users = [{ age: 30 }]
```

## Allowed Operations

Non-structural cell/field mutation remains valid:

```ts
let users: User[] = [{ age: 20 }]
let age: ptr<number> = &users[0].age

users[0].age = 25
print(age) // 25

age = 30
print(users[0].age) // 30
```

Structural mutation is allowed once the pointer scope ends:

```ts
let users: User[] = [{ age: 20 }]

{
    let age: ptr<number> = &users[0].age
    age = 21
}

users.push({ age: 30 }) // allowed
```

Safe growth is also allowed while the pointer is live:

```ts
let users: User[] = [{ age: 20 }]
let age: ptr<number> = &users[0].age

users.push({ age: 30 }) // allowed
age = 99

print(users[0].age) // 99
print(users[1].age) // 30
```

Mutating a different dynamic array is also allowed:

```ts
let age: ptr<number> = &usersA[0].age
usersB.push({ age: 40 }) // allowed
```

## Rebind And Copy

Pointer copies preserve the protected root:

```ts
let age1: ptr<number> = &users[0].age
let age2: ptr<number> = age1

users.push({ age: 30 }) // allowed
users.sort() // error
```

Pointer rebind updates which root is protected:

```ts
let age: ptr<number> = &usersA[0].age
age = &usersB[0].age

usersA.push({ age: 21 }) // allowed
usersB.push({ age: 31 }) // allowed
usersB.sort() // error
```

## Implementation Notes

- `BaseSemantic` keeps a live pointer provenance table keyed by pointer symbol.
- A pointer is tracked only when it points inside a dynamic array root, meaning
  its access path is not empty.
- `exitScope()` removes pointer provenance for the closing lexical scope.
- Pointer declarations, pointer copies, and pointer rebinds update the table.
- Dynamic array destructive/reordering methods and whole-array assignment query
  the table before allowing mutation.
- `push` no longer queries this table because runtime array cells remain stable
  across growth.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_invalidation_diagnostics.cmake
```

Positive coverage:

- non-structural field assignment while pointer is live
- pointer write-through while pointer is live
- `push` while a pointer to an element field is live
- multiple `push` calls while a pointer is live
- pointer to an element itself remaining usable after `push`
- nested element field pointers remaining usable after `push`
- pointer copies and rebinds remaining usable across `push`
- pointer to the array descriptor not blocking `push`
- structural mutation after pointer scope ends
- structural mutation of a different array

Historical negative coverage:

- `pop`, `shift`, `unshift`, `splice`, `reverse`, and `sort`
- whole-array replacement
- pointer copy preserving protection for destructive operations
- readonly roots rejecting `push`

Current runtime validity coverage lives in
`dynamic_array_pointer_validity_tracking.cmake`.

## Remaining Work

- Dynamic object structural invalidation, if Yogi adds mutable object shapes.
- Function returns from `ptr<Array>` parameters into dynamic array cells. This is
  pending because address-of through pointer-derived array access is currently
  rejected.
- Partial fixed-shape view addressability such as `&matrix[0]`.
- Index-sensitive destructive operation checks. Today Yogi rejects destructive
  operations conservatively while any live interior pointer targets that array.
