# Destructor Scheduling

This document tracks the destructor scheduling lot for the memory-management
pipeline.

The previous lots answered two questions:

```text
Escape analysis:
  Can this aggregate live beyond this scope?

Ownership analysis:
  Who owns this aggregate at a function boundary?
```

This lot answers the next question:

```text
Destructor scheduling:
  On which exact control-flow edge should cleanup run?
```

Knowing that a value must be cleaned up is not enough. The compiler must insert
cleanup on every path that exits the scope while avoiding paths where ownership
was moved or escaped.

## Rule

When leaving a scope, destroy all owned values that are still live in reverse
creation order, but only when they are:

- Initialized.
- Still alive.
- Not moved into the return value.
- Not escaped into a longer lifetime.
- Not already destroyed.

This is intentionally RAII-like. The user does not call `free`, `delete`, or
`drop`.

## Current Implementation

The LLVM backend now tracks local aggregate ownership with a per-function state:

```text
LocalAggregateCleanup:
  owner
  symbolId
  type
  value
  heapOwned
  active
```

It also tracks aliases:

```text
aggregateAliases:
  aliasName -> ownerName
```

Examples:

```ts
let original: number[] = [1, 2]
let alias: number[] = original
return alias
```

`alias` resolves to `original`. Returning `alias` deactivates the cleanup for the
owner `original`, so the return moves ownership instead of destroying it.

## Linear Scope Exit

```ts
function test(): void {
    let scores: number[] = [1, 2, 3]
}
```

`scores` is initialized and remains owned by the scope. The backend emits cleanup
at the end of the block:

```text
yogi_array_init
...
yogi_array_drop
```

For heap-owned local aggregates, such as local results returned from another
function, the cleanup uses:

```text
yogi_array_destroy
```

## Early Return

```ts
function test(flag: boolean): number {
    let scores: number[] = [1, 2, 3]

    if (flag) {
        return scores[0]
    }

    return 0
}
```

`scores` does not escape. There are two return edges:

```text
flag == true:
  evaluate scores[0]
  cleanup scores
  return value

flag == false:
  cleanup scores
  return 0
```

The backend emits cleanup before each `ret`, not only at the physical end of the
function.

## Return Move

```ts
function makeScores(flag: boolean): number[] {
    let scores: number[] = [1, 2, 3]

    if (flag) {
        return scores
    }

    return [0]
}
```

`scores` is an owned local aggregate. The true branch returns it, so ownership
moves to the caller:

```text
flag == true:
  deactivate cleanup for scores
  return scores
```

The false branch does not return `scores`, so the function still owns it there:

```text
flag == false:
  create return value [0]
  cleanup scores
  return [0]
```

This is the key improvement in this lot: a value can be moved on one path and
destroyed on another.

## Nested Block

```ts
function test(flag: boolean): void {
    let a: number[] = [1]

    if (flag) {
        let b: number[] = [2]
        return
    }
}
```

The return inside the nested block must destroy values in reverse ownership
order:

```text
flag == true:
  cleanup b
  cleanup a
  return

flag == false:
  cleanup a at normal function exit
```

The inner variable `b` is only initialized in the true branch, so no cleanup for
`b` exists on the false path.

## If/Else Locals

```ts
function test(flag: boolean): void {
    if (flag) {
        let a: number[] = [1]
    } else {
        let b: number[] = [2]
    }
}
```

Each branch receives its own ownership state:

```text
if branch:
  initialize a
  cleanup a at end of branch

else branch:
  initialize b
  cleanup b at end of branch
```

After the merge, neither `a` nor `b` is live. The backend restores the incoming
outer ownership state before continuing after the `if`.

## Branch State Merge

For `if`/`else`, codegen now snapshots the ownership state before the branch and
lowers each branch independently.

At merge:

- Branch-local owners are gone because each branch block cleaned them.
- Outer owners remain active only if every reachable branch still owns them.
- If one reachable branch deactivates an owner because it escaped, the merged
  state treats it as inactive conservatively.
- Branches that already returned do not participate in the merge.

This avoids two common bugs:

- Losing an outer cleanup because one branch returned.
- Cleaning a value after a branch may have moved or escaped it.

## Escaped Values

```ts
let saved: number[] = [0]

function save(scores: number[]): void {
    saved = scores
}

function test(flag: boolean): void {
    let local: number[] = [1]

    if (flag) {
        save(local)
    }
}
```

The call to `save` uses the callee's `FunctionEffectSummary`. Since `save`
stores parameter `0`, the call site marks argument `local` as escaping.

At codegen:

```text
flag == true:
  deactivate local cleanup

merge:
  local may have escaped, so do not destroy it locally
```

This is conservative. If one branch may extend the lifetime, the merged path
does not destroy the value locally.

## Borrowed Calls

```ts
function sum(scores: number[]): number {
    return scores[0]
}

function test(): number {
    let local: number[] = [10]
    return sum(local)
}
```

`sum` only borrows `scores`. The call effect says `escapes=false`, so `local`
remains owned by `test` and is cleaned up before return.

## Unknown Calls

```ts
declare function externalUse(scores: number[]): void

function test(): void {
    let local: number[] = [1]
    externalUse(local)
}
```

Unknown calls are conservative. Aggregate arguments are marked as escaping, so
the local cleanup is deactivated. This may keep the value alive longer than
necessary, but it avoids early free.

## Current Test Coverage

The pipeline test `yogi_pipeline_destructor_scheduling` covers:

- Local array cleanup at scope exit.
- Cleanup before early return.
- Return move without destroying the returned owner.
- If/else locals initialized only in one branch.
- Nested block cleanup before return.
- Multiple owners where different branches return different values.
- Alias return moving the original owner.
- Global/callee escape disabling local cleanup.
- Known borrow preserving local cleanup.

## Remaining Work

Future lots should improve:

- Precise runtime liveness flags for conditional escapes after merge.
- Explicit move/consume syntax.
- More method-call summaries beyond the implemented `scores.push(value)`.
- Loops with break/continue cleanup edges.
- Exceptions or panic/unwind cleanup paths if the language adds them.
