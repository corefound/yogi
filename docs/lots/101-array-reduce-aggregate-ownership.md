# Lot 101: Array Reduce Aggregate Ownership

## Goal

Make `reduce` and `reduceRight` safe when the accumulator owns runtime-managed
storage. Correct output alone was insufficient: the old lowering could mutate
the seed, retain two owners for one descriptor, or leak an intermediate
accumulator while still printing the expected value.

## Ownership Rule

```txt
seed or first element
  -> materialize one independent owned accumulator

callback result
  -> becomes the next owner

replaced accumulator
  -> destroy exactly once

final accumulator
  -> transfer to the caller
```

Normal callback invocation does not make the source array own the result.
Named by-value parameters for arrays, strings, objects, unions, and `any`
receive owned copies. This makes named and inline callback behavior converge
at the reduce loop boundary.

## Example

```ts
function append(accumulator: number[], value: number): number[] {
    accumulator.push(value)
    return accumulator
}

let seed: number[] = [10]
let result: number[] = [1, 2, 3].reduce(append, seed)

result[0] = 99

print(seed[0])   // 10
print(result[0]) // 99
```

The seed remains valid and unchanged. LLVM clones it once for the initial
accumulator, destroys replaced accumulator descriptors inside the loop, and
leaves the final descriptor for the result binding cleanup.

## Supported Accumulators

```txt
primitive values
strings
arrays and tuples
object/type-literal values
union and any boxes
real structs containing primitive-only fields
```

The runtime now exposes `yogi_object_clone` so object callback parameters and
object seeds use the existing recursive `ObjectValue::clone` policy.

## Rejections

An inline callback cannot return a source element borrow or captured aggregate
owner as the next accumulator. Such a return would make the reduce result
claim storage it does not own.

Real structs containing managed fields are also rejected for now. Their
callback boundary needs a field-level transfer contract before the compiler
can distinguish a returned accumulator from a fresh resource-bearing struct
without double destruction.

## Deep Bug Found

`yogi_string_concat` allocated a runtime string without registering it in the
runtime-owned string registry. LLVM emitted `yogi_string_destroy`, but the
runtime could not recognize or free the pointer. The primitive now allocates
through the registered runtime-string path, so strict Program Observability
reports zero live strings.

## Validation

```txt
tests/runtime/sessions/02-variables-aggregates/array_reduce_aggregate_ownership.cmake
tests/programs/array_reduce_aggregate_report.cmake
tests/programs/manifests/array_reduce_aggregate_report.json
```

The Program Test verifies LLVM IR, object and executable generation, runtime
output, reducer invariants, cleanup paths, and `allowLive: []`.
