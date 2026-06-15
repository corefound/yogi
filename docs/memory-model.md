# Memory Model

Yogi is stack-first. Values should live locally unless the program semantics
require a longer lifetime.

The goal is a language with TypeScript-like syntax and systems-style ownership
semantics:

- A local variable dies when its scope ends.
- Objects, arrays, and tuples are not automatically heap values.
- Heap allocation is a special case, not the default.
- Escape analysis decides when a value needs a longer lifetime.

## Storage Classes

Current semantic storage classes:

| Storage | Meaning |
| --- | --- |
| `stack` | Local value owned by the current function or scope. |
| `heap` | Value escapes local lifetime and must survive past the local scope. |
| `global` | Module-level value or exported variable. |

## Current Escape Analysis

The current escape analysis is intentionally small and conservative.

Values are marked as escaping when:

- They are module-level globals.
- They are exported variables.
- A function returns a local aggregate identifier.
- A local aggregate aliases another aggregate that escapes.
- A local aggregate is assigned into a global aggregate or global variable.
- A local aggregate is passed to an unknown or external function call.
- A known callee summary says an aggregate parameter is returned, retained, or
  otherwise escapes.

Example:

```ts
function makeScores(): number[] {
    let scores: number[] = [1, 2, 3]
    return scores
}
```

`scores` escapes because it is returned from the function.

Example:

```ts
function makeScores(): number[] {
    let original: number[] = [1, 2, 3]
    let alias: number[] = original
    return alias
}
```

Both `alias` and `original` escape. The analysis propagates escape from the
returned alias back to the aggregate that owns the storage.

Example:

```ts
let globalScores: number[] = [0]

function storeScores(): void {
    let local: number[] = [7, 8]
    let alias: number[] = local
    globalScores = alias
}
```

`local` escapes because its alias is stored in a global. The generated LLVM uses
heap-backed runtime creation for `local` instead of a local descriptor cleanup.

Example:

```ts
function consume(scores: number[]): void {
}

function run(): void {
    let local: number[] = [1, 2]
    consume(local)
}
```

`local` does not escape when `consume` is a known internal function whose summary
says the parameter is only borrowed. Unknown or external calls still escape
conservatively.

Example:

```ts
function total(): number {
    let scores: number[] = [1, 2, 3]
    return scores[0] + scores[1]
}
```

`scores` does not escape. Its descriptor can live on the stack and be cleaned up
before return.

## Aggregate Storage

For this phase, aggregate descriptors can be stack allocated when they do not
escape. Their internal buffers still use the runtime allocator.

Current behavior:

- Object descriptor: local `alloca` when non-escaping.
- Array descriptor: local `alloca` when non-escaping.
- Object properties buffer: runtime allocator.
- Array element buffer: runtime allocator.
- Cleanup: `yogi_object_drop` or `yogi_array_drop`.

This is a real stack-first step because the aggregate identity is local and does
not require a heap descriptor. Fully inline object and tuple layouts can be added
later when type layout lowering is more complete.

## Automatic Cleanup

Local non-escaping aggregates are cleaned up automatically by generated LLVM.
The user does not call `free`, `drop`, or `delete`.

The current backend emits cleanup calls when a local aggregate leaves its block
or when the function returns. Cleanup is now scheduled on control-flow exits,
including early returns inside `if`/`else` branches:

```text
yogi_object_drop
yogi_array_drop
```

That behavior is RAII-like for stack-owned aggregate descriptors: construction
happens at declaration, and cleanup is emitted at the end of the lifetime.
Returned aggregate identifiers move ownership to the caller, so their cleanup is
deactivated only on the return path that moves them.

Escaping heap aggregates are different. The semantic analyzer detects the escape
and prevents stack cleanup from destroying a value that outlives the scope.
Function return of an aggregate is modeled as an ownership move to the caller;
the caller becomes responsible for later cleanup when it stores that result in a
local aggregate binding.

Module-owned heap aggregates already have automatic cleanup. The backend emits a
cleanup function per lowered module:

```text
_yogi_module_cleanup_<module>
```

The generated entry point calls module initializers first and module cleanups in
reverse order before process exit. Global aggregate variables are loaded from
their global slot and destroyed through:

```text
yogi_object_destroy
yogi_array_destroy
```

This covers module/global lifetime without requiring the user to release memory
manually.

## Runtime Allocator ABI

The runtime exposes allocator functions used by generated code and runtime
containers:

```c
void *yogi_alloc(unsigned long long size);
void *yogi_realloc(void *pointer, unsigned long long size);
void yogi_free(void *pointer);
```

The runtime can be configured for:

- mimalloc
- jemalloc
- system malloc fallback

## Limitations

This escape pass does not yet model:

- Block-scope destructors.
- Closures.
- Captured variables.
- Full inline typed object layout.
- Full tuple layout as fixed LLVM structs.
- Closures and captured values.
- Reference counting or shared ownership.
- Explicit move/consume syntax.
- Loop cleanup edges for `break` and `continue`.

Those are expected to be added in later passes.
