# Lot 64: Pointer Return Provenance For Dynamic Array Cells

## Goal

Preserve pointer provenance when a function returns a pointer derived from a
`ptr<T[]>` parameter into a dynamic array cell or one of that cell's fields.

Before this lot, code like this compiled and only failed later at runtime:

```ts
struct User {
    age: number
}

function firstAge(users: ptr<User[]>): ptr<number> {
    return &users[0].age
}

let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = firstAge(&users)
users.splice(0, 1)
age = 99
```

The returned pointer was real, but the caller-side semantic provenance only knew
that it came from `users`. It did not remember the inner path `[0].age`, so
compile-time invalidation diagnostics could not fire.

## Implementation

`ReturnBorrowSummary` now carries an internal semantic `accessPath`.

For:

```ts
return &users[0].age
```

the function summary records:

```txt
borrowed from parameter 0
accessPath = [0].age
```

At a call site:

```ts
let age: ptr<number> = firstAge(&users)
```

the call result receives:

```txt
root = users
accessPath = [0].age
permission = follows argument
```

That lets existing dynamic-array pointer invalidation logic reject later use
when the slot is provably removed.

## Forwarding

Forwarding through another function preserves the same borrowed path:

```ts
function forwardFirstAge(users: ptr<User[]>): ptr<number> {
    return firstAge(users)
}
```

The forwarded summary still maps to the caller's root plus `[0].age`.

## Dynamic Paths

If multiple return paths borrow from the same parameter but produce different
paths, the summary falls back to an unknown path. Runtime pointer validity still
protects the program, but compile-time slot-specific invalidation only fires
when the returned path is statically known.

## Tests

Focused coverage lives in:

```txt
tests/runtime/sessions/02-variables-aggregates/pointer_invalidation_diagnostics.cmake
```

Program coverage lives in:

```txt
tests/programs/player_scoreboard.cmake
```

The program exercises returned pointers into `Player[]` scores, mutation through
those pointers, `push`, iteration over `ptr<Player[]>`, LLVM lowering, linking,
and runtime execution.
