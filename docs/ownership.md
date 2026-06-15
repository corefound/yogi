# Function Ownership

This document describes the current ownership model when aggregate values cross
function boundaries.

The key distinction is:

```text
Escape analysis answers:
  Can this value live beyond the current scope?

Ownership analysis answers:
  Who owns this value and who must clean it up?
```

Yogi currently uses a small RAII-inspired model:

- The creator of an aggregate owns it by default.
- Returning an aggregate moves ownership to the caller.
- Passing an aggregate to a known internal function borrows by default.
- If a known callee stores or returns a parameter, that argument escapes at the
  call site.
- Unknown or ambient external calls mark aggregate arguments as escaping
  conservatively.
- The current scope only emits cleanup when it still owns the resource.

This applies to aggregates and resources:

- Dynamic arrays.
- Dynamic objects.
- Tuples or structs that contain resources.
- Future heap-backed strings.
- Future values with destructor requirements.

Primitive values such as `number` and `boolean` are copied by value and do not
need ownership tracking.

## Function Effect Summary

Semantic analysis computes a compact summary for each known function:

```text
FunctionEffectSummary:
  returnsParam[index]: boolean
  storesParam[index]: boolean
  escapesParam[index]: boolean
  mutatesParam[index]: boolean
  consumesParam[index]: boolean
```

The summary is serialized into the Semantic Intermediate Representation
FlatBuffer with each function declaration.

Current rules:

- `returnsParam[index]` is true when a parameter or one of its aliases is
  returned.
- `storesParam[index]` is true when a parameter or one of its aliases is stored
  into module/global storage, or into an escaping/global aggregate property.
- `escapesParam[index]` is true when `returnsParam` or `storesParam` is true, or
  when the parameter is passed to an unknown/external call.
- `mutatesParam[index]` is true when code writes through the aggregate, such as
  an index assignment or property assignment.
- `consumesParam[index]` is always false for now. Explicit move/consume syntax
  is a future feature.

Known call sites use the summary. Unknown call sites escape conservatively.

## Return Move

```ts
function makeScores(): number[] {
    let scores: number[] = [1, 2, 3]
    return scores
}

let result: number[] = makeScores()
```

Inside `makeScores`, `scores` owns its array descriptor and heap buffer.

At `return scores`, ownership moves to the caller. The callee does not drop or
destroy `scores` after returning. When the caller stores the result into
`result`, the caller owns that aggregate and becomes responsible for cleanup at
the end of its lifetime.

The backend lowers this shape through a heap-created array in the callee and a
caller-side local cleanup when the returned aggregate remains local.

## Normal Borrow

```ts
function sum(scores: number[]): number {
    return scores[0] + scores[1]
}

function run(): number {
    let local: number[] = [1, 2, 3]
    return sum(local)
}
```

`sum` only reads `scores`, so its summary says the parameter does not escape.
The call `sum(local)` is a temporary borrow. `run` remains the owner of `local`
and cleans it up when the function returns.

For non-escaping local array literals, the backend uses stack descriptor storage
and emits:

```text
yogi_array_init
yogi_array_drop
```

## Mutating Borrow

```ts
function touch(scores: number[]): void {
    scores[0] = scores[0] + 1
}

function run(): void {
    let local: number[] = [1, 2, 3]
    touch(local)
}
```

Mutation does not imply retention. `touch` mutates through the borrowed
aggregate, but it does not store or return the parameter. The caller remains the
owner and still performs cleanup.

The summary marks `mutatesParam[0] = true` and `escapesParam[0] = false`.

## Retained Global Escape

```ts
let saved: number[] = [0]

function save(scores: number[]): void {
    saved = scores
}

function run(): void {
    let local: number[] = [1, 2, 3]
    save(local)
}
```

`save` stores `scores` into module storage. Its summary marks parameter `0` as
stored and escaping. At the call site, `local` is marked as escaping through the
callee.

The caller must not destroy `local` as if it were purely local. Ownership is
extended to module/global storage, and module cleanup later destroys the global
aggregate.

## Alias Propagation

```ts
function save(scores: number[]): void {
    saved = scores
}

function run(): void {
    let local: number[] = [1, 2, 3]
    let alias: number[] = local
    save(alias)
}
```

Escape flows through aliases. Since `alias` is passed to a callee that retains
the parameter, the original `local` also escapes.

This keeps cleanup conservative and prevents early free.

## Unknown Calls

```ts
declare function externalUse(scores: number[]): void

function run(): void {
    let local: number[] = [1, 2, 3]
    externalUse(local)
}
```

`externalUse` has no known body, so the compiler cannot prove that it only
borrows. Aggregate arguments are marked as escaping conservatively.

This can keep values alive longer than necessary, but it is safe.

## Current Limitations

The ownership model is intentionally small. It does not yet implement:

- A full borrow checker.
- Explicit `move` or `consume` syntax.
- Shared ownership or reference counting.
- Closure capture summaries.
- Method-call summaries such as `scores.push(4)`.
- Loops with break/continue cleanup edges.

The current model is enough to make function boundaries safe for direct
function calls while preserving stack-first local aggregates whenever the callee
only borrows.
