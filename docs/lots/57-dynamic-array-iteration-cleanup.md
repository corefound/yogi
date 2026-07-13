# Lot 57: Dynamic Array Iteration Cleanup

This lot closes the cleanup gap left by dynamic-array stable iteration.

When a `for...of` loop can structurally mutate the iterated array, Yogi lowers
the loop through a runtime stable iteration plan. That plan is an internal
runtime resource and must be destroyed on every exit path.

## Rule

```txt
Stable iteration plans are compiler-owned cleanup resources.
```

That means cleanup runs for:

- normal loop completion
- `break`
- `continue`
- early `return`

The frontend no longer emits a synthetic `__yogiStableDestroy()` statement after
the loop. Instead, the LLVM lowering phase registers the plan in the local
cleanup stack with `yogi_array_iteration_plan_destroy`.

For compatibility with already packaged frontend binaries that still emit the
old synthetic destroy call, lowering `__yogiStableDestroy()` also clears the
plan slot to `null`. The automatic cleanup path then skips that slot instead of
destroying it a second time.

## Example

```ts
function takeFirst(): number {
    let values: number[] = [1, 2, 3]

    for (let value: number of values) {
        values.push(9)
        return value
    }

    return 0
}
```

The `values.push(9)` forces stable iteration. The `return value` path now
destroys the stable plan before returning, and the fallthrough path still owns
normal cleanup.

## Tests

Covered by:

```txt
tests/runtime/sessions/04-control-flow/dynamic_array_iteration_mutation.cmake
```

The test suite verifies:

- stable iteration still emits the runtime plan ABI
- early-return stable iteration runs successfully
- the generated LLVM IR contains cleanup calls on both return and fallthrough
  paths
