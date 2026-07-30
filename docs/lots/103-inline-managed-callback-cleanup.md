# Lot 103: Inline Managed Callback Cleanup

## Goal

Complete owned cleanup for inline `reduce` and `reduceRight` callbacks that use
managed struct locals or choose different owners through conditional
expressions.

The callback must return one independent next accumulator while cleaning every
temporary owner that is no longer needed.

## Ownership Model

For a copyable managed struct accumulator, lowering now performs:

```txt
clone loop accumulator for the inline callback
  -> register the callback parameter as an owned slot
  -> materialize managed callback locals as independent owners
  -> evaluate each ternary branch independently
  -> clone the selected branch into the callback result
  -> destroy fresh branch temporaries
  -> destroy callback locals and the parameter clone in reverse order
  -> pass exactly one owned result back to reduce
```

The previous loop accumulator is destroyed only after the callback has
produced its independent result.

## Managed Local

```ts
let result: Report = values.reduce(
    (accumulator: Report, value: number): Report => {
        let next: Report = accumulator
        next.values.push(value)
        return next
    },
    seed
)
```

`next` is an independent owner. The return materializes the next accumulator,
then the callback destroys `next` and its parameter clone.

## Branch-Aware Return

```ts
return value < 0
    ? {
        values: [0],
        label: "reset"
    }
    : accumulator
```

LLVM emits separate ownership blocks for both branches. The fresh branch is
copied into the result and its temporary is destroyed. The accumulator branch
is copied into the result and remains owned by its cleanup slot until callback
cleanup. Nested ternary expressions use the same recursive rule.

## Semantic Boundary

These forms are supported:

```txt
return accumulator
return managedLocal
return condition ? accumulator : freshValue
return condition ? managedLocal : freshValue
```

These forms remain rejected:

```txt
return borrowedSourceElement
return capturedAggregateOwner
use a pointer-bearing struct accumulator without a clone/transfer contract
```

Lot 104 supersedes the original statement-level limitation from this lot:
nested blocks, `if/else`, and early returns now lower with path-specific
cleanup. Loop and switch bodies remain a separate future control-flow lot.

## Deep Failure Prevented

Without branch-local materialization, LLVM could merge an owned parameter and
a fresh temporary into one PHI value without knowing which cleanup obligation
was active. Cleaning both caused double destruction; cleaning neither leaked.

The result now becomes independent inside each predecessor block, before the
branches merge. Cleanup therefore never depends on guessing which owner reached
the PHI.

## Validation

```txt
tests/runtime/sessions/02-variables-aggregates/array_reduce_aggregate_ownership.cmake
tests/programs/inline_reduce_branch_ownership_report.cmake
tests/programs/manifests/inline_reduce_branch_ownership_report.json
```

The focused pipeline covers managed locals, direct accumulator returns, fresh
replacement, mixed conditional ownership, borrowed-result rejection, LLVM
verification, and runtime output.

The Program Test combines nested managed structs, arrays, strings,
object/type-literal fields, nested ternaries, by-value function isolation,
early return, loop `continue`/`break`, LLVM ownership blocks, sanitizer
integration, and strict `allowLive: []` observability.
