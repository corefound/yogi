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

    for (let j: number = 0; j < 4; j = j + 1) {
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
- More aggregate methods such as `pop`, `at`, `length`, and object helpers.

The current behavior is enough for normal `while`, `for`, `break`, `continue`,
and `array.push` while preserving stack-first cleanup rules.
