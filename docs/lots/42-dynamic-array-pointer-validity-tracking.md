# Lot 42: Dynamic Array Pointer Validity Tracking

This lot extends adaptive dynamic array storage from "keep pointers stable during
growth" to "track whether a pointed element identity still exists."

## Goal

Yogi keeps the JavaScript/TypeScript array method surface:

```ts
pop()
shift()
unshift(value)
splice(start, deleteCount, ...items)
reverse()
sort(compareFn?)
fill(value, start, end)
copyWithin(target, start, end)
```

The compiler should not reject these methods just because a pointer exists.
Instead, dynamic array pointers point to element identities.

```txt
If the element still exists, the pointer remains valid.
If the element was removed, using the pointer is an error.
```

## Slot Identity

Dynamic array pointer-safe storage stores each element in a slot:

```txt
Array logical order:
  [slot A, slot B, slot C]

Pointer:
  points to slot identity, not permanent index
```

`shift()` can move slot B from index `1` to index `0`, but slot B remains the
same element identity.

```ts
struct User {
    age: number
}

let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[1].age

users.shift()
age = 99

print(users[0].age) // 99
```

## Removed Slots

Removing a slot leaves a small tombstone/metadata record. Yogi does not scan all
live pointers. Pointer use goes through local runtime checks:

```txt
slot state: valid | removed
pointer use: check slot before read/write
```

Invalid example:

```ts
let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[0].age

users.shift()
age = 99
```

Runtime error:

```txt
runtime pointer error: pointer is used after the array element it points to was removed
```

## Method Policy

```txt
push      creates a new slot and preserves existing pointers
pop       invalidates only the removed last slot
shift     invalidates only the removed first slot
unshift   creates a new front slot and preserves existing pointers
splice    invalidates only removed slots and creates slots for inserted values
reverse   reorders slots without invalidating pointers
sort      reorders slots without invalidating pointers
fill      overwrites values inside existing slots
copyWithin overwrites values inside existing slots
assignment preserves common slots, creates new slots, and invalidates removed slots
```

Copy-returning methods do not mutate the original array and do not invalidate
original pointers:

```txt
slice
concat
map/filter/flat/flatMap
with
toReversed
toSorted
toSpliced
keys/values/entries
```

## Runtime / LLVM ABI

The backend asks the runtime for a pointer cell:

```txt
yogi_array_pointer_cell(array, index)
```

The runtime returns a tagged pointer:

```txt
raw cell tag       -> contiguous/fixed cell
array slot tag     -> pointer-safe dynamic array slot
projected cell tag -> owner pointer + object field path
```

Pointer reads and writes use:

```txt
yogi_pointer_cell_get(pointer)
yogi_pointer_cell_set(pointer, value)
```

The LLVM backend does not call allocator functions directly for this behavior.

## Field Projections

`&users[0].age` is not lowered as "address of whatever object currently lives at
that moment." It is lowered as a projected cell:

```txt
owner pointer: users[0] slot
field path: .age
```

That matters for overwrites:

```ts
let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[0].age

users.fill({ age: 50 }, 0, 2)
print(age) // 50
```

The pointer re-resolves the field through the current value stored in the same
slot.

## Dynamic Array Assignment

Whole dynamic array assignment now uses the same slot validity model:

```ts
let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[0].age

users = [{ age: 99 }, { age: 100 }]
age = 50
```

Conceptually, assignment runs as an in-place replacement:

```txt
oldLen = users.length
newLen = newUsers.length
commonLen = min(oldLen, newLen)

0..<commonLen      overwrite existing slots
commonLen..<newLen create new slots
newLen..<oldLen    invalidate removed slots
```

Pointers are not retargeted to new expressions. They keep pointing to the same
slot identity. If the slot survives, the pointer remains valid and observes the
new value. If the slot is removed, pointer use fails through the existing
invalidation path. Obvious literal cases now fail during semantic analysis;
dynamic cases remain runtime checked.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/dynamic_array_pointer_validity_tracking.cmake
tests/runtime/sessions/02-variables-aggregates/dynamic_array_storage_analysis.cmake
tests/runtime/sessions/02-variables-aggregates/pointer_invalidation_diagnostics.cmake
```

Positive coverage:

```txt
pop removes another slot; pointer remains valid
pop removes pointed slot; pointer not used afterward
shift removes another slot; pointer remains valid
shift removes pointed slot; pointer not used afterward
unshift preserves existing pointer identity
splice removes non-pointed range; pointer remains valid
splice removes pointed range; pointer not used afterward
reverse preserves pointer identity
sort preserves pointer identity
fill preserves slot identity and pointer observes overwritten value
copyWithin preserves slot identity and pointer observes overwritten value
toSpliced/toReversed/toSorted preserve original pointers
same-length assignment preserves a pointer to a surviving slot
longer assignment preserves existing pointers and creates new slots
shorter assignment preserves pointers to surviving slots
nested projected pointers survive assignment when their slot survives
```

Negative semantic coverage:

```txt
pop removes pointed slot and pointer is used afterward
shift removes pointed slot and pointer is used afterward
splice removes pointed literal slot and pointer is used afterward
copied pointer to removed slot is used afterward
ptr<User> to removed slot uses a field afterward
nested pointer such as &users[0].address.zip is used after removal
shorter assignment removes a pointed slot and the pointer is used afterward
nested projected pointer is used after assignment removed its owner slot
```

Negative runtime coverage:

```txt
dynamic splice/index removes pointed slot and pointer is used afterward
```

## Completed

- ✅ JavaScript-style mutating methods are not rejected just because pointers exist
- ✅ dynamic array pointers track element identity rather than permanent index
- ✅ removed element identities become invalidated
- ✅ pointer use checks validity when needed
- ✅ `pop` invalidates only pointers to removed last slot
- ✅ `shift` invalidates only pointers to removed first slot
- ✅ `splice` invalidates only pointers to removed slots
- ✅ `unshift` preserves existing pointers
- ✅ `reverse` preserves existing pointers
- ✅ `sort` preserves existing pointers, including comparator sort
- ✅ `fill` preserves slot identity and pointer validity
- ✅ `copyWithin` preserves slot identity and pointer validity
- ✅ dynamic array assignment preserves common slot identities
- ✅ dynamic array assignment invalidates pointers to removed slots
- ✅ non-mutating/copy-returning methods do not invalidate original pointers
- ✅ obvious removed-slot pointer uses fail during semantic analysis

## Pending / Future

- ⬜ remove runtime validity checks when compiler proves safety
- ⬜ richer branch-sensitive compile-time diagnostics for provably invalidated pointer use
- ⬜ source notes for pointer creation, element removal, and invalid pointer use
- ⬜ generation-based slot reuse optimization
- ⬜ projected pointer metadata cleanup tied to pointer lifetime
- ⬜ function-return provenance for `ptr<User[]>` dynamic array cells
