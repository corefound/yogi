# Lot 100: Array Scalar Receiver Lifetime

## Goal

Close the full-expression lifetime of anonymous owned array receivers for
methods that return a scalar, an element, a string, or a callback result.

Before this lot, copy-producing methods already destroyed an anonymous source,
but several scalar and callback paths left the source descriptor alive:

```ts
print(makeValues().includes(20))
print(makeValues().join("-"))
print(makeValues().some(isPositive))
print(makeValues().at(-1) as number)
```

Visible output could be correct while the descriptor or result string leaked.

## Compiler Rule

```txt
owned temporary receiver:
  evaluate -> call -> materialize result -> destroy receiver

named owned receiver:
  evaluate -> call -> keep owner alive

ptr<T[]> or pointer-derived local view:
  evaluate -> call -> never destroy borrowed descriptor
```

Receiver-returning operations keep ownership available to the rest of the
chain. The operation that finally produces a scalar, element, string, or
property value closes the chain:

```ts
print([3, 1, 20].sort().length)
```

## Result Materialization

`at`, `find`, and `findLast` can return a value stored inside the receiver.
When the receiver is temporary, a boxed dynamic result is cloned before the
descriptor is destroyed. Primitive results are loaded by value.

`pop` and `shift` are different: the runtime removes the element box from the
array, so ownership of that result is already transferred before the remaining
descriptor is destroyed.

Supported `reduce`/`reduceRight` results are materialized before cleanup:

```txt
primitive       copied by value
string          copied to a runtime-owned string
union/any       recursively cloned AnyValue
array/tuple     recursively cloned descriptor
```

Arbitrary object/struct accumulators that retain nested borrows still need a
complete materialization or rejection policy.

## Dynamic Search Values

Array search methods consume one temporary reference to their boxed argument.
For a direct `union` or `any` variable, LLVM now retains that box before the
call:

```ts
let needle: number | string = "six"
let found: boolean = makeMixed().includes(needle)
print(needle as string) // still valid
```

This lot also corrected `boxAny`: union values now preserve their existing
runtime box instead of degrading to a null box.

## Runtime String Ownership

`ArrayValue::join` previously allocated a raw runtime buffer that was not
registered in the string ownership table. LLVM emitted
`yogi_string_destroy`, but the runtime ignored the unknown pointer.

The join buffer is now converted through the existing runtime-owned string ABI
and the intermediate formatting buffer is immediately released. `join`,
`toString`, and `toLocaleString` therefore participate in normal string
cleanup and memory telemetry.

## Covered Methods

```txt
length
push, unshift
pop, shift, at
includes, indexOf, lastIndexOf
join, toString, toLocaleString
toSorted
forEach, map, filter, flatMap
some, every
find, findIndex, findLast, findLastIndex
reduce, reduceRight
discarded pop/shift
```

## Tests

Focused pipeline:

```txt
tests/runtime/sessions/02-variables-aggregates/array_scalar_receiver_lifetime.cmake
```

Deep Program Test:

```txt
tests/programs/array_scalar_receiver_lifetime_report.cmake
tests/programs/manifests/array_scalar_receiver_lifetime_report.json
```

The Program Test verifies LLVM IR and runtime output while observability proves:

```txt
no live descriptors
no live result strings
no double-free
no use-after-free
balanced function frames
balanced cleanup obligations
borrowed ptr<T[]> receivers remain valid
```

## Remaining Limits

```txt
1. Callbacks must not retain an element borrow after the callback returns.
2. Arbitrary object/struct reduce accumulators that borrow nested receiver
   storage need a complete materialization or rejection policy.
3. A pointer projected from a temporary receiver never extends that
   receiver's lifetime.
```
