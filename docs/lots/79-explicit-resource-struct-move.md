# Lot 79: Explicit Resource Struct Move

This lot adds the first explicit whole-value ownership transfer for structs that
own native resource fields.

## Goal

Lot 78 made resource-owning structs non-copyable by default. That prevented
double destruction, but it also meant a function could not safely produce and
return a resource-owning struct as a value.

Lot 79 introduces:

```ts
move(holder)
```

`move(...)` is intentionally narrow. It transfers ownership from one mutable
resource-owning struct binding to a new owner.

## Supported Forms

Declaration move:

```ts
let first: Holder = {
    resource: native.create()
}

let second: Holder = move(first)
```

Return move:

```ts
function make(): Holder {
    let holder: Holder = {
        resource: native.create()
    }

    return move(holder)
}

let result: Holder = make()
```

The source binding is consumed:

```ts
let second: Holder = move(first)
print(first) // error
```

## Ownership Behavior

When `move(holder)` is lowered:

```txt
1. The struct value is read from the source binding.
2. Native resource field cleanup metadata moves from source to target/caller.
3. The source binding cleanup is deactivated.
4. The target/caller becomes responsible for cleanup.
5. The source binding becomes unusable semantically.
```

This keeps the RAII model intact:

```txt
creator owns by default
move transfers ownership
the moved-from binding does not destroy
the moved-to binding destroys once at the end of its lifetime
```

## Rejected Forms

Moving a struct that does not own native resource fields is rejected:

```ts
struct Point {
    x: number
}

let point: Point = { x: 1 }
let next: Point = move(point) // error
```

Moving a const binding is rejected:

```ts
const holder: Holder = {
    resource: native.create()
}

let next: Holder = move(holder) // error
```

Whole-struct reassignment remains rejected:

```ts
target = move(source) // error for now
```

That case needs a separate replacement policy because the previous target may
already own resource fields that must be destroyed before the new value is
stored.

Passing resource-owning structs by value remains rejected:

```ts
inspect(move(holder)) // not supported yet
```

Use pointer borrowing for now:

```ts
inspect(&holder)
```

## Backend Notes

The SIR does not need a new FlatBuffer schema field for this lot. `move(...)`
is serialized as a builtin call with `builtin_method = "move"`.

The LLVM backend lowers `move(source)` as the source value, then transfers the
native resource field cleanup map to the new owner. Function summaries infer
which returned struct fields own native resources so callers can register their
own cleanup correctly.

## Tests

Frontend tests cover:

- declaration move positive case
- return move positive case
- moving a non-resource struct rejection
- moving a const resource-owning struct rejection
- use-after-move rejection
- whole-struct reassignment with `move(...)` rejection

Program tests cover:

- a local `let second: Holder = move(first)` destroys the native resource once
- `return move(holder)` transfers cleanup to the caller
- native destructor order remains stable and no double-free occurs

## Remaining Work

- Whole-struct replacement with `target = move(source)`.
- Explicit copy/clone policy for resource-owning structs.
- Passing `move(holder)` into by-value function parameters.
- Module/global resource-owning struct storage.
- Resource-field ownership inside runtime object/dictionary aggregates.
