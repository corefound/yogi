# Lot 80: Resource Struct Move Assignment

Status update: this lot completed assignment support for the move
infrastructure. Public `move(...)` syntax was superseded by Lot 81; source code
now uses automatic transfer and the compiler emits `$move` internally.

This lot completes the first replacement policy for structs that own native
resource fields.

## Goal

Lot 79 introduced whole-value ownership transfer in declarations and returns:

```ts
let next: Holder = move(holder)
return move(holder)
```

Lot 80 extends the same explicit transfer to assignment:

```ts
target = move(source)
```

It also supports assigning a function result when the function returns a
resource-owning struct through `return move(holder)`:

```ts
target = makeHolder()
```

## Replacement Rule

When assigning a new resource-owning struct into an existing local struct:

```txt
1. Evaluate the right-hand side.
2. Destroy native resource fields currently owned by the target.
3. Store the new struct value into the target slot.
4. Move/register native resource field cleanup metadata onto the target.
5. Deactivate the source owner if the right-hand side is move(source).
```

The target remains the active owner after assignment.

## Example

```ts
function run(): void {
    let target: Holder = {
        resource: native.create(1)
    }

    let source: Holder = {
        resource: native.create(2)
    }

    target = move(source)
}
```

Expected behavior:

```txt
native resource 1 is destroyed during assignment
source is consumed and does not clean up resource 2
target destroys resource 2 at the end of run()
```

## Returned Struct Assignment

Function summaries now carry resource-field ownership for struct returns:

```ts
function makeHolder(): Holder {
    let holder: Holder = {
        resource: native.create(3)
    }

    return move(holder)
}

function run(): void {
    let target: Holder = {
        resource: native.create(4)
    }

    target = makeHolder()
}
```

The previous target resource `4` is destroyed during assignment. The returned
resource `3` becomes owned by `target` and is destroyed at the end of `run()`.

## Rejected Forms

Self-move is rejected:

```ts
holder = move(holder) // error
```

Moving into module/global storage remains rejected:

```ts
let saved: Holder = ...

function run(): void {
    let holder: Holder = ...
    saved = move(holder) // error for now
}
```

Implicit copies remain rejected:

```ts
target = source // error
target = { resource: native.create() } // still not the supported replacement form
```

Passing resource-owning structs by value remains rejected:

```ts
inspect(move(holder)) // not supported yet
```

Use pointer borrowing for read/mutate access:

```ts
inspect(&holder)
```

## Backend Notes

The LLVM backend lowers `move(source)` as the source struct value, then runs the
replacement policy around the store:

```txt
destroy target-owned native resource fields
clear target field-owner metadata
move field-owner metadata from source to target
deactivate source aggregate cleanup
store the new struct value
```

For `target = makeHolder()`, the backend uses the function return summary to
register the returned resource-field cleanup metadata on `target`.

## Tests

Frontend tests cover:

- `target = move(source)` positive case
- `target = make()` positive case for resource-owning struct returns
- self-move rejection
- passing `move(holder)` by value rejection

Program tests cover:

- replacement destroys the old target resource once
- moved source does not destroy after assignment
- target destroys the moved resource once at scope exit
- returned resource-owning struct assignment follows the same replacement rule

## Remaining Work

- Explicit copy/clone policy for resource-owning structs.
- Passing resource-owning structs by value with explicit consume semantics.
- Module/global resource-owning struct storage.
- Whole-struct object-literal replacement such as
  `target = { resource: native.create() }`.
- Resource-field ownership inside runtime object/dictionary aggregates.
