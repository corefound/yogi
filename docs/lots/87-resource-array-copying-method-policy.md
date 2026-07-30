# Lot 87: Resource Array Copying Method Policy

This lot closes the JavaScript array methods that create a second array while
leaving the source array available.

## Completed Method Family

```txt
slice
concat
toSpliced
toReversed
toSorted
flat
with
map
filter
flatMap
```

For copyable elements, each method follows JavaScript ordering, index, depth,
replacement, comparator, and callback behavior. The source array remains
unchanged.

## Resource-Owning Elements

Native resources do not have an implicit clone operation. A shallow copy of a
resource-owning struct would create two values that both appear responsible for
the same native pointer.

Yogi rejects that operation before SIR generation:

```ts
let copied: JobTicket[] = tickets.slice()
// error: array method 'slice' cannot copy resource-owning elements
```

The rule applies consistently to direct copies, reordered copies, filtered
copies, flattened copies, replacements, and callback results that could retain
aggregate or pointer ownership.

Ownership-transferring methods remain available:

```txt
pop
shift
splice
```

## Safe Callback Transformation

A callback may borrow an owned element and return a copyable value:

```ts
let scores: number[] = tickets.map((ticket: JobTicket): number => ticket.score)
```

The source array remains the owner and destroys its resources normally.

## Compiler Pipeline

The semantic symbol for an array records native resource field destructors as
resources enter through `push`, `unshift`, or `splice`. Copy-producing methods
consult that state and emit a source diagnostic. The metadata also propagates
through array aliases and through the removed-array result of `splice`.

The LLVM lowerer repeats the check against its existing array-element cleanup
metadata. This prevents malformed or externally generated SIR from bypassing
the ownership rule.

## Tests

```txt
src/compiler/tests/frontend.test.ts
tests/programs/array_copying_methods.cmake
tests/programs/native_resource_array_ownership.cmake
```

Coverage includes every method in the completed family, source preservation,
safe resource-to-number mapping, semantic diagnostics for every unsafe method,
LLVM verification, object generation, executable linking, exact destructor
counts, and no double-free.
