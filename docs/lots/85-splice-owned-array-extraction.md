# Lot 85: Splice Owned Array Extraction

This lot extends resource-owning dynamic arrays so `splice()` transfers native
resource ownership for the removed range.

## Rule

```txt
const removed: T[] = source.splice(start, deleteCount)
```

If `T` is a struct with native resource fields, ownership of the removed
elements moves from `source` into `removed`.

The source array remains responsible only for elements that stay in the source.
The returned removed-elements array becomes responsible for the removed range.

## Discarded Result

```ts
tickets.splice(1, 2)
```

When the result is ignored, Yogi destroys the temporary removed-elements array
at the end of the expression. Resource-owning elements in that temporary array
are destroyed exactly once.

## Edge Cases

```txt
deleteCount = 0:
  no resource ownership is transferred because no elements are removed

deleteCount past the end:
  only the elements actually removed are transferred
```

## Backend Behavior

The LLVM lowerer reuses the same array-element native resource metadata used by
`push()`, `pop()`, `shift()`, and array cleanup.

For a stored result:

```ts
const removed: JobTicket[] = tickets.splice(1, 2)
```

the returned array owner receives the element field destructor metadata.

For a discarded result:

```ts
tickets.splice(1, 2)
```

the statement lowerer creates a temporary cleanup owner, destroys native
resource fields in the removed-elements array, and then destroys the array.

## Covered Program

```txt
tests/programs/native_resource_array_ownership.cmake
```

The program validates:

- `splice()` removed range stored in a local array
- discarded `splice()` result cleanup
- `deleteCount = 0`
- `deleteCount` larger than available elements
- exact native destructor count and destruction order
- LLVM IR generation with `yogi_array_splice`
- final executable output

