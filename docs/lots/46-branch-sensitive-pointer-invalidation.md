# Lot 46: Branch-Sensitive Pointer Invalidation

This lot makes dynamic-array pointer invalidation aware of simple control-flow
joins.

## Goal

Lot 45 could prove direct removed-slot pointer use:

```ts
users.shift()
age = 99
```

This lot handles cases where invalidation happens inside branches or loops:

```ts
if (flag) {
    users.shift()
}

age = 99
```

The pointer is valid on the `flag == false` path and invalid on the
`flag == true` path, so Yogi reports:

```txt
pointer 'age' may be used after its target dynamic array element was removed
```

## Model

Semantic analysis now snapshots these states around control-flow bodies:

```txt
aggregate move state
live pointer provenance / invalidation state
known dynamic array lengths
```

For `if/else`, each branch starts from the same state:

```txt
before
  then branch -> thenState
  else branch -> elseState
merge(thenState, elseState)
```

If one reachable branch invalidates a pointer and another does not, the merged
state becomes `maybe invalidated`.

If every reachable branch invalidates the same pointer, the merged state remains
definitely invalidated.

If the invalidating branch terminates with `return`, it does not contribute to
the state after the `if`.

## Examples

### Maybe Invalidated

```ts
function test(flag: boolean): void {
    let users: User[] = [{ age: 20 }, { age: 30 }]
    let age: ptr<number> = &users[0].age

    if (flag) {
        users.shift()
    }

    age = 99
}
```

Rejected, because `age` is invalid on one path.

### Invalidating Branch Returns

```ts
function test(flag: boolean): number {
    let users: User[] = [{ age: 20 }, { age: 30 }]
    let age: ptr<number> = &users[0].age

    if (flag) {
        users.shift()
        return users.length
    }

    age = 99
    return users[0].age
}
```

Allowed. The only path that reaches `age = 99` did not invalidate `age`.

### Rebind Clears Old Invalidation

```ts
function test(flag: boolean): number {
    let users: User[] = [{ age: 20 }, { age: 30 }]
    let age: ptr<number> = &users[0].age

    if (flag) {
        users.shift()
        age = &users[0].age
    } else {
        age = &users[1].age
    }

    age = 99
    return age
}
```

Allowed. The pointer binding is valid on both paths after the branch.

### Loops

Loops merge two possibilities:

```txt
zero iterations
one observed body/increment iteration
```

That means this is rejected:

```ts
while (flag) {
    users.shift()
    break
}

age = 99
```

The loop might execute once and invalidate the pointer.

If the invalidating loop body returns, the invalidation does not leak:

```ts
while (flag) {
    users.shift()
    return users.length
}

age = 99
```

## Dynamic Array Length Merging

Known lengths are also branch-merged. If two paths disagree, the compiler drops
back to `unknown` instead of making a false proof.

Example:

```ts
if (flag) {
    users.push({ age: 40 })
}

users.pop()
```

The `pop()` removed slot depends on the path, so semantic analysis does not
claim a definite removed index. Runtime slot validity still protects the
program.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/dynamic_array_pointer_validity_tracking.cmake
```

Added coverage:

```txt
if invalidates then returns; later pointer use is allowed
if invalidates then rebinds before merge; later pointer use is allowed
while invalidates then returns; later pointer use is allowed
branch length disagreement keeps later pop runtime checked
if maybe invalidates; later pointer use is rejected
while maybe invalidates; later pointer use is rejected
```

## Completed

- ✅ pointer invalidation state is snapshotted/restored around branches
- ✅ `if/else` merges reachable invalidation states
- ✅ loops merge zero-iteration and one-iteration states
- ✅ invalidating return paths do not poison following code
- ✅ pointer rebind clears prior invalidation on that path
- ✅ known dynamic array lengths merge conservatively
- ✅ function summaries record dynamic-array invalidation effects

## Pending / Future

- ⬜ switch-specific branch invalidation summaries
- ⬜ end-to-end caller invalidation through `ptr<T[]>` parameters
- ⬜ secondary diagnostics for pointer creation and removal branch
