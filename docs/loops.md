# Loops, Aggregate Methods, And Iterator Protocol

This document tracks Yogi's loop control flow, builtin aggregate methods, and early iterator protocol support.

The purpose of this lot is to make loops participate in the same RAII-like pipeline as variables, ownership, move-state validation, destructor scheduling, FlatBuffer serialization, LLVM lowering, object generation, and final executable output.

## Current Loop Support

Yogi currently supports:

```ts
while (condition) {
    // body
}

for (let i: number = 0; i < 10; i = i + 1) {
    // body
}

for (let value: number of values) {
    // body
}

break
continue
```

These statements now flow through the full compiler pipeline:

```txt
TypeScript-style parser
  -> Yogi AST
  -> semantic validation
  -> SIR FlatBuffer
  -> C++ FlatBuffer reader
  -> LLVM IR
  -> object file
  -> final executable
```

The SIR schema has explicit nodes for:

```txt
WhileStatement
ForStatement
ForOfStatement
BreakStatement
ContinueStatement
```

## While Loops

`while` follows the TypeScript syntax surface:

```ts
let i: number = 0
let total: number = 0

while (i < 4) {
    total = total + i
    i = i + 1
}
```

The condition is checked before each iteration. Locals created inside the loop body are cleaned up at the end of each iteration, and also before control leaves through `break`, `continue`, or `return`.

## Classic For Loops

Classic `for` also follows the TypeScript syntax surface:

```ts
let total: number = 0
let values: number[] = [1, 2, 3]

for (let index: number = 0; index < values.length; index = index + 1) {
    total = total + values[index]
}
```

The initializer lives for the full loop lifetime.

That means an aggregate created by the initializer is cleaned after `for.end`, not before the first condition check and not after each iteration.

Conceptually:

```ts
for (
    let scratch: number[] = [0];
    condition;
    increment
) {
    // body
}

// scratch is cleaned here
```

## Break And Continue Cleanup

The LLVM backend tracks loop frames while lowering:

```txt
LoopFrame:
  break target
  continue target
  cleanup start for break
  cleanup start for continue
```

When `break` or `continue` is lowered, the backend emits cleanup for aggregate locals created inside the current loop body before branching.

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

For `break`, body locals are dropped before jumping to the loop end block. The loop end then cleans up any loop-scope initializer resources.

## Loop Move-State Rule

Loops are conservative.

If an aggregate can be moved inside a reachable loop body, the aggregate is considered moved after the loop because the loop may have executed.

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

`save(local)` moves `local` ownership into module storage.

The later `local[0]` is rejected by semantic analysis before LLVM IR is generated.

This is intentionally conservative. Yogi prefers rejecting a questionable use over allowing a possible use-after-move path.

## For Of

`for...of` is supported for arrays, strings, and array-producing methods.

```ts
let total: number = 0
let values: number[] = [3, 1, 20]

for (let value: number of values) {
    total = total + value
}
```

The loop variable must have an explicit type annotation, matching Yogi's strict type rules:

```ts
for (let value: number of values) {
    print(value)
}
```

This is rejected:

```ts
for (let value of values) {
    print(value)
}
```

## String Iteration

Strings are indexable and iterable:

```ts
let text: string = "yogi"

for (let ch: string of text) {
    print(ch)
}
```

String iteration can currently read and print characters.

String concatenation is not part of this iterator lot yet. Concatenating characters into a new string belongs to future string-method work.

## Array Iterator Methods

Until Yogi has lazy iterator objects, these methods materialize arrays:

```ts
values.keys()    // number[]
values.values()  // T[]
values.entries() // [number, T][]
```

That makes them usable with `for...of` today:

```ts
for (let key: number of values.keys()) {
    print(key)
}

for (let value: number of values.values()) {
    print(value)
}

for (let entry: [number, number] of values.entries()) {
    print(entry[0] + entry[1])
}
```

Destructuring bindings are supported when the binding has an explicit type:

```ts
for (let [index, value]: [number, number] of values.entries()) {
    print(index + value)
}
```

