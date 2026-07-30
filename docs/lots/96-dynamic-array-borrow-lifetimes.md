# Lot 96: Dynamic Array Borrow Lifetimes

## Question

What deep error can exist even when local `ptr<T[]>` operations and all current
array tests pass?

A pointer parameter can expose the dynamic array descriptor as a value:

```ts
function archive(values: ptr<number[]>): void {
    let view: number[] = values
    archived = view
}
```

Without an explicit lifetime policy, `view` could be registered as a second
owner, cleaned while `values` still uses it, or returned as a dangling
descriptor.

## Implemented Policy

Yogi now accepts aggregate read-through from `ptr<T[]>` in three consumer
contexts: explicitly typed variable initialization, assignment, and return.
The resulting behavior depends on the boundary.

### Local binding

```ts
let pointer: ptr<number[]> = &values
let view: number[] = pointer
```

`view` is a borrowed alias. It has no independent descriptor cleanup and
mutations are visible through `values`.

### Assignment to an existing dynamic array

```ts
archived = view
```

Normal assignment has value semantics. The compiler materializes an owned copy
before replacing the target:

```txt
temporary = view.copy()
yogi_array_move_replace_from(archived, temporary)
```

Slots in `archived` are preserved by index where possible. Only the
compiler-created temporary is consumed. The borrowed descriptor and its owner
remain alive and unchanged, and the borrowed descriptor itself is not installed
as a second owner.

### Return

```ts
function snapshot(values: ptr<number[]>): number[] {
    return values
}
```

A value return promises owned storage, so the compiler materializes an owned
array. The caller receives an independent descriptor and the borrowed source
continues to belong to its original owner.

## Resource-Owning Arrays

A shallow materialization is unsafe when the runtime descriptor says that its
elements own resources. The backend now emits:

```txt
yogi_array_assert_copyable(source)
```

before an array copy. The descriptor remains the runtime source of truth. If
the array owns resources, runtime aborts with a source-attributed ownership
diagnostic instead of producing two owners.

To return a resource-owning array, return its real owner by value. Do not try to
turn a `ptr<T[]>` borrow into an owned return.

## Lowering

The C++ lowering owner resolver now follows:

```txt
identifier
address-of target
pointer read-through
element/property projection
borrowed-return call metadata
borrowed-view alias chains
```

Dynamic pointer read-through aliases are registered in the same aggregate-owner
graph used by fixed-shape views.

## Tests

Focused pipeline:

```txt
tests/runtime/sessions/02-variables-aggregates/dynamic_array_escaping_borrows.cmake
```

It verifies local aliases, direct and transitive calls, assignment replacement,
owned return materialization, LLVM IR, object generation, linking, execution,
and clean runtime diagnostics.

Strict Program Test:

```txt
tests/programs/dynamic_array_borrow_archive.cmake
tests/programs/manifests/dynamic_array_borrow_archive.json
```

It combines aliases, pointer parameters, forwarding, global replacement,
snapshots, early return, loops, `continue`, `break`, discarded owned returns,
stress replacements, and `allowLive: []`.

Lot 97 strengthens this rule for every normal dynamic-array assignment and
adds direct source-independence coverage.

Runtime negative coverage verifies that materializing a resource-owning
descriptor aborts before a shallow copy can occur.

## Remaining Boundary

This lot does not add dynamic-rank slices or a public view type. It closes
lifetime behavior for the existing one-dimensional dynamic `T[]` descriptor.
Still pending:

```txt
boxed object-property payload ownership
union/any aggregate lifetime completion
uniform cleanup for scalar methods on anonymous array receivers
dynamic rank metadata and dynamic shaped slices
```
