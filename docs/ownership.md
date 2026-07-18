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

## Native Extern Destructor RAII

Native `extern` blocks can define one compiler-managed destructor:

```ts
extern algorithm from "./algorithm.a" {
    create(): ptr<NativeResource>
    destructor(resource: ptr<void>): void
}
```

Values returned as `ptr<T>` from that extern block become native resources owned
by Yogi. Yogi decides when the resource lifetime ends. The native library decides
how the resource is actually destroyed.

Local native resources participate in the same RAII cleanup scheduling used for
aggregates:

- Normal scope exit calls the extern destructor.
- Early `return` calls the destructor before returning.
- Multiple resources are destroyed in reverse creation order.
- Reassignment destroys the old owned resource before overwriting the slot.
- Returning the resource moves ownership to the caller.
- Null resource pointers are skipped.

This is distinct from `runtime-owned` strings. Runtime-owned values are already
managed by Yogi's runtime. Extern-destructor-owned values are lifetime-managed by
Yogi, but destruction is delegated to the native library.

Examples using `kind`, `switch`, `malloc`, `free`, `new`, `delete`, `fclose`, or
custom allocators are illustrative only. Yogi does not require any specific
native resource layout or cleanup strategy.

### Struct Field Ownership

Native resources can move into real struct fields:

```ts
struct NativeResource {
    id: number
}

struct Holder {
    resource: ptr<NativeResource>
}

function run(): void {
    const resource: ptr<NativeResource> = algorithm.create(1)
    let holder: Holder = { resource: resource }
}
```

The local `resource` cleanup is deactivated after the move. The field
`holder.resource` becomes the owner and is destroyed when `holder` leaves scope.

Inline creation also works:

```ts
let holder: Holder = {
    resource: algorithm.create(1)
}
```

Nested struct paths are tracked, such as `nested.holder.resource`.

Field reassignment destroys the previous owned pointer before storing the new
one:

```ts
holder.resource = algorithm.create(2)
```

Pointer fields without native resource metadata remain borrowed/raw pointers and
are not destroyed automatically.

### Copy Policy

Resource-owning structs are not implicitly copyable yet.

These shapes are rejected:

```ts
let holder: Holder = { resource: algorithm.create(1) }
let copy: Holder = holder

function make(): Holder {
    return holder
}

inspect(holder)
holder = { resource: algorithm.create(2) }
```

Use an explicit pointer borrow when a function only needs to inspect or mutate
the existing struct:

```ts
inspect(&holder)
```

`print(holder)` remains allowed as a debug/read operation.

If a local native resource is moved into a struct field, the source binding is
considered moved:

```ts
let resource: ptr<NativeResource> = algorithm.create(1)
let holder: Holder = { resource: resource }

print(resource) // error
```

## Current Limitations

The ownership model is intentionally small. It does not yet implement:

- A full borrow checker.
- A general `consume` syntax.
- Shared ownership or reference counting.
- Closure capture summaries.
- More method-call summaries beyond the implemented `scores.push(value)`.
- Resource-field ownership for runtime object/dictionary aggregates.
- Explicit copy/move constructors for whole resource-owning structs.
- Whole-struct reassignment replacement for resource-owning structs.
- Passing whole resource-owning structs by value.

Resource-owning structs do support explicit ownership transfer in two forms:

```ts
let next: Holder = move(holder)
return move(holder)
target = move(holder)
target = makeHolder()
```

`move(holder)` consumes the source binding, moves its resource-field cleanup
metadata to the new owner, and prevents the original binding from being used or
destroyed afterward. For assignment, the previous resource fields owned by the
target are destroyed before the new owner metadata is installed.

The current model is enough to make function boundaries safe for direct
function calls while preserving stack-first local aggregates whenever the callee
only borrows.
