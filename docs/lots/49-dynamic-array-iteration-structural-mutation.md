# Lot 49: Dynamic Array Iteration and Structural Mutation

This lot makes dynamic-array `for...of` predictable when the array is
structurally mutated during iteration.

Yogi does not reject mutation just because an array is being iterated. Instead,
the compiler chooses between two lowering strategies:

```txt
no possible structural mutation -> fast indexed iteration
possible structural mutation    -> stable slot-identity iteration
```

## Fast Path

When the loop body cannot structurally mutate the iterated array, `for...of`
continues to lower to direct indexed access:

```ts
let values: number[] = [1, 2, 3]

for (let value: number of values) {
    print(value)
}
```

The generated LLVM uses normal array length/get runtime calls and does not
allocate an iteration plan.

## Stable Slot Plan

When mutation is possible, Yogi creates a small runtime iteration plan at loop
entry. The plan stores the initial element slot identities, not copies of full
array values.

```txt
array at loop start: [A, B, C]
stable plan:         [slot(A), slot(B), slot(C)]
```

Rules:

- Slots appended after the loop starts are not visited by that loop.
- Planned slots removed before their turn are skipped.
- Surviving planned slots remain visitable even if their logical index changes.
- `sort()` and `reverse()` mutate the array immediately but do not reorder the
  active plan.
- Whole-array assignment preserves planned slots that survive the replacement.

## Value vs Pointer Iteration

By-value iteration stays explicit:

```ts
for (let value: number of values) {
    value = 99
}
```

`value` is a normal loop local. It is not an implicit pointer to the array slot.

Pointer iteration is also explicit:

```ts
for (let value: ptr<number> of values) {
    value = 99
}
```

Here the loop variable points to the current planned slot. If that slot survives,
writes update the array. If the slot is removed, the existing dynamic-array
pointer invalidation rules apply when the pointer is used.

## Nested Mutation

Calls that receive `&array` from inside the loop select the stable path because
the callee can mutate the caller's array descriptor:

```ts
function drop(users: ptr<number[]>): void {
    users.shift()
}

let values: number[] = [1, 2, 3]

for (let value: number of values) {
    drop(&values)
}
```

Runtime slot state remains the source of truth. A `shift()` on an empty dynamic
array returns `undefined` and removes nothing; strict indexing such as
`values[0]` on an empty array still reports the normal range error.

## Runtime ABI

The stable path lowers through internal runtime calls:

```txt
yogi_array_iteration_plan
yogi_array_iteration_plan_length
yogi_array_iteration_plan_valid
yogi_array_iteration_plan_value
yogi_array_iteration_plan_pointer
yogi_array_iteration_plan_destroy
```

These calls are compiler/runtime implementation details. User code does not call
them directly.

## Tests

Covered by:

```txt
tests/runtime/sessions/04-control-flow/dynamic_array_iteration_mutation.cmake
```

The suite covers:

- fast path IR without a stable plan
- push/unshift not visiting appended or inserted slots
- shift/splice skipping removed planned slots
- reverse/sort preserving active plan order
- whole-array assignment with surviving and removed planned slots
- value iteration not acting as an implicit pointer
- explicit `ptr<T>` iteration mutating original slots
- nested `ptr<T[]>` mutation through calls
- nested shifts, including shift on an empty array
- runtime invalidated-pointer diagnostics after removed slots
- strict empty-array indexing still reporting a range error
- break, continue, and return behavior

## Remaining Work

- Make synthetic stable-plan cleanup unconditional on every early `return` path
  once Yogi has a general defer/finally-style cleanup hook.
- Improve interprocedural mutation summaries beyond the current syntactic
  `&array` call-site detection.
