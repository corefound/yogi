# Lot 43: Dynamic Array Assignment Slot Replacement

This lot defines `target = source` for dynamic arrays as an in-place full
replacement of array contents, while preserving slot identity wherever possible.

## Goal

Dynamic array pointers point to slot identities, not permanent numeric indexes.
Assignment must respect that model:

```txt
existing slots are preserved by index when possible
preserved slots get overwritten with new values
new indexes create new slots
removed indexes invalidate their slots
```

## Semantics

For:

```ts
users = newUsers
```

Yogi lowers the operation conceptually as:

```txt
oldLen = users.length
newLen = newUsers.length
commonLen = min(oldLen, newLen)

for i in 0..<commonLen:
    keep users slot i
    overwrite its current value with newUsers[i]

if newLen > oldLen:
    create new slots for the extra values

if newLen < oldLen:
    invalidate the removed old slots
```

This is intentionally not pointer retargeting. A pointer still points to the
same slot identity. If that slot survives, the pointer remains valid and sees the
new value. If the slot is removed, pointer use fails with the existing dynamic
array invalid-pointer diagnostic.

## Same Length

```ts
struct User {
    age: number
}

let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[0].age

users = [{ age: 99 }, { age: 100 }]
age = 50

print(users[0].age) // 50
print(users[1].age) // 100
```

Slot `0` survived, so `age` remains valid.

## Longer Replacement

```ts
let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[0].age

users = [{ age: 99 }, { age: 100 }, { age: 200 }]
age = 50

print(users[0].age) // 50
print(users[2].age) // 200
```

Existing slots survive and extra indexes create new slots.

## Shorter Replacement

```ts
let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[1].age

users = [{ age: 99 }]
age = 50
```

Slot `1` was removed, so the pointer write reports:

```txt
runtime pointer error: pointer is used after the array element it points to was removed
```

## Runtime And Lowering

The LLVM backend now calls:

```txt
yogi_array_replace_from(target, source)
```

when assigning into an already-initialized dynamic array slot. The runtime
performs the slot-preserving replacement using the same invalidation machinery
used by `pop`, `shift`, and `splice`.

Temporary RHS arrays are destroyed after their values are copied into the target
slots. Receiver-returning methods such as `sort()` and `reverse()` are detected
so self-assignment through mutating methods does not destroy the receiver.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/dynamic_array_pointer_validity_tracking.cmake
tests/runtime/sessions/02-variables-aggregates/dynamic_array_storage_analysis.cmake
tests/runtime/sessions/02-variables-aggregates/pointer_invalidation_diagnostics.cmake
```

Positive cases:

```txt
same-length assignment preserves pointer
longer assignment preserves pointer and creates new slots
shorter assignment preserves pointer to surviving slot
nested projected pointer survives if its slot survives
replacement while an interior pointer is live uses pointer-safe storage
```

Negative runtime cases:

```txt
shorter assignment invalidates pointer to removed slot
nested projected pointer fails if its owner slot is removed
```

## Completed

- ✅ dynamic array assignment updates contents in place
- ✅ existing slots are preserved by index
- ✅ preserved slots are overwritten, not invalidated
- ✅ longer assignment creates new slots
- ✅ shorter assignment invalidates removed slots
- ✅ pointers to preserved slots remain valid
- ✅ pointers to removed slots fail when used
- ✅ behavior reuses the dynamic array pointer validity model

## Pending / Future

- ⬜ late runtime migration from contiguous storage to pointer-safe storage, if a
  future feature can create live interior pointers after allocation without a
  prior semantic storage decision
- ⬜ compile-time diagnostics for provably invalidated pointer use after a
  shortening replacement
