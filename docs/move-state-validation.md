# Move-State Validation

This document tracks the semantic move-state validation lot for aggregate
values.

Previous lots gave the compiler enough information to decide whether aggregates
escape and where cleanup should be generated. This lot adds a frontend rule:
once an aggregate's ownership has moved away from the current local owner, later
uses of that aggregate are rejected during semantic analysis.

The goal is RAII-like safety without a Rust-style borrow checker.

```text
Escape analysis:
  Can this value live beyond the current scope?

Ownership analysis:
  Who owns this value?

Move-state validation:
  Is this source-level aggregate still usable here?
```

## Current Rule

Aggregate variables start usable. They become moved when ownership leaves the
local owner through one of these operations:

- Returning the aggregate or one of its aliases.
- Assigning the aggregate into module/global storage.
- Storing the aggregate into an aggregate member.
- Passing the aggregate to a known callee whose effect summary says the
  parameter escapes.
- Passing the aggregate to an unknown or ambient external function.
- Reassigning ownership from one local aggregate binding to another.

After that, using the moved aggregate or any alias of the same owner is a
semantic error.

## Borrowed Calls Stay Usable

Known internal functions borrow aggregate arguments by default.

```ts
function sum(scores: number[]): number {
    return scores[0] + scores[1]
}

function ok(): number {
    let local: number[] = [1, 2, 3]
    let first: number = sum(local)
    return first + local[2]
}
```

`sum` only reads `scores`. Its function effect summary says parameter `0` does
not escape. Therefore `local` remains usable after `sum(local)`.

## Retained Calls Move The Local Owner

```ts
let saved: number[] = [0]

function save(scores: number[]): void {
    saved = scores
}

function invalid(): number {
    let local: number[] = [1, 2]
    save(local)
    return local[0]
}
```

`save` stores the parameter in module storage, so its summary marks the
parameter as escaping. At the call site, `local` is marked moved because the
local owner can no longer behave as if it owns the aggregate exclusively.

The compiler rejects the later `local[0]` before LLVM lowering.

## Alias Propagation

Aliases share the same aggregate owner.

```ts
let saved: number[] = [0]

function save(scores: number[]): void {
    saved = scores
}

function invalid(): number {
    let local: number[] = [1, 2]
    let alias: number[] = local
    save(alias)
    return local[0]
}
```

Moving `alias` also marks `local` moved because both names point at the same
semantic owner. This prevents cleanup or use from treating the original binding
as still locally owned.

## If Statement Merge

Move state is control-flow aware for basic `if`/`else` blocks.

```ts
let saved: number[] = [0]

function save(scores: number[]): void {
    saved = scores
}

function invalid(flag: boolean): number {
    let local: number[] = [1, 2]

    if (flag) {
        save(local)
    }

    return local[0]
}
```

The true branch moves `local`; the false branch does not. After the merge, the
compiler conservatively treats `local` as moved because there is a reachable path
where ownership left the local scope.

Branches that return do not poison later code:

```ts
function pick(flag: boolean): number[] {
    let local: number[] = [1, 2, 3]

    if (flag) {
        return local
    }

    let first: number = local[0]
    return [first]
}
```

The move happens only on a path that immediately returns. The continuation path
still owns `local`, so the read of `local[0]` is valid.

## Unknown Calls Are Conservative

```ts
declare function externalUse(scores: number[]): void

function invalid(): number {
    let local: number[] = [1, 2]
    externalUse(local)
    return local[0]
}
```

The body of `externalUse` is unknown. The compiler therefore marks aggregate
arguments as escaping, and the later use of `local` fails semantically.

## Pipeline Coverage

This lot is covered in two layers:

- Frontend semantic tests verify that valid borrows pass and invalid use after
  move reports an error with useful detail.
- `yogi_pipeline_move_state_validation` runs the C++ compiler executable against
  valid and invalid source programs. Invalid programs must fail before LLVM IR is
  generated.

## Current Limitations

This is still not a complete borrow checker. The current validation does not yet
model:

- Explicit `move` or `consume` syntax.
- Copy constructors or clone operations for aggregates.
- More method-level ownership summaries beyond the implemented array `push`.
- Loop-aware move-state joins for `break` and `continue`.
- Closure capture ownership.

The model is intentionally conservative. When it cannot prove a call is a pure
borrow, it prefers to extend or move ownership rather than risking early free or
use-after-move.
