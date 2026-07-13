# Lot 55 - Persistent Closure Capture Boundary

This lot defines the current boundary between supported array callbacks and
future first-class closures.

Yogi supports inline callbacks that are passed directly to array methods. Those
callbacks are lowered inside the array loop, so captured locals remain inside
the same active function lifetime:

```ts
function readRow(): number {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    let row: number[3] = matrix[1]
    let indexes: number[] = [0, 1, 2]
    let values: number[] = indexes.map((index: number): number => {
        return row[index]
    })

    return values[0] * 100 + values[1] * 10 + values[2]
}
```

That remains valid because the callback does not escape.

Persistent function values are different. They need a real closure object,
capture environment, capture ownership summary, and cleanup scheduling. Without
that runtime representation, a closure that captures a borrowed view could keep
a reference to stack storage after the owner has gone out of scope.

Rejected examples:

```ts
function makePicker(): (index: number) => number {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    let row: number[3] = matrix[1]

    return (index: number): number => row[index]
}
```

```ts
function run(): number {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    let row: number[3] = matrix[1]
    let pick: (index: number) => number = (index: number): number => {
        return row[index]
    }

    let indexes: number[] = [0]
    let values: number[] = indexes.map(pick)
    return values[0]
}
```

The compiler now rejects these paths before FlatBuffers or LLVM lowering.

## Current Rule

```txt
Immediate array callback:
  supported, may capture locals, lowered in place.

Module-level named callback:
  supported when it does not require a closure environment.

Local function value / returned function expression / function expression
passed to a normal function:
  rejected until closure environments and capture lifetime summaries exist.
```

## Tests

```txt
yogi_pipeline_array_persistent_closure_captures
```

The test verifies:

```txt
✅ immediate borrowed-view callback capture still compiles and runs
✅ returning an anonymous closure is rejected
✅ local named arrow closure values are rejected
✅ passing an inline function expression as a persistent value is rejected
```

## Remaining Work

Real persistent closures still need:

```txt
closure heap/runtime representation
capture environment layout
capture ownership summaries
borrowed-view capture lifetime validation
closure cleanup scheduling
LLVM call lowering through closure values
```
