# Lot 07: Array With And Range Diagnostics

## Goal

This lot adds the non-mutating TypeScript/JavaScript array method:

```ts
with(index, value)
```

It also introduces the first runtime range diagnostic used by array APIs that
must fail instead of returning `undefined`.

## Semantics

`with` returns a new owned array. The original receiver stays valid and is not
mutated:

```ts
let scores: number[] = [1, 2, 3]
let changed: number[] = scores.with(1, 9)

print(scores[1])  // 2
print(changed[1]) // 9
```

Negative indexes are resolved from the end of the array:

```ts
let scores: number[] = [1, 2, 3]
let changed: number[] = scores.with(-1, 8)
```

The normalized index must exist. If it is outside the array, the executable
aborts with:

```txt
yogi runtime range error
```

This matches the important JavaScript behavior for `Array.prototype.with`: the
method is copy-producing, but invalid indexes are errors.

## Semantic Validation

The semantic pass validates:

- exactly two arguments
- `index` must be `number`
- `value` must be assignable to the receiver element type

```ts
let scores: number[] = [1, 2]
let ok: number[] = scores.with(0, 9)
let bad: number[] = scores.with(0, "bad") // semantic error
```

## Runtime And LLVM

The LLVM backend lowers `with` through:

```txt
yogi_array_with(array, index, boxedValue)
```

The runtime clones the receiver, writes the replacement into the clone, and
returns the clone as a new heap-owned aggregate. Local cleanup uses the same
aggregate ownership tracking as `slice`, `concat`, `toReversed`, and
`toSpliced`.

## Tests

- `yogi_runtime_cast_test` checks direct runtime `with` behavior.
- `yogi_runtime_range_negative_test` checks out-of-range abort diagnostics.
- `yogi_pipeline_array_with_range` checks semantic validation, LLVM IR symbols,
  executable output, and runtime range failure from generated code.

## Remaining Array Work

The next meaningful array lot is not another index method. It should establish
function values or callback lowering so methods like `forEach`, `map`,
`filter`, `reduce`, `find`, `some`, and `every` can be implemented correctly.
