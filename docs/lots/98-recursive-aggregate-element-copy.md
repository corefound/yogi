# Lot 98: Recursive Aggregate Element Copy

## Goal

Make normal array value semantics recursive. A copy of `Point[]`,
`number[][]`, or a struct containing arrays must own an independent nested
value graph rather than sharing boxed runtime payloads.

## Central Copy Contract

The runtime exposes one recursive operation:

```txt
AnyValue::cloneOwned
  primitive       -> new box
  string          -> new Yogi-owned string
  array           -> ArrayValue::clone
  object/struct   -> ObjectValue::clone
  ptr<T> property -> copy raw pointer identity
```

`ArrayValue::copyElement` is the array-facing entry point. LLVM lowering uses
it for array clones, spreads, slices, filters, `copyWithin`, and other
copy-producing paths. Assignment and borrowed-return materialization use
`yogi_array_clone`; the internal move-replacement operation only commits the
already materialized temporary.

## Object Property Ownership

Runtime object properties now record:

```txt
boxed
ownsPayload
```

Normal struct/object fields own their boxed payload. Pointer fields are stored
unboxed. Temporary object wrappers created only for formatted printing mark
their payloads borrowed. Property replacement destroys the previous owned
payload and releases its box before installing the new value.

This metadata fixed a leak that functional output alone did not reveal:
assigning repeatedly to a nested boxed property used to replace the cell
without releasing its old box.

## Alias-Safe Assignment

`yogi_array_replace_from` first clones the complete source and only then
commits it with the internal move-replacement operation. This supports:

```ts
values = values
values = borrowedViewOfValues
```

without reading source slots after they have been overwritten. The target is
unchanged until materialization completes. Runtime allocation failure remains
fatal rather than recoverable.

## Non-Copyable Resources

Semantic analysis recursively classifies structs, nested structs, arrays,
tuples, type literals, unions, and intersections. Exclusive native resource
fields reject normal copy and report paths such as:

```txt
payload.resource
```

The runtime descriptor keeps its defensive resource-owning check, so malformed
or stale metadata cannot silently create two owners.

## Coverage

```txt
compiler frontend:
  recursively copyable nested shapes are accepted
  native-resource field paths are diagnosed

runtime unit:
  nested object/array copies are independent
  ptr<T> properties preserve identity
  destruction returns aggregate counters to zero
  self-assignment and overlapping-view replacement are safe

strict Program Test:
  tests/programs/recursive_aggregate_array_copy_report.cmake
  tests/programs/manifests/recursive_aggregate_array_copy_report.json
  allowLive: []
```

The Program Test covers nested arrays, structs containing arrays, nested
structs, borrowed views, borrowed returns, value parameters, self-assignment,
aliasing replacement, pointer fields, loops, `continue`, `break`, LLVM IR,
object generation, linking, exact output, and cleanup observability.

## Remaining Boundaries

- Union/`any` aggregate narrowing and runtime classification need their own
  focused lot.
- Arbitrary cyclic owned object graphs are not supported.
- Native resources remain non-copyable until an explicit clone contract exists.
- Copy allocation failure is fatal; Yogi has no recoverable exception model.
