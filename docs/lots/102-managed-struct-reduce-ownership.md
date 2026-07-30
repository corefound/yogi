# Lot 102: Managed Struct Reduce Ownership

## Goal

Allow `reduce` and `reduceRight` accumulators to be real structs containing
copyable runtime-managed fields. The compiler must preserve value semantics for
the seed and callback parameters while keeping exactly one owned accumulator
between iterations.

Supported managed fields include:

```txt
strings
dynamic arrays and tuples
object/type-literal values
union and any boxes
nested structs containing the same copyable field kinds
```

## Ownership Cycle

```txt
seed
  -> recursively clone every managed field
  -> call callback with an independent by-value struct
  -> transfer returned struct fields into the loop accumulator
  -> destroy the previous accumulator fields
  -> transfer final struct to the caller
```

Named callbacks clone managed struct parameters on entry. If the callback
returns that parameter, return lowering deactivates its cleanup and transfers
the clone. If it returns a fresh struct, normal return cleanup destroys the
unused parameter clone before transferring the fresh value.

Inline callbacks clone the accumulator before mutation. Returning the
accumulator transfers that clone. Returning a fresh expression destroys the
clone and transfers the fresh fields.

## Example

```ts
type Counters = {
    total: number
}

struct Trail {
    values: number[]
    label: string
}

struct Report {
    trail: Trail
    tags: string[]
    counters: Counters
}

function collect(accumulator: Report, value: number): Report {
    accumulator.trail.values.push(value)
    accumulator.trail.label = accumulator.trail.label + "+"
    accumulator.counters.total = accumulator.counters.total + value
    return accumulator
}

let seed: Report = {
    trail: { values: [10], label: "seed" },
    tags: [],
    counters: { total: 0 }
}
let report: Report = [1, 2, 3].reduce(collect, seed)
```

Mutating `report` does not mutate `seed`.

## Deep Bugs Closed

### Type aliases inside structs

A field declared with an object alias, such as `counters: Counters`, previously
reached LLVM as an unresolved opaque type reference. The field is now serialized
with its resolved type in SIR, allowing recursive clone and cleanup.

### Temporary object wrappers

Accessing a type-literal field inside a struct boxed the object only to unbox it
immediately. Those temporary `AnyValue` wrappers leaked. Lowering now uses the
field's object descriptor directly.

### Borrowed returns from copied structs

Managed by-value struct parameters now own independent field copies. Returning
`value.songs.at(1)` therefore cannot return a pointer into the parameter and
then destroy the parameter. Return lowering materializes borrowed string,
array, object, union, and nested aggregate projections before local cleanup.

### Printing borrowed string fields

`print(report.trail.label)` previously classified the property access as an
owned temporary and destroyed the struct's field after printing it. Subsequent
uses became a heap use-after-free. String temporary classification now treats
properties, elements, and dereferences as borrows; only genuinely owned
expressions are destroyed by `print`.

### Tuple literal callback typing

`[2, 4].reduceRight(...)` previously fell back to the reduce return type when
reading the tuple element type. LLVM then attempted to unbox each number as the
struct accumulator. Homogeneous tuple literals now expose their actual element
type to callback lowering.

### Dynamic boxes in structs

Recursive struct cleanup omitted `any` and union fields. They now participate
in the same field-level destruction walk as strings, arrays, and objects.

## Remaining Rejections

Pointer-bearing structs remain unsupported as reduce accumulators. A pointer
can represent a borrow or an exclusive native resource, so cloning its owner
cannot be inferred from the pointer type alone.

Borrowed source elements and captured aggregate owners also remain rejected as
the next accumulator.

Lot 103 supersedes the original inline-callback limitation from this lot:
managed struct locals and conditional accumulator/fresh selection now use
callback-local cleanup slots and branch-aware result materialization.

## Validation

```txt
tests/runtime/sessions/02-variables-aggregates/array_reduce_aggregate_ownership.cmake
tests/programs/managed_struct_reduce_report.cmake
tests/programs/manifests/managed_struct_reduce_report.json
```

The focused pipeline verifies positive and negative semantics plus LLVM clone
and cleanup calls. The Program Test verifies a complete executable with early
return, fresh replacement, named and inline callbacks, `reduceRight`, by-value
function isolation, loops, cleanup reducers, and strict `allowLive: []`.