Current `for...of` bindings support:

```txt
identifier binding
array destructuring binding
object destructuring binding
```

All loop bindings must have explicit type annotations.

## For Of Lowering Model

The visitor desugars `for...of` into the existing classic `for` pipeline.

This:

```ts
for (let value: number of values) {
    total = total + value
}
```

is lowered conceptually as:

```ts
for (
    let __yogi_for_of_iterable_0: number[] = values,
        __yogi_for_of_index_0: number = 0;
    __yogi_for_of_index_0 < __yogi_for_of_iterable_0.length;
    __yogi_for_of_index_0 = __yogi_for_of_index_0 + 1
) {
    let value: number = __yogi_for_of_iterable_0[__yogi_for_of_index_0]
    total = total + value
}
```

This keeps the full loop pipeline intact:

```txt
TypeScript parser
  -> Yogi AST
  -> semantic IR
  -> SIR FlatBuffer
  -> LLVM
  -> executable
```

## For Of Ownership

If the iterable expression creates an aggregate, that aggregate belongs to the hidden loop initializer and is cleaned after the loop exits.

```ts
for (let score: number of makeScores()) {
    print(score)
}
```

`makeScores()` is evaluated once, stored in a hidden loop temp, and the temp is destroyed after the loop.

Conceptually:

```ts
let __yogi_for_of_iterable_0: number[] = makeScores()

for (let __yogi_for_of_index_0: number = 0; __yogi_for_of_index_0 < __yogi_for_of_iterable_0.length; __yogi_for_of_index_0 = __yogi_for_of_index_0 + 1) {
    let score: number = __yogi_for_of_iterable_0[__yogi_for_of_index_0]
    print(score)
}

// __yogi_for_of_iterable_0 is cleaned here
```

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

```txt
yogi_array_length(array)
```

Tuples currently share the same aggregate runtime representation as arrays, so their fixed length is read from the descriptor initialized from the tuple literal.

## Builtin Array Methods

Yogi supports the array methods that can currently be expressed without full closure/lifetime semantics.

| Method                                     | Mutates? | Return          |            |
| ------------------------------------------ | -------- | --------------- | ---------- |
| `push(value)`                              | yes      | `number`        |            |
| `pop()`                                    | yes      | `T              | undefined` |
| `shift()`                                  | yes      | `T              | undefined` |
| `unshift(...values)`                       | yes      | `number`        |            |
| `reverse()`                                | yes      | `T[]`           |            |
| `fill(value, start?, end?)`                | yes      | `T[]`           |            |
| `copyWithin(target, start, end?)`          | yes      | `T[]`           |            |
| `splice(start, deleteCount?, ...items)`    | yes      | `T[]`           |            |
| `at(index)`                                | no       | `T              | undefined` |
| `includes(value, fromIndex?)`              | no       | `boolean`       |            |
| `indexOf(value, fromIndex?)`               | no       | `number`        |            |
| `lastIndexOf(value, fromIndex?)`           | no       | `number`        |            |
| `slice(start?, end?)`                      | no       | `T[]`           |            |
| `concat(...values)`                        | no       | `T[]`           |            |
| `toReversed()`                             | no       | `T[]`           |            |
| `toSpliced(start, deleteCount?, ...items)` | no       | `T[]`           |            |
| `with(index, value)`                       | no       | `T[]`           |            |
| `keys()`                                   | no       | `number[]`      |            |
| `values()`                                 | no       | `T[]`           |            |
| `entries()`                                | no       | `[number, T][]` |            |
| `forEach(callback)`                        | no       | `void`          |            |
| `map(callback)`                            | no       | `U[]`           |            |
| `filter(callback)`                         | no       | `T[]`           |            |
| `some(callback)`                           | no       | `boolean`       |            |
| `every(callback)`                          | no       | `boolean`       |            |
| `find(callback)`                           | no       | `T              | undefined` |
| `findIndex(callback)`                      | no       | `number`        |            |

Mutating methods require a mutable, non-readonly dynamic array.

