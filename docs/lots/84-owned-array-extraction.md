# Lot 84: Owned Array Extraction

This lot extends resource-owning dynamic arrays so `pop()` and `shift()` can
transfer an owned struct element out of the array.

## Rule

```txt
If an array element owns resources and the element is removed by pop/shift,
ownership moves to the receiving value.
```

The array must no longer destroy the removed slot. The new owner must destroy
the resource later through normal RAII cleanup.

## Non-Empty Requirement

`pop()` and `shift()` normally return:

```ts
T | undefined
```

Yogi allows direct initialization as `T` only when semantic analysis can prove
the array is non-empty.

Accepted:

```ts
let tickets: JobTicket[] = []
tickets.push(createTicket(5, 2))

let ticket: JobTicket = tickets.pop()
```

Rejected:

```ts
let tickets: JobTicket[] = []
let ticket: JobTicket = tickets.pop()
```

The rejected case still has type `JobTicket | undefined`, so assigning it into
`JobTicket` would be unsafe.

## Covered Program

```txt
tests/programs/native_resource_array_ownership.cmake
```

The program validates:

- `tickets.push(createTicket(...))`
- `tickets.push(ticket)` ownership transfer into the array
- `let ticket: JobTicket = tickets.pop()` when the array is known non-empty
- `let ticket: JobTicket = tickets.shift()` when the array is known non-empty
- empty-array `pop()` / `shift()` diagnostics
- destructor order and no double-free
- LLVM IR, object file, executable generation, and runtime output

## Backend Behavior

The LLVM lowerer treats `array.pop` and `array.shift` as native resource field
sources when the receiver array has registered resource-owning element fields.

When the extracted element initializes a local struct, those field destructors
are registered on the local owner. The array cleanup only sees the remaining
elements.

## Remaining Work

`splice()` returns an array of removed elements, not a single element, so owned
resource extraction through `splice()` remains a separate lot.
