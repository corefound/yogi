# Aggregate Assignment Ownership

Aggregate assignment covers statements where an aggregate/resource value is assigned
to another binding:

```ts
target = source
```

For this lot, the important plain identifier path is:

```ts
let saved: number[] = [0]

function store(): void {
    let scores: number[] = [1, 2, 3]
    saved = scores
}
```

`scores` is a local aggregate owner. `saved` is module/global storage.
Resource-owning structs may use compiler-internal ownership transfer, but
dynamic arrays have value semantics: assignment copies `scores`, then replaces
`saved` in place by preserving, creating, and invalidating target slots by
index. The RHS local descriptor remains alive and unchanged.

## Ownership Rules

| Assignment | Meaning | Cleanup behavior |
|---|---|---|
| local dynamic array -> global/module binding | Independent array value is stored in module storage | RHS owner remains active; global/module cleanup owns the copied value |
| local dynamic array -> local binding | Destination becomes an independent owner | Both bindings receive their own descriptor cleanup |
| borrowed dynamic-array view -> owned binding | Borrow is materialized as an independent owner | View keeps no cleanup; destination owns and cleans the copy |
| `ptr<T[]>` -> explicitly typed local `T[]` | Explicit local borrow | Local view aliases the pointer target and does not register a second owner |
| returned aggregate -> global/module binding | Return moves to caller, then assignment moves into module storage | Callee does not clean the returned value; global/module cleanup owns it |
| global/module aggregate replacement | New aggregate replaces old aggregate in module storage | Previous global value is destroyed before storing the replacement |
| dynamic array -> initialized dynamic array binding | Target descriptor is replaced in place by slot | Preserved slots stay valid, new slots are created, removed slots are invalidated; RHS descriptor cleanup remains separate |

Primitive values such as `number` and `boolean` keep value-copy behavior and do
not participate in aggregate ownership transfer.

## Local To Global

```ts
let saved: number[] = [0]

function store(): void {
    let scores: number[] = [1, 2, 3]
    saved = scores
}

function main(): number {
    store()
    return saved[0]
}
```

Expected dynamic-array behavior:

1. `scores` owns its local array descriptor after declaration.
2. `saved = scores` overwrites `saved`'s dynamic-array slots in place.
3. Common indexes are preserved by slot identity.
4. Extra target slots are invalidated if `scores` is shorter.
5. `scores` can be cleaned normally after the assignment.
6. `saved[0]` remains valid after `store()` returns because the value was copied
   into module-owned storage.

The backend path is `ValueLowerer::lowerAssignment`, not
`lowerAggregateAssignment`. `lowerAggregateAssignment` handles property/index
targets such as `object.field = value` or `array[index] = value`.

## Local Alias Chains

```ts
let saved: number[] = [0]

function store(): void {
    let scores: number[] = [1, 2, 3]
    let alias: number[] = scores
    saved = alias
}
```

Despite the historical variable name, `alias` is now an independent owned copy.
When `saved = alias` executes, `saved` receives another owned value and both
`scores` and `alias` remain valid. Sharing requires `ptr<number[]>`.

## Returned Aggregate To Global

```ts
let saved: number[] = [0]

function make(): number[] {
    let scores: number[] = [1, 2, 3]
    return scores
}

function store(): void {
    saved = make()
}
```

`return scores` moves ownership from the callee to the caller. For dynamic
arrays, the assignment in `store()` replaces the existing `saved` descriptor
in place from the returned descriptor, then the temporary returned descriptor can
be destroyed. The callee still skips cleanup for `scores`, and `saved` remains
valid after `store()` returns.

## Global Reassignment

```ts
let saved: number[] = [0]

function store(): void {
    let first: number[] = [1, 2, 3]
    saved = first

    let second: number[] = [4, 5, 6]
    saved = second
}
```

Replacing a global/module aggregate must not leak the previous value. For
non-dynamic aggregate globals, the backend emits this sequence:

1. Load the previous global value.
2. If the previous value is non-null and is not the same pointer as the new value,
   destroy the previous aggregate.
3. Store or replace from an owned copy of the new value.
4. Keep a named RHS active and unchanged.

This keeps `main()` returning `4` while avoiding both early-free and leaks for
the replaced global value.

Dynamic arrays materialize a copy and then use
`yogi_array_move_replace_from` on that temporary. The global descriptor stays
stable, common slots are overwritten, longer assignments create slots, shorter
assignments invalidate removed slots, and the source remains unchanged.

## Cleanup Rules After Assignment

Local cleanup is skipped only when the current scope no longer owns the resource.
The important cases are:

- RHS named dynamic array assigned into global/module storage: materialize an
  independent owned copy and keep the RHS owner active.
- RHS borrowed dynamic-array view assigned into global/module storage:
  materialize an independent owned copy; never install the borrowed descriptor
  as a second owner.
- RHS returned aggregate assigned to global/module storage: no local owner exists
  in the caller, so the global takes responsibility.
- Global/module replacement: destroy the previous global value before the store.
- Dynamic array assignment into an initialized binding: copy the observable RHS,
  then move-replace from the compiler-owned temporary instead of destroying the
  whole target descriptor.

This applies from normal functions, nested blocks, if/else branches, loops, and
switch cases. Cleanup remains control-flow aware through scope cleanup lists and
cleanup slots.

## Unsafe Cases

Switch fall-through keeps JavaScript/TypeScript shared-scope visibility, but
visibility is not the same as definite initialization:

```ts
let saved: number[] = [0]

function store(x: number): void {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]

        case 2:
            saved = scores
            break
    }
}
```

This is rejected because `x == 2` can enter `case 2` directly, where `scores`
was never initialized. The semantic diagnostic is:

```txt
variable 'scores' may be used before initialization
```

Explicit blocks still create separate scopes:

```ts
function test(x: number): number {
    switch (x) {
        case 1: {
            let value: number = 10
            return value
        }

        case 2: {
            let value: number = 20
            return value
        }

        default:
            return 0
    }
}
```

## Known Limitations

- Branch ownership merging is conservative. If a pre-branch aggregate escapes on
  one path, cleanup can be disabled after the branch even when another path did
  not escape. That is safe, but not maximally optimized.
- Generic fall-through through a parameterized `switch (x)` is rejected when a
  later clause can be entered before an earlier declaration. A literal
  `switch (1)` can be proven safe for the direct-entry path.
- Property and element assignment ownership is separate from plain identifier
  assignment and should continue to be audited as object/member semantics grow.
- This is not a Rust-style borrow checker. The model is RAII-like: creator owns
  by default, return moves, normal calls borrow unless summaries prove escape,
  and cleanup happens automatically when the current scope still owns the value.