Tuples reject mutating methods because their length and element layout are fixed.

## Array Push

`push` is modeled as:

```txt
receiver: mutating borrow
argument: value stored in the array
escape: false
return: number
```

Example:

```ts
function grow(): number {
    let scores: number[] = [1]
    scores.push(2)
    return scores[1]
}
```

The semantic analyzer validates:

```txt
the receiver is a dynamic array
the array is mutable
the array is not readonly
exactly one argument is passed
the argument type is assignable to the array element type
```

For now, tuples reject `push` because tuple length is fixed.

The backend lowers:

```ts
scores.push(value)
```

to:

```txt
yogi_array_push(array, boxedValue)
```

The runtime grows the array buffer as needed and returns the new length as a number-compatible value.

## Index Rules

The following methods follow the JavaScript index rules that matter for this stage:

```txt
at
slice
includes
indexOf
lastIndexOf
with
```

`with` supports negative indexes and aborts with a runtime range diagnostic when the normalized index is outside the array.

## Callback Methods

Callback methods currently accept named function references and expression-bodied inline arrows:

```ts
function doubleValue(value: number): number {
    return value * 2
}

let doubled: number[] = scores.map(doubleValue)
let shifted: number[] = scores.map((value: number): number => value + 1)
```

Block-bodied callbacks and callbacks that capture outer locals are rejected until Yogi has closure and lifetime semantics for captured values.

Rejected for now:

```ts
let factor: number = 2

let doubled: number[] = scores.map((value: number): number => {
    return value * factor
})
```

The callback captures `factor`, so Yogi needs closure ownership rules before allowing it.

## Complete Example

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

    for (let value: number of scores) {
        total = total + value
    }

    return total
}
```

This program validates semantically, writes SIR FlatBuffers, lowers to LLVM, generates an object file, links, and executes.

## Current Limitations

This lot is still not a full control-flow analysis engine.

Remaining loop work:

```txt
path-sensitive move-state for branch-specific break and continue
do while
for in
loop-carried type narrowing
lazy iterator objects
block-bodied inline callbacks
closures and callback captures
reduce
reduceRight
flatMap
findLast
findLastIndex
sort
toSorted
join
object helper methods
string concatenation and advanced string methods
```

The current behavior is enough for normal `while`, classic `for`, `break`, `continue`, array-backed `for...of`, readonly `array.length` and `tuple.length`, array iterator materialization, and the first builtin aggregate method set while preserving stack-first cleanup rules.

## Planning Direction

Yogi should treat loops as a control-flow feature and an ownership feature at the same time.

The recommended implementation order is:

```txt
1. Normalize loop syntax into explicit AST/SIR nodes.
2. Validate loop scopes and explicit type annotations.
3. Attach loop frames for break/continue legality.
4. Track aggregate locals created inside loop bodies.
5. Emit cleanup before break, continue, and return.
6. Keep classic for initializer resources alive until loop exit.
7. Desugar for...of into the classic for pipeline.
8. Materialize keys(), values(), and entries() as arrays for now.
9. Keep loop move-state conservative.
10. Add path-sensitive control-flow later.
```

The important design decision is that loops should not bypass ownership rules.

A loop body is not just repeated code. It is a scope that may exit from multiple places:

```txt
normal iteration end
continue
break
return
throw or runtime abort later
```

Every exit path must have a predictable cleanup path.

That makes the loop lowering model responsible for both branching and destructor scheduling.

## Long-Term Loop Model

Eventually, Yogi can evolve toward a more advanced loop engine:

```txt
loop-carried type narrowing
path-sensitive ownership after break/continue
lazy iterator protocol
custom iterable structs
generator-like syntax
closures inside callback methods
borrowed iteration without array materialization
```

But the current model should stay simple:

```txt
classic for is the primitive loop form
while is a primitive loop form
for...of lowers into classic for
array iterator methods materialize arrays
closures are rejected until lifetime rules are ready
move-state after loops stays conservative
```

This keeps the compiler strict, predictable, and compatible with Yogi's stack-first RAII design.
