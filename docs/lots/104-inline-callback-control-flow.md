# Lot 104: Inline Callback Control Flow

## Goal

Lower nested blocks, `if/else`, and early returns inside immediate array
callbacks without losing callback-local ownership or executing cleanup on the
wrong path.

The implementation applies to every inline callback method currently exposed
by arrays, including mapping, predicates, searching, iteration, flattening, and
reduction.

## LLVM Control Flow

Each inline callback invocation creates:

```txt
callback.return.value  // non-void callbacks only
callback.return        // shared callback exit
```

An early return follows this sequence:

```txt
evaluate and materialize return value
  -> store it in callback.return.value
  -> destroy active branch and callback owners in reverse order
  -> clear their cleanup slots
  -> branch to callback.return
```

At `callback.return`, lowering loads the selected value and continues the array
method loop. Multiple source returns therefore converge without merging raw
owner identities.

## Branch Lifetimes

```ts
values.reduce((accumulator: Report, value: number): Report => {
    let next: Report = accumulator

    if (value < 0) {
        let reset: Report = createReset(value)
        return reset
    }

    return next
}, seed)
```

On the negative path, `reset` becomes the independent callback result before
`reset`, `next`, and the callback parameter are cleaned. On the normal path,
the first branch never executes, so those outer owners remain alive until the
final return.

Nested lexical blocks have independent local maps and cleanup boundaries.
Locals from one branch cannot leak into another branch or after the block.

## Fully Returning If/Else

```ts
if (condition) {
    return accumulator
} else {
    return fresh
}
```

Both branches target the shared callback exit. The synthetic merge block is
unreachable, preventing later statements from being lowered as if execution
could fall through.

## Supported Inline Control Flow

```txt
nested blocks
if
if/else
nested if/else
early return
multiple return paths
branch-local primitive and managed locals
void callback fallthrough
```

## Boundary Superseded by Lot 105

At the end of this lot, `while`, `for`, `switch`, `break`, and `continue`
remained rejected inside inline callbacks. Lot 105 subsequently implemented
those constructs with callback-local control frames and path-aware cleanup.
The LLVM backend still rejects genuinely unknown inline statements
defensively, so malformed SIR cannot silently omit control flow.

## Deep Failure Prevented

A simplistic inline walker can ignore an `if` node and execute only statements
outside it. The resulting executable may pass compilation while producing
incorrect values or leaking branch-local resources.

The recursive callback lowerer now builds the real CFG and proves cleanup at
every return. Unsupported control flow fails before LLVM generation rather
than disappearing from the program.

## Validation

```txt
tests/runtime/sessions/02-variables-aggregates/array_inline_callbacks.cmake
tests/runtime/sessions/02-variables-aggregates/array_reduce_aggregate_ownership.cmake
tests/programs/inline_reduce_control_flow_report.cmake
tests/programs/manifests/inline_reduce_control_flow_report.json
```

Focused tests cover `map`, `filter`, `some`, `every`, `findIndex`, `forEach`,
managed `reduce`, nested blocks, both-returning branches, and borrow rejection.
Loop and switch coverage continues in
`docs/lots/105-inline-callback-loop-switch.md`.

The Program Test adds nested managed structs, arrays, strings,
object/type-literal fields, repeated early returns, seed isolation, by-value
inspection, outer function control flow, LLVM CFG checks, sanitizer
integration, and strict `allowLive: []` observability.
