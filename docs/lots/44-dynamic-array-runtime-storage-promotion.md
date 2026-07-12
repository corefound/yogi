# Lot 44: Dynamic Array Runtime Storage Promotion

This lot closes the gap between semantic storage decisions and arrays that cross
function boundaries before an interior pointer is created.

## Goal

Dynamic arrays should start cheap, then become pointer-safe only when a stable
interior pointer cell is actually needed.

```txt
initial allocation: contiguous_fast_path when possible
address-of cell: promote concrete descriptor to pointer_safe_chunked_mode
future mutation: preserve or invalidate slots through the normal slot model
```

## Why This Matters

Semantic analysis can mark a local array literal as pointer-safe when it sees:

```txt
live interior pointer + identity-sensitive array operation
```

But this does not cover every runtime path. A caller can allocate an array as
contiguous and pass it into a function:

```ts
struct User {
    age: number
}

function bump(users: User[]): void {
    let age: ptr<number> = &users[0].age
    users.push({ age: 30 })
    age = 99
}

let users: User[] = [{ age: 20 }]
bump(users)
```

The caller's literal can remain `contiguous_fast_path` in IR. Inside `bump`,
`yogi_array_pointer_cell(users, 0)` now promotes the concrete runtime descriptor
before returning the pointer. After that, `push` can reallocate the pointer table
without moving slot `0`.

## Runtime Rule

`yogi_array_pointer_cell(array, index)` now guarantees:

```txt
if array is a view:
    delegate to the source array and adjusted source index

if array uses contiguous storage:
    allocate one ElementSlot per live element
    copy current values into those slots
    clear unused capacity slots
    free the contiguous value buffer
    switch storageMode to pointer_safe_chunked_mode

return a tagged array-cell pointer
```

No user-facing type changes. No GC. No global pointer scanning.

## Views

Views/slices do not own their own storage. A pointer to a view element delegates
to the source array:

```txt
&view[0] -> source.pointerCell(viewOffset)
```

That preserves provenance and ensures invalidation checks happen against the real
owner slot.

## Tests

Covered by:

```txt
tests/runtime/unit/runtime_array_storage_test.cpp
tests/runtime/sessions/02-variables-aggregates/dynamic_array_storage_analysis.cmake
tests/runtime/sessions/02-variables-aggregates/dynamic_array_pointer_validity_tracking.cmake
```

Positive coverage:

```txt
runtime storage mode changes from contiguous_fast_path to pointer_safe_chunked_mode
pointer obtained from contiguous array survives push after promotion
pointer obtained through a view promotes the source array
array parameter created contiguous in caller is promoted inside callee before push
```

Negative runtime coverage:

```txt
array parameter created contiguous in caller is promoted inside callee
shorter assignment in callee invalidates pointer to removed slot
```

## Completed

- ✅ contiguous arrays can be promoted after allocation
- ✅ `yogi_array_pointer_cell` always returns an array-cell pointer for arrays
- ✅ views delegate pointer cells to their source array
- ✅ parameter/callee scenarios no longer depend on caller-side storage decisions
- ✅ no new user-facing array type or method

## Follow-Up

- ✅ compile-time diagnostics for provably invalidated dynamic-array pointer use
- ⬜ generation-based slot reuse optimization
