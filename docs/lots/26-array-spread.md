# Lot 26 - Array Spread

This lot adds end-to-end support for array spread inside array literals.

## Goal

Yogi now accepts TypeScript-style spread syntax in array literals:

```ts
let tail: number[] = [2, 3]
let values: number[] = [1, ...tail, 4]
```

The behavior is strict and LLVM-friendly:

- Spread source must be an array or tuple.
- Spread elements must be assignable to the target element type.
- Dynamic array literals with spread lower through runtime push/get loops.
- Fixed-size 1D arrays accept spread only when the final length is known at compile time.
- Dynamic spread into fixed-size arrays is rejected for now because the fixed length cannot be proven.

## Examples

Dynamic arrays:

```ts
let tail: number[] = [2, 3]
let values: number[] = [1, ...tail, 4]

print(values[0]) // 1
print(values[3]) // 4
```

Fixed-size arrays:

```ts
let tail: number[3] = [20, 30, 40]
let values: number[5] = [10, ...tail, 50]
```

Tuple and union targets:

```ts
type Cell = number | string

let pair: [number, string] = [7, "x"]
let cells: Cell[] = [0, ...pair, "done"]
```

## Rejected Cases

Non-array spread source:

```ts
let bad: number[] = [...1]
// error: array spread expects an array or tuple
```

Dynamic spread into fixed-size array:

```ts
let values: number[] = [1, 2]
let fixed: number[3] = [0, ...values]
// error: cannot spread dynamic array into fixed-size array
```

Element type mismatch:

```ts
let text: string[] = ["x"]
let nums: number[] = [1, ...text]
// error: array spread can only contain number
```

## Pipeline

Parser/AST:

```txt
SpreadElement
  expression: value
```

Semantic:

```txt
Spread source type must be ArrayType or TupleType.
Tuple spread contributes each tuple element type.
Array spread contributes its array element type.
Fixed-size targets require compile-time-known spread length.
```

FlatBuffers/SIR:

```txt
ValueRef.spread -> SpreadElement
SpreadElement.expression -> ValueRef
SpreadElement.type -> TypeRef
```

LLVM:

```txt
dynamic literal:
  yogi_array_create(0)
  scalar elements -> yogi_array_push
  spread elements -> yogi_array_length/yogi_array_get/yogi_array_push

fixed-size 1D literal:
  yogi_array_create(fixedLength)
  scalar elements -> yogi_array_set
  spread elements -> yogi_array_length/yogi_array_get/yogi_array_set
```

## Tests

CTest:

```txt
yogi_pipeline_array_spread
```

The suite verifies:

- Dynamic array spread executes correctly.
- Fixed-size 1D spread executes correctly.
- Tuple spread into union arrays executes correctly.
- IR contains `yogi_array_push`, `yogi_array_get`, `yogi_array_set`, and `yogi_array_length`.
- Non-array spread fails semantically.
- Dynamic spread into fixed-size arrays fails semantically.
- Spread element type mismatch fails semantically.

## Remaining Work

- Spread inside multidimensional fixed-shape literals is intentionally rejected for now.
- Native LLVM fixed-array ABI would allow lowering fixed-size arrays without runtime descriptors.
- Runtime-checked conversion from dynamic arrays into fixed-size arrays can be added later as an explicit operation.
