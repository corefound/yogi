# Lot 95: Array Expression Lifetime and Box Ownership

## Goal

Close two memory debts that could survive functional tests:

```txt
1. Anonymous owned arrays passed directly into calls had no caller cleanup.
2. Runtime AnyValue wrappers stored in array slots had no ownership model.
```

A program could print correct values while leaking every temporary
descriptor and every boxed primitive. This lot makes those lifetimes
explicit from LLVM lowering through runtime destruction.

## Runtime Contract

Every heap `AnyValue` starts with one owning reference. `undefined` and
`null` are immortal static values.

```txt
array insertion      consumes one box reference
primitive copy       creates a new primitive box
aggregate copy       recursively clones its owned value graph
pointer-field copy   copies the raw pointer without cloning the pointee
array move           transfers without retaining
slot replacement     releases the old box
array destruction    releases every active box
discarded extraction destroys the resource payload, then releases the box
```

The array descriptor carries a `boxedElements` policy. This lot originally
lowered `ptr<T>[]` as unboxed cells. Lot 99 superseded that compiler policy:
normal Yogi `ptr<T>[]` values now store `YOGI_ANY_POINTER` boxes so reads,
copies, and cleanup use one representation. Releasing that box never destroys
the borrowed pointee. Explicit unboxed pointer descriptors remain available
only to low-level runtime/native paths. Views and derived arrays inherit the
policy from their source.

## LLVM Lowering

The backend emits:

```txt
yogi_array_set_boxed_elements
yogi_array_copy_element
yogi_array_clone
yogi_array_destroy
```

Array literals initialize the policy before population. Runtime-created
copy/callback arrays receive the same policy. Copy-producing paths use the
central recursive element copier before installing values into their result.

Owned argument expressions are destroyed after the call unless the
callee effect explicitly consumes or retains them:

```ts
sum(makeSeries(1))
sum([10, 11, 12])
matrixTotal(makeMatrix(1))
```

Copy-method receiver chains also release intermediate owned descriptors:

```ts
sum(makeSeries(5).toReversed().slice(1, 3))
```

## Deep Program Test

`array_expression_lifetime_report` validates:

```txt
dynamic arrays and fixed-shape matrices
direct literal and function-return arguments
spreads and copy-producing methods
filter callbacks
pop/shift discarded cleanup
raw ptr<T>[] descriptor policy
normal exit, early return, continue, and break
repeated stress-loop allocation
LLVM IR, object file, final executable, and runtime output
```

Its observability result is strict:

```txt
allowLive: 0
anomalies: 0
completed frames: 43
dynamic cleanup generations: 29
```

## Tests

```txt
yogi_runtime_cast_test
yogi_runtime_array_storage_test
yogi_pipeline_array_expression_lifetime
yogi_program_array_expression_lifetime_report
```

The runtime storage test also proves that clone/copy destruction returns to
the original allocation baseline. It separately covers the runtime's explicit
unboxed-pointer mode, while the Array Expression Lifetime Program Test covers
the compiler-facing boxed `ptr<T>[]` representation.

## Remaining Work

Follow-up status:

```txt
dynamic-shape escaping views still need complete lifetime analysis
union/any aggregate lifetime remains incomplete
recursive boxed array/object/struct payload copies are complete
boxed object-property payload ownership metadata is complete
scalar-returning methods on anonymous array receivers need one uniform
full-expression cleanup mechanism
```
