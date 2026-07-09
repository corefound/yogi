# Lot 33: Pointer Dereference Syntax

This lot adds explicit pointer dereference syntax to the pointer model.

Yogi still does not perform implicit pointer-to-value conversion. The user must
write the dereference explicitly:

```ts
let value: number = 7
let p: ptr<number> = &value

print(*p)     // 7
(*p) = 42
print(value)  // 42
```

## Rules

- `*p` requires `p` to have type `ptr<T>`.
- `*p` has type `T`.
- `*p` on a non-pointer value is rejected.
- `(*p) = value` is supported for scalar pointees.
- Write-through through readonly provenance is rejected.
- Full aggregate replacement through dereference is rejected for now.
- Dereferencing an aggregate pointer produces a borrowed aggregate view for
  reads/indexing, not an owned deep copy.

Example aggregate read:

```ts
function read(matrix: ptr<number[2, 3]>): number {
    return (*matrix)[1, 2]
}
```

Example rejected aggregate replacement:

```ts
let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let p: ptr<number[2, 3]> = &matrix

(*p) = [[7, 8, 9], [10, 11, 12]] // error
```

Use pointer indexing for element mutation instead:

```ts
p[1, 2] = 99
(*p)[1, 2] = 99
```

## Readonly Provenance

Pointer mutability still comes from the root storage:

```ts
const value: number = 1
let p: ptr<number> = &value;

(*p) = 2 // error
```

The semicolon after `&value` matters when the next line starts with
parentheses. This follows TypeScript parsing rules: a line beginning with `(`
can continue the previous expression.

## Lifetime

Returning a dereferenced aggregate derived from local storage is rejected:

```ts
function bad(): number[3] {
    let row: number[3] = [1, 2, 3]
    let p: ptr<number[3]> = &row

    return *p // error
}
```

Returning a dereferenced aggregate derived from a pointer parameter participates
in the existing borrowed return summary model:

```ts
function row(values: ptr<number[3]>): number[3] {
    return *values // borrowed aggregate result summary
}
```

That model is conservative and does not make dereferenced aggregate returns into
owned copies.

## SIR And LLVM

The frontend serializes dereference as `DereferenceExpression` in SIR.

The FlatBuffer stores:

```txt
target
type
root_symbol_id
root_name
access_path
permission
```

LLVM lowering:

```txt
*ptr<number>              -> load double from pointer
(*ptr<number>) = value    -> store double into pointer
*ptr<aggregate>           -> borrowed descriptor/view pointer
(*ptr<aggregate>)[i]      -> array element access through descriptor/view
```

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_array_indexing.cmake
```

Positive coverage:

- scalar dereference read
- scalar dereference write-through
- aggregate pointer dereference followed by fixed-shape indexing

Negative coverage:

- dereferencing a non-pointer
- writing through readonly provenance
- full aggregate replacement through dereference
- returning local dereferenced aggregate storage

## Remaining Work

- Parser recovery for `(*p)` at the start of a new line after an expression
  without requiring an explicit semicolon.
- Explicit borrowed return/view syntax.
- Dynamic shaped pointer views such as `ptr<Array<T, Rank>>`.
