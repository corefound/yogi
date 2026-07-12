# Lot 47: Function Invalidation Effect Summaries

This lot teaches semantic analysis to summarize dynamic-array slot-removal
effects inside functions.

## Goal

Functions can now describe that a parameter is involved in a slot-removing array
operation:

```ts
function dropFirst(users: User[]): void {
    users.shift()
}
```

The function summary records:

```txt
parameter 0:
  mutates: true
  invalidations:
    - kind: shift
```

This is separate from runtime behavior. Today normal `T[]` parameters use
local/value descriptor semantics, so mutating a normal array parameter does not
invalidate pointers in the caller.

## Current Call-Site Rule

The summary is only applied to caller storage when the visible parameter type is
a pointer to a dynamic array:

```ts
ptr<User[]>
```

That keeps the compiler honest:

```ts
function dropFirst(users: User[]): void {
    users.shift()
}

let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[0].age

dropFirst(users)
age = 99
```

Allowed. `dropFirst` mutates its local parameter descriptor, not the caller's
`users` binding.

## Summary Effects

Semantic summaries can record:

```txt
shift()              -> removes slot 0
pop()                -> removes last slot when caller length is known
splice(start,count)  -> removes a known literal range
param = literal      -> removes indexes >= literal length
```

Effects inside `if`, `while`, `for`, or `switch` are marked `maybe` because the
operation may only run on some paths.

Nested function calls propagate effects through summaries:

```ts
function dropFirst(users: User[]): void {
    users.shift()
}

function wrapper(users: User[]): void {
    dropFirst(users)
}
```

`wrapper` also records that its parameter may be involved in a `shift`
invalidation.

## Why Normal `T[]` Does Not Invalidate Caller

Yogi's current lowered behavior for a normal array parameter is local/value
descriptor semantics. This is tested explicitly:

```ts
function dropFirst(users: User[]): void {
    users.shift()
}

let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[0].age

dropFirst(users)
age = 99

print(users[0].age) // 99
print(users[1].age) // 30
```

The caller's pointer remains valid.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/dynamic_array_pointer_validity_tracking.cmake
```

Added coverage:

```txt
normal array parameter shift does not invalidate caller pointer
normal array parameter shift does not mutate caller descriptor
normal array parameter pop does not invalidate caller pointer
normal array parameter conditional shift does not invalidate caller pointer
```

Existing tests still cover direct local invalidation, branch-sensitive
invalidation, and runtime dynamic invalidation.

## Completed

- ✅ parameter effects can carry dynamic-array invalidation summaries
- ✅ summaries detect `shift`, `pop`, literal `splice`, and literal replacement
- ✅ summaries propagate through known internal function calls
- ✅ branch/loop/switch invalidation effects are marked as maybe
- ✅ normal `T[]` parameters do not falsely invalidate caller pointers
- ✅ call-site application is restricted to pointer-to-dynamic-array parameters

## Pending / Future

- ✅ mutating array methods through `ptr<T[]>`
- ✅ end-to-end caller invalidation tests for `ptr<T[]>` parameters
- ⬜ serialize invalidation summaries into FlatBuffers if cross-module semantic
  imports need them
- ⬜ dynamic/non-literal invalidation summaries that defer to runtime checks
