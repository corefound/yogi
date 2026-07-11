# Lot 40: Adaptive Dynamic Arrays

This lot replaces the old conservative dynamic-array pointer rule.

Old rule:

```txt
live interior pointer + push = diagnostic
```

Current rule:

```txt
live interior pointer + push = allowed
destructive/reordering/replacement operation + live interior pointer = diagnostic
```

## User Model

The user-facing type remains normal TypeScript-like `T[]`.

Yogi does not expose separate user types such as `StableArray<T>`, `Cell<T>`,
or `Handle<T>`. The compiler/runtime choose the safe storage strategy.

```ts
struct User {
    age: number
}

let users: User[] = [{ age: 20 }]
let age: ptr<number> = &users[0].age

users.push({ age: 30 })
age = 99

print(users[0].age) // 99
print(users[1].age) // 30
```

## Runtime Storage

Lot 40 introduced the pointer-safe dynamic-array representation needed to make
`push` safe while a live interior pointer exists. Lot 41 refined this into an
adaptive selection model: dynamic arrays stay contiguous by default, and only
arrays proven to grow while an interior pointer is live use pointer-safe slots.

```txt
Array descriptor:
  storage mode
  element pointer table
  length
  capacity

contiguous_fast_path:
  one contiguous value buffer
  element table points at the contiguous cells

pointer_safe_chunked_mode:
  each element cell is separately allocated
  element table can move, existing cells remain stable
```

In pointer-safe mode, growing the array may move the element pointer table, but
it does not move existing cells. A pointer returned by
`yogi_array_cell(array, index)` points to the cell, not to an entry inside the
reallocating pointer table.

This preserves:

```ts
let first: ptr<User> = &users[0]
let age: ptr<number> = &users[0].age
let zip: ptr<number> = &users[0].address.zip
```

after `users.push(...)`.

## Current Backend Behavior

`&users[i]` lowers to:

```txt
yogi_array_cell(users, i)
tag as runtime cell pointer
```

`ptr<Struct>.field` now handles both pointer representations:

```txt
raw pointer:
  getelementptr into the LLVM struct

runtime cell pointer:
  yogi_cell_get
  yogi_any_to_object
  yogi_object_cell(field)
  tag as runtime cell pointer
```

Pointer reads and writes then continue through `lowerPointerRead` and
`lowerPointerWrite`, so raw struct pointers and runtime object/cell pointers use
one visible `ptr<T>` model.

## Allowed While Interior Pointers Are Live

```txt
push
field writes through the pointer
direct field writes to the same element
push on another array
push after pointer rebind
push after pointer copy
push while holding ptr<T[]> to the descriptor
```

## Still Rejected While Interior Pointers Are Live

Yogi remains conservative for operations that can remove, reorder, replace, or
destroy pointed storage:

```txt
pop
shift
unshift
splice
sort
reverse
whole-array replacement
```

Future work can make some of these checks index-sensitive. For example, `pop`
could be allowed when the compiler/runtime can prove the live pointer does not
target the removed element. That is not implemented yet.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_invalidation_diagnostics.cmake
```

Positive cases include:

```txt
push with live pointer to element field
multiple pushes with live pointer
push with live pointer to element itself
nested field pointer such as &users[0].address.zip
pointer copy then push
pointer rebind then push on both roots
ptr<User[]> descriptor pointer then push
```

Negative cases include:

```txt
replacement while pointer is live
splice/shift/unshift/pop while pointer is live
reverse/sort while pointer is live
readonly root push
```

## Follow-Up Optimization

Lot 41 implements the first adaptive storage decision in semantic analysis and
SIR/LLVM lowering. Remaining follow-up work is more precise than the original
all-or-nothing plan:

Future work can add:

```txt
runtime index-sensitive checks for destructive operations
compaction only when no protected cells are live
runtime migration from contiguous to pointer-safe if a future feature creates a late storage transition
```
