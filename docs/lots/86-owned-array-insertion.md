# Lot 86: Owned Array Insertion

This lot completes ownership transfer when resource-owning struct values are
inserted with `unshift()` or the insertion side of `splice()`.

## Rule

```ts
let ticket: JobTicket = createTicket()
tickets.unshift(ticket)
```

The array becomes the owner of every native resource field in `ticket`. The
source binding is consumed internally and is not cleaned again when its local
scope ends.

The same rule applies to replacement and insertion-only `splice()` calls:

```ts
const removed: JobTicket[] = tickets.splice(1, 1, replacement)
tickets.splice(2, 0, additional)
```

In the first call, ownership moves in both directions:

```txt
removed element: tickets -> removed
replacement: replacement -> tickets
```

## Multiple `unshift()` Arguments

Arguments are evaluated from left to right, matching TypeScript expression
evaluation. Runtime insertion then proceeds in reverse so the resulting array
keeps the argument order.

```ts
tickets.unshift(first, second, third)
// [first, second, third, ...previous]
```

All resource-owning source bindings are deactivated after transfer. Array
cleanup invokes each native destructor exactly once.

## Covered Program

```txt
tests/programs/native_resource_array_ownership.cmake
```

The program covers returned values, local owners, an ownership alias chain,
multiple `unshift()` arguments, `splice()` replacement, insertion-only
`splice()`, exact destructor counts, destruction order, LLVM IR generation,
object generation, linking, and executable output.

## Build Link Cleanup

Yogi invokes the vendored `ld.lld`/`ld64.lld` executables and does not call the
LLD C++ API in process. The compiler target therefore no longer links the
unused static `liblldCommon`, `liblldELF`, and `liblldMachO` archives. Modern
CMake link-line deduplication is enabled for LLVM's transitive static library
graph.
