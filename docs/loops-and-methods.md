# Loops And Aggregate Methods

This document tracks the loop and builtin aggregate method lot.

The purpose of this lot is to make loop control flow participate in the same
RAII-like pipeline as variables, ownership, move-state validation, destructor
scheduling, and LLVM lowering.

## What This Lot Adds

The compiler now carries these statements through the full pipeline:

```ts
while (condition) {
    // body
}

for (let i: number = 0; i < 10; i = i + 1) {
    // body
}

break
continue
```

They now flow through:

```text
TypeScript-style AST
  -> semantic validation
  -> SIR FlatBuffer
  -> C++ FlatBuffer reader
  -> LLVM IR
  -> object file
  -> final executable
```

The SIR schema has explicit nodes for:

```text
WhileStatement
ForStatement
BreakStatement
ContinueStatement
```

## Loop Move-State Rule

Loops are conservative. If an aggregate can be moved inside a reachable loop
body, the aggregate is considered moved after the loop because the loop may have
executed.

```ts
let saved: number[] = [0]

function save(scores: number[]): void {
    saved = scores
}

function invalid(flag: boolean): number {
    let local: number[] = [1, 2]

    while (flag) {
        save(local)
        break
    }

    return local[0]
}
```

`save(local)` moves local ownership into module storage. The later `local[0]`
is rejected by semantic analysis before LLVM IR is generated.

This is intentionally conservative. It prefers rejecting a questionable use over
allowing a use-after-move path.

## Break And Continue Cleanup

The LLVM backend tracks loop frames while lowering:

```text
LoopFrame:
  break target
  continue target
  cleanup start for break
  cleanup start for continue
```

When `break` or `continue` is lowered, the backend emits cleanup for aggregate
locals created inside the current loop body before branching.

Example:

```ts
for (let i: number = 0; i < 4; i = i + 1) {
    let scratch: number[] = [i]

    if (i == 2) {
        continue
    }
}
```

Before the `continue` branch jumps to the increment block, `scratch` is dropped.
The `for` initializer remains alive until the loop exits.

For `break`, body locals are dropped before jumping to the loop end block. The
loop end then cleans up any loop-scope initializer resources.

## Array Push

This lot also adds the first builtin aggregate method:

```ts
function grow(): number {
    let scores: number[] = [1]
    scores.push(2)
    return scores[1]
}
```

`push` is modeled as:

```text
receiver: mutating borrow
argument: value stored in the array
escape: false
return: number
```

The semantic analyzer validates:

- The receiver is a dynamic array.
- The array is mutable.
- The array is not readonly.
- Exactly one argument is passed.
- The argument type is assignable to the array element type.

For now, tuples reject `push` because tuple length is fixed.

The backend lowers `scores.push(value)` to:

```text
yogi_array_push(array, boxedValue)
```

The runtime grows the array buffer as needed and returns the new length as a
number-compatible value.

## Array And Tuple Length

Arrays and tuples expose a readonly `length` property:

```ts
let scores: number[] = [1, 2]
let before: number = scores.length
scores.push(3)
let after: number = scores.length

let pair: [number, string] = [7, "ready"]
let fixed: number = pair.length
```

Semantic analysis treats `length` as a builtin property, not as an object field.
It returns `number` and is readonly, so this is rejected:

```ts
scores.length = 10
```

The backend lowers `scores.length` and `pair.length` to:

```text
yogi_array_length(array)
```

Tuples currently share the same aggregate runtime representation as arrays, so
their fixed length is read from the descriptor that was initialized from the
tuple literal.

## Non-Callback Array Methods

Yogi now supports the array methods that can be expressed without callback
function values:

| Method | Mutates? | Return |
| --- | --- | --- |
| `push(value)` | yes | `number` |
| `pop()` | yes | `T | undefined` |
| `shift()` | yes | `T | undefined` |
| `unshift(...values)` | yes | `number` |
| `reverse()` | yes | `T[]` |
| `fill(value, start?, end?)` | yes | `T[]` |
| `copyWithin(target, start, end?)` | yes | `T[]` |
| `splice(start, deleteCount?, ...items)` | yes | `T[]` |
| `at(index)` | no | `T | undefined` |
| `includes(value, fromIndex?)` | no | `boolean` |
| `indexOf(value, fromIndex?)` | no | `number` |
| `lastIndexOf(value, fromIndex?)` | no | `number` |
| `slice(start?, end?)` | no | `T[]` |
| `concat(...values)` | no | `T[]` |
| `toReversed()` | no | `T[]` |
| `toSpliced(start, deleteCount?, ...items)` | no | `T[]` |
| `with(index, value)` | no | `T[]` |
| `forEach(callback)` | no | `void` |
| `map(callback)` | no | `U[]` |
| `filter(callback)` | no | `T[]` |
| `some(callback)` | no | `boolean` |
| `every(callback)` | no | `boolean` |
| `find(callback)` | no | `T | undefined` |
| `findIndex(callback)` | no | `number` |

Mutating methods require a mutable, non-readonly dynamic array. Tuples reject
mutating methods because their length and element layout are fixed.

`at`, `slice`, `includes`, `indexOf`, `lastIndexOf`, and `with` follow the
JavaScript index rules that matter for this stage. `with` supports negative
indexes and aborts with a runtime range diagnostic when the normalized index is
outside the array.

Callback methods currently accept named function references and expression-bodied
inline arrows:

```ts
function doubleValue(value: number): number {
    return value * 2
}

let doubled: number[] = scores.map(doubleValue)
let shifted: number[] = scores.map((value: number): number => value + 1)
```

Block-bodied callbacks and callbacks that capture outer locals are rejected
until Yogi has closure/lifetime semantics for captured values.

## Example

```ts
function grow(): number {
    let scores: number[] = [1]
    let i: number = 0

    while (i < 3) {
        scores.push(i)
        i = i + 1
    }

    let total: number = 0

    for (let j: number = 0; j < scores.length; j = j + 1) {
        let scratch: number[] = [j]

        if (j == 2) {
            continue
        }

        total = total + scores[j] + scratch[0]

        if (j == 3) {
            break
        }
    }

    return total
}
```

This program validates semantically, writes SIR FlatBuffers, lowers to LLVM,
generates an object file, links, and executes.

## Current Limitations

This lot is still not a full control-flow analysis engine. Remaining loop work:

- Path-sensitive move-state for branch-specific `break` and `continue`.
- `do while`.
- `for of` and `for in`.
- Loop-carried type narrowing.
- Block-bodied inline callbacks, closures, and callback methods that still need
  accumulator or iterator semantics such as `reduce`, `reduceRight`, `flatMap`,
  `findLast`, and `findLastIndex`.
- Comparator/string-dependent methods such as `sort`, `toSorted`, and `join`.
- Object helper methods.

The current behavior is enough for normal `while`, `for`, `break`, `continue`,
the non-callback array method set, and readonly `array.length`/`tuple.length`
while preserving stack-first cleanup rules.
