# Lot 41: Dynamic Array Storage Analysis

This lot makes dynamic `T[]` storage adaptive without changing the user-facing
type system.

## Goal

```txt
T[] stays the syntax.
The compiler chooses the internal storage mode.
```

Modes:

```txt
contiguous_fast_path
pointer_safe_chunked_mode
```

## Rule

Pointer existence alone does not make a dynamic array pointer-safe. The array
switches to pointer-safe storage only when semantic analysis sees:

```txt
live interior pointer + identity-sensitive dynamic array method on the same root
```

Current runtime note: Lot 44 added lazy runtime promotion. Even when semantic
analysis leaves a literal as `contiguous_fast_path`, a later
`yogi_array_pointer_cell` request promotes that concrete array descriptor to
`pointer_safe_chunked_mode` before returning the pointer cell.

Example that remains contiguous:

```ts
let users: User[] = [{ age: 20 }]
let age: ptr<number> = &users[0].age

age = 99
```

Example that uses pointer-safe storage:

```ts
let users: User[] = [{ age: 20 }]
let age: ptr<number> = &users[0].age

users.push({ age: 30 })
age = 99
```

Descriptor pointers do not count as interior pointers:

```ts
let users: User[] = [{ age: 20 }]
let descriptor: ptr<User[]> = &users

users.push({ age: 30 }) // still contiguous
```

Pointer rebind updates the protected root:

```ts
let usersA: User[] = [{ age: 20 }]
let usersB: User[] = [{ age: 30 }]
let age: ptr<number> = &usersA[0].age

age = &usersB[0].age

usersA.push({ age: 21 }) // contiguous
usersB.push({ age: 31 }) // pointer-safe
```

## Compiler Pipeline

Semantic analysis tracks live pointer provenance:

```txt
pointer name
root symbol
root name
access path
scope id
```

When validating methods such as `push`, `pop`, `shift`, `unshift`, `splice`,
`sort`, or `reverse`, the compiler checks whether a live pointer points into the
same dynamic array. If yes, the root array symbol receives:

```txt
dynamicArrayStorageMode = pointer_safe_chunked_mode
```

After semantic traversal finishes, the SIR array literal is annotated:

```txt
ArrayExpression.storage_mode
```

The FlatBuffer schema serializes that field, and C++ lowering emits:

```txt
yogi_array_create_with_storage(length, "contiguous_fast_path")
yogi_array_create_with_storage(length, "pointer_safe_chunked_mode")
yogi_array_init_with_storage(storage, length, mode)
```

## Runtime

`contiguous_fast_path` uses a contiguous value buffer. The element pointer table
points at cells inside that buffer.

`pointer_safe_chunked_mode` stores each element cell separately. Reallocating the
pointer table during `push` does not move existing cells, so interior pointers
remain valid.

`yogi_array_pointer_cell(array, index)` now guarantees that `array` is
pointer-safe before returning the cell. Views delegate to their source array, so
the returned pointer always tracks the real owner slot.

The LLVM backend still calls only the Yogi runtime ABI. It does not call
allocator functions directly.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/dynamic_array_storage_analysis.cmake
tests/runtime/sessions/02-variables-aggregates/pointer_invalidation_diagnostics.cmake
```

The storage analysis suite checks runtime output and inspects generated
`main.ll` for exact storage-mode strings.

Positive coverage:

```txt
no pointer -> contiguous
interior pointer without push -> contiguous
interior field pointer + push -> pointer-safe
interior element pointer + push -> pointer-safe
nested interior pointer + push -> pointer-safe
pointer scope ends before push -> contiguous
pointer copy + push -> pointer-safe
pointer rebind -> old root contiguous, new root pointer-safe
descriptor pointer -> contiguous
```

Historical negative coverage:

```txt
whole-array replacement while an interior pointer is live
```

`sort` and `reverse` used to be rejected conservatively. Lot 42 replaced that
behavior with slot-identity tracking so reordering methods are allowed while
preserving pointer validity.

Lot 43 also replaced whole-array replacement rejection with in-place dynamic
array assignment. Preserved indexes keep slot identity, extra indexes create new
slots, and removed indexes invalidate only the removed slots.

## Remaining Work

```txt
runtime compaction when no protected cells are live
pointer-return provenance from ptr<Array> parameters into dynamic array cells
dynamic object structural mutation invalidation, if dynamic object storage becomes resizable/reordering
compile-time diagnostics for provably invalidated dynamic-array pointer use
```

Lot 44 completed late runtime migration from contiguous to pointer-safe storage.
