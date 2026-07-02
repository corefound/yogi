# Yogi Loops Plan And Implementation Checklist

This document is the working record for Yogi loop syntax, loop semantics, ownership behavior, cleanup rules, and implementation status.

Yogi should keep a JavaScript/TypeScript-like loop surface, but with Yogi rules:

- explicit types where declarations appear
- `let` and `const` only
- `var` is forbidden
- loop conditions must be `boolean`
- no truthy/falsy conversion
- loop bodies are scopes
- `break`, `continue`, and `return` must participate in cleanup
- aggregate move-state must remain valid across loop control flow
- lowering must produce correct LLVM basic blocks and cleanup paths

The core syntax loops planned for Yogi are:

```txt
while
do while
classic for
for...of
for...in
```

Array methods such as `map`, `filter`, `forEach`, `some`, and `every` also perform iteration internally, but they are aggregate methods, not loop syntax forms.

---

## 1. Design Summary

Loops are not a completely separate language system. They are built on top of existing compiler features:

```txt
variables
blocks/scopes
boolean expressions
assignments
function calls
array indexing
object/property access
ownership
move-state
destructor scheduling
LLVM basic blocks
```

A loop is mainly:

```txt
condition + body scope + repeat edge + exit edge
```

The hard part is not parsing the syntax. The hard part is making every exit path safe:

```txt
normal end of body
continue
break
return
runtime abort/error path
```

Each exit path must drop the correct aggregate locals before control leaves the current scope.

---

## 2. Condition Rule

All loop conditions must be exactly `boolean`.

Valid:

```ts
let i: number = 0

while (i < 10) {
    i = i + 1
}
```

Valid:

```ts
let running: boolean = true

while (running) {
    running = false
}
```

Invalid:

```ts
while (1) {
}
```

Invalid:

```ts
while (count) {
}
```

Correct version:

```ts
while (count != 0) {
}
```

Invalid:

```ts
while (values.length) {
}
```

Correct version:

```ts
while (values.length > 0) {
}
```

Invalid:

```ts
if (ptr) {
}
```

Correct version:

```ts
if (ptr != null) {
}
```

Yogi should not copy JavaScript truthy/falsy rules. Conditions should be explicit and predictable.

---

## 3. `while`

Syntax:

```ts
while (condition) {
    // body
}
```

Example:

```ts
let i: number = 0
let total: number = 0

while (i < 10) {
    total = total + i
    i = i + 1
}
```

Behavior:

```txt
1. Evaluate condition.
2. If condition is false, jump to loop end.
3. If condition is true, execute body.
4. At normal body end, clean body locals.
5. Jump back to condition.
```

`break` exits the loop:

```ts
while (true) {
    if (done) {
        break
    }
}
```

`continue` jumps back to the next condition check:

```ts
while (i < 10) {
    i = i + 1

    if (i == 5) {
        continue
    }

    print(i)
}
```

Lowering shape:

```txt
while.condition
while.body
while.end
```

Cleanup rule:

```txt
locals created inside the body are dropped at the end of each iteration,
before continue, before break, and before return.
```

---

## 4. `do while`

Syntax:

```ts
do {
    // body
} while (condition)
```

Example:

```ts
let i: number = 0

do {
    print(i)
    i = i + 1
} while (i < 10)
```

Difference from `while`:

```txt
while    -> checks condition before the first body execution
do while -> executes body once, then checks condition
```

Behavior:

```txt
1. Execute body.
2. At normal body end, clean body locals.
3. Evaluate condition.
4. If condition is true, execute body again.
5. If condition is false, jump to loop end.
```

`continue` in a `do while` jumps to the condition block, not directly to the body.

Lowering shape:

```txt
do.body
do.condition
do.end
```

Condition rule:

```txt
condition must be boolean.
```

---

## 5. Classic `for`

Syntax:

```ts
for (initializer; condition; increment) {
    // body
}
```

Example:

```ts
for (let i: number = 0; i < 10; i = i + 1) {
    print(i)
}
```

The classic `for` has three parts:

```txt
initializer -> runs once before the loop starts
condition   -> checked before each iteration
increment   -> runs after each normal body iteration and after continue
```

Execution order:

```txt
1. Run initializer once.
2. Check condition.
3. If condition is false, exit.
4. Run body.
5. Run increment.
6. Go back to condition.
```

Lowering shape:

```txt
for.init
for.condition
for.body
for.increment
for.end
```

The initializer belongs to the full loop scope. If the initializer creates an aggregate, that aggregate lives until `for.end`.

Example:

```ts
for (let scratch: number[] = [0]; shouldRun(); update()) {
    use(scratch)
}

// scratch is cleaned after for.end
```

### 5.1 Optional Classic `for` Parts

Yogi should support the JavaScript-style optional parts.

Full form:

```ts
for (let i: number = 0; i < 10; i = i + 1) {
    print(i)
}
```

No initializer:

```ts
let i: number = 0

for (; i < 10; i = i + 1) {
    print(i)
}
```

No increment:

```ts
for (let i: number = 0; i < 10;) {
    print(i)
    i = i + 1
}
```

No condition:

```ts
for (let i: number = 0;; i = i + 1) {
    if (i == 10) {
        break
    }
}
```

All parts omitted:

```ts
for (;;) {
    break
}
```

Rule:

```txt
initializer: optional
condition: optional; if present, must be boolean
increment: optional
```

If the condition is omitted, it behaves as `true`.

### 5.2 Initializer Forms

The initializer may be a variable declaration:

```ts
for (let i: number = 0; i < 10; i = i + 1) {
}
```

Or an expression/assignment using an existing variable:

```ts
let i: number = 0

for (i = 0; i < 10; i = i + 1) {
}
```

`var` is invalid:

```ts
for (var i: number = 0; i < 10; i = i + 1) {
}
```

### 5.3 `const` In Classic `for`

`const` is allowed only if it is not reassigned.

Valid:

```ts
let i: number = 0

for (const limit: number = 10; i < limit; i = i + 1) {
    print(i)
}
```

Invalid:

```ts
for (const i: number = 0; i < 10; i = i + 1) {
}
```

Reason:

```txt
i = i + 1 attempts to reassign a const binding.
```

---

## 6. `for...of`

`for...of` iterates values from an iterable expression.

Syntax:

```ts
for (let value: T of iterable) {
    // body
}
```

Example with arrays:

```ts
let values: number[] = [10, 20, 30]

for (let value: number of values) {
    print(value)
}
```

Example with strings:

```ts
let text: string = "yogi"

for (let ch: string of text) {
    print(ch)
}
```

The loop variable must have an explicit type annotation.

Invalid:

```ts
for (let value of values) {
    print(value)
}
```

Valid:

```ts
for (let value: number of values) {
    print(value)
}
```

### 6.1 What `for...of` Works On

`for...of` should work on iterable values, not arbitrary objects.

Supported iterable sources in the complete Yogi loop plan:

```txt
arrays
strings
array.keys()
array.values()
array.entries()
object.keys()
object.values()
object.entries()
custom types that implement Yogi's iterable protocol
```

A plain object is not automatically iterable:

```ts
let user: { name: string, age: number } = {
    name: "Ana",
    age: 20
}

for (let value: string of user) {
    print(value)
}
```

That should be rejected unless the object type explicitly implements iterable behavior.

Correct object iteration through helper methods:

```ts
for (let key: string of user.keys()) {
    print(key)
}
```

```ts
for (let entry: [string, string | number] of user.entries()) {
    print(entry[0])
}
```

### 6.2 `for...of` Desugaring

A `for...of` can lower into the classic `for` pipeline.

Source:

```ts
for (let value: number of values) {
    total = total + value
}
```

Conceptual lowering:

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

Ownership rule:

```txt
The iterable expression is evaluated once.
If it creates an aggregate, the hidden iterable temp owns that aggregate.
The hidden temp is cleaned after the loop exits.
```

Example:

```ts
for (let score: number of makeScores()) {
    print(score)
}
```

Conceptual ownership:

```ts
let __iterable: number[] = makeScores()

for (let __index: number = 0; __index < __iterable.length; __index = __index + 1) {
    let score: number = __iterable[__index]
    print(score)
}

// __iterable is cleaned here
```

---

## 7. `for...in`

`for...in` iterates keys or indexes.

Syntax:

```ts
for (let key: K in target) {
    // body
}
```

### 7.1 Arrays

For arrays, `for...in` should iterate numeric indexes.

```ts
let values: number[] = [10, 20, 30]

for (let index: number in values) {
    print(values[index])
}
```

Rule:

```txt
for...in array -> index: number
```

This intentionally avoids JavaScript's behavior where array indexes in `for...in` are strings.

### 7.2 Objects / Dictionaries

For objects/dictionaries, `for...in` should iterate field keys.

```ts
let user: { name: string, age: number } = {
    name: "Ana",
    age: 20
}

for (let key: string in user) {
    print(key)
}
```

Rule:

```txt
for...in object -> key: string
```

Because Yogi objects are strict fixed-layout records, `for...in` must not turn objects into dynamic JavaScript maps.

Recommended object key order:

```txt
declaration order
```

This makes object iteration deterministic and compile-time predictable.

### 7.3 Dynamic Object Indexing Warning

Yogi objects have known fields and known field types. Therefore this should not automatically imply arbitrary dynamic indexing:

```ts
for (let key: string in user) {
    print(user[key])
}
```

That is only safe if Yogi defines a typed rule for it, such as:

```txt
object[key] returns a union of all possible field value types
```

For a fixed object like:

```ts
let user: { name: string, age: number }
```

`user[key]` would have to be:

```ts
string | number
```

If Yogi does not want dynamic object indexing, then users should use explicit field access, `switch`, or object helper methods.

Example using entries:

```ts
for (let entry: [string, string | number] of user.entries()) {
    print(entry[0])
}
```

---

## 8. `break` And `continue`

`break` exits the nearest loop.

```ts
for (let i: number = 0; i < 10; i = i + 1) {
    if (i == 5) {
        break
    }
}
```

`continue` skips to the next iteration.

```ts
for (let i: number = 0; i < 10; i = i + 1) {
    if (i == 5) {
        continue
    }

    print(i)
}
```

For classic `for`, `continue` jumps to the increment block.

For `while`, `continue` jumps to the condition block.

For `do while`, `continue` jumps to the condition block.

For `for...of` and `for...in`, `continue` follows the desugared classic `for` behavior.

Backend loop frame:

```txt
LoopFrame:
  break target
  continue target
  cleanup start for break
  cleanup start for continue
```

Cleanup rule:

```txt
Before break or continue jumps, all aggregate locals that belong to the current body scope must be dropped.
```

Example:

```ts
for (let i: number = 0; i < 4; i = i + 1) {
    let scratch: number[] = [i]

    if (i == 2) {
        continue
    }
}
```

Before `continue` jumps to the increment block, `scratch` is dropped.

---

## 9. Return Inside Loops

`return` inside a loop must clean all active scopes before returning from the function.

Example:

```ts
function findFirst(values: number[]): number | undefined {
    for (let value: number of values) {
        let scratch: number[] = [value]

        if (value > 10) {
            return value
        }
    }

    return undefined
}
```

Before returning `value`, Yogi must clean:

```txt
scratch
loop body locals
hidden loop temps if needed
function locals that are still live and owned
```

This should reuse the same destructor scheduling system used for early returns outside loops.

---

## 10. Move-State Across Loops

Loops are conservative.

If an aggregate can be moved inside a reachable loop body, the aggregate is considered moved after the loop because the loop may have executed.

Example:

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

Reason:

```txt
The loop may have executed.
Therefore local may have been moved.
```

This is intentionally conservative and safe.

---

## 11. Array And Object Iteration Helpers

Array helpers:

```ts
values.keys()    // number[]
values.values()  // T[]
values.entries() // [number, T][]
```

Object helpers:

```ts
user.keys()    // string[]
user.values()  // union of field value types[]
user.entries() // [string, union of field value types][]
```

Example:

```ts
let values: number[] = [10, 20, 30]

for (let index: number of values.keys()) {
    print(index)
}

for (let value: number of values.values()) {
    print(value)
}

for (let entry: [number, number] of values.entries()) {
    print(entry[0] + entry[1])
}
```

Object example:

```ts
let user: { name: string, age: number } = {
    name: "Ana",
    age: 20
}

for (let key: string of user.keys()) {
    print(key)
}

for (let entry: [string, string | number] of user.entries()) {
    print(entry[0])
}
```

For now, the documented lowering model may materialize helper results as arrays. The language-level behavior should still be designed around iterable values, so the implementation can later optimize without changing user code.

---

## 12. Relationship To Array Callback Methods

These methods are not syntax loops:

```ts
values.forEach(callback)
values.map(callback)
values.filter(callback)
values.some(callback)
values.every(callback)
values.find(callback)
values.findIndex(callback)
```

They are builtin aggregate methods that internally iterate over arrays.

Example:

```ts
function doubleValue(value: number): number {
    return value * 2
}

let doubled: number[] = values.map(doubleValue)
```

Expression-bodied inline arrows are allowed when they do not capture outer locals:

```ts
let shifted: number[] = values.map((value: number): number => value + 1)
```

Callbacks that capture outer locals require closure and lifetime rules:

```ts
let factor: number = 2

let doubled: number[] = values.map((value: number): number => value * factor)
```

Yogi must reject callback captures until closure ownership semantics are fully defined and implemented.

---

## 13. Recommended AST / SIR Nodes

Loop nodes:

```txt
WhileStatement
DoWhileStatement
ForStatement
ForOfStatement
ForInStatement
BreakStatement
ContinueStatement
```

Useful fields:

```txt
WhileStatement:
  condition
  body

DoWhileStatement:
  body
  condition

ForStatement:
  initializer optional
  condition optional
  increment optional
  body

ForOfStatement:
  binding
  bindingType
  iterableExpression
  body

ForInStatement:
  binding
  bindingType
  targetExpression
  body

BreakStatement:
  optional label if labels are supported

ContinueStatement:
  optional label if labels are supported
```

Binding kinds:

```txt
identifier binding
array destructuring binding
object destructuring binding
```

All loop bindings must have explicit type annotations.

---

## 14. LLVM Lowering Notes

### `while`

```txt
create condition block
create body block
create end block
branch to condition
condition branches to body or end
body branches back to condition unless terminated
```

### `do while`

```txt
create body block
create condition block
create end block
branch to body
body branches to condition unless terminated
condition branches to body or end
```

### Classic `for`

```txt
lower initializer in loop scope
create condition block
create body block
create increment block
create end block
condition missing -> true
continue target -> increment block
break target -> end block
initializer cleanup -> after end
```

### `for...of`

```txt
evaluate iterable once
store iterable in hidden temp
create hidden index
lower as classic for over length/index
bind element each iteration
cleanup hidden temp after loop end
```

### `for...in`

For arrays:

```txt
hidden index from 0 to array.length - 1
bind index as number
lower as classic for
```

For objects:

```txt
use compile-time known field key list
lower as iteration over materialized key array or static key table
bind key as string
```

---

## 15. Implementation Checklist

Status legend:

```txt
✅ Done / documented as currently working
🟡 Partial / needs verification or completion
⬜ Not implemented yet / needs implementation
🔴 Decision needed
```

### 15.1 Parser / AST

| Status | Item |
| --- | --- |
| ✅ | Parse `while` statements. |
| ✅ | Parse classic `for` statements. |
| ✅ | Parse `break`. |
| ✅ | Parse `continue`. |
| ✅ | Parse `for...of`. |
| ⬜ | Parse `do while`. |
| ⬜ | Parse `for...in`. |
| 🟡 | Verify classic `for` supports empty initializer. |
| 🟡 | Verify classic `for` supports empty condition. |
| 🟡 | Verify classic `for` supports empty increment. |
| 🟡 | Verify `for (;;) {}` parses. |
| 🟡 | Verify initializer can be declaration or expression. |
| 🟡 | Verify `const` loop bindings obey const reassignment rules. |
| 🟡 | Verify array destructuring binding in `for...of`. |
| 🟡 | Verify object destructuring binding in `for...of`. |
| ⬜ | Add array/object destructuring binding support to `for...in` if desired. |
| 🔴 | Decide whether Yogi requires braces for all loop bodies. Recommended: yes. |
| 🔴 | Decide whether labeled `break` / `continue` are part of the core JS-like loop surface. |

### 15.2 Semantic Validation

| Status | Item |
| --- | --- |
| ✅ | Validate `while` condition as boolean. |
| ✅ | Validate classic `for` condition as boolean when present. |
| ✅ | Treat missing classic `for` condition as `true`. |
| ✅ | Reject `var` in loop initializers. |
| ✅ | Require explicit type annotations in loop variable declarations. |
| ✅ | Validate `break` only inside loops. |
| ✅ | Validate `continue` only inside loops. |
| ✅ | Track loop body as a scope. |
| ✅ | Conservative move-state after loops. |
| 🟡 | Verify `do while` condition boolean validation after parser support. |
| ⬜ | Validate `for...in` array binding type as `number`. |
| ⬜ | Validate `for...in` object binding type as `string`. |
| ⬜ | Reject `for...of` over plain object unless object is explicitly iterable. |
| ⬜ | Validate `object.keys()`, `object.values()`, and `object.entries()` types. |
| ⬜ | Define and validate custom iterable protocol. |
| 🟡 | Verify string iteration element type is `string`. |
| 🟡 | Verify `for...of` iterable expression is evaluated once. |
| 🟡 | Verify hidden temporaries obey ownership/move-state rules. |
| 🟡 | Verify `return` inside loops emits correct cleanup. |
| ⬜ | Path-sensitive move-state for branch-specific `break` and `continue`. |
| ⬜ | Loop-carried type narrowing. |

### 15.3 SIR / FlatBuffer

| Status | Item |
| --- | --- |
| ✅ | `WhileStatement` node in SIR. |
| ✅ | `ForStatement` node in SIR. |
| ✅ | `BreakStatement` node in SIR. |
| ✅ | `ContinueStatement` node in SIR. |
| ✅ | Serialize loop body blocks. |
| ✅ | Deserialize loop body blocks in C++ reader. |
| ✅ | `ForOfStatement` support or equivalent desugared representation. |
| ⬜ | Add `DoWhileStatement` node or desugar before SIR. |
| ⬜ | Add `ForInStatement` node or desugar before SIR. |
| 🟡 | Verify optional classic `for` fields serialize correctly when absent. |
| 🟡 | Verify source locations on loop diagnostics. |
| 🔴 | Decide whether `for...of`/`for...in` should remain explicit SIR nodes or always desugar before SIR. |

### 15.4 LLVM Lowering

| Status | Item |
| --- | --- |
| ✅ | Lower `while` to condition/body/end blocks. |
| ✅ | Lower classic `for` to init/condition/body/increment/end blocks. |
| ✅ | Lower `break` to loop end. |
| ✅ | Lower `continue` to correct continue target. |
| ✅ | Maintain loop frame stack. |
| ✅ | Emit body-local cleanup before `break`. |
| ✅ | Emit body-local cleanup before `continue`. |
| ✅ | Keep classic `for` initializer resources alive until loop end. |
| ✅ | Lower array-backed `for...of` through classic `for` model. |
| 🟡 | Verify cleanup for `return` inside nested loops. |
| 🟡 | Verify cleanup across nested `break`/`continue`. |
| ⬜ | Lower `do while`. |
| ⬜ | Lower `for...in` over arrays. |
| ⬜ | Lower `for...in` over objects using deterministic key list. |
| ⬜ | Lower `for...of` over object helper methods. |
| ⬜ | Lower custom iterable protocol. |
| ⬜ | Labeled `break` / `continue` cleanup across multiple loop frames if labels are supported. |

### 15.5 Runtime / Builtins

| Status | Item |
| --- | --- |
| ✅ | `array.length`. |
| ✅ | `tuple.length`. |
| ✅ | Array `keys()`. |
| ✅ | Array `values()`. |
| ✅ | Array `entries()`. |
| 🟡 | Verify string indexing/iteration runtime behavior. |
| ⬜ | Object `keys()`. |
| ⬜ | Object `values()`. |
| ⬜ | Object `entries()`. |
| ⬜ | Runtime/string model decision for string iteration unit: byte, code point, or grapheme-like unit. |
| ⬜ | Custom iterable protocol runtime/lowering support. |

### 15.6 Diagnostics

| Status | Diagnostic |
| --- | --- |
| ✅ | `while` condition must be boolean. |
| ✅ | classic `for` condition must be boolean. |
| ✅ | `break` used outside loop. |
| ✅ | `continue` used outside loop. |
| ✅ | missing type annotation in loop binding. |
| 🟡 | missing type annotation in destructured loop binding. |
| ⬜ | `do while` condition must be boolean. |
| ⬜ | `for...of` target is not iterable. |
| ⬜ | `for...of` cannot iterate plain object without iterable protocol. |
| ⬜ | `for...in` target must be array or object-like. |
| ⬜ | `for...in` array binding must be number. |
| ⬜ | `for...in` object binding must be string. |
| ⬜ | dynamic object indexing by loop key is not allowed unless typed rule exists. |
| ⬜ | labeled break/continue target not found if labels are supported. |

---

## 16. Official Behavior Matrix

| Loop | Purpose | Condition | Binding type required? | Main target |
| --- | --- | --- | --- | --- |
| `while` | Repeat while condition is true | Required boolean | N/A | Any boolean expression |
| `do while` | Run body once, then repeat while condition is true | Required boolean | N/A | Any boolean expression |
| classic `for` | Initializer + condition + increment loop | Optional boolean | If declaration exists | General loop |
| `for...of` | Iterate values | Hidden condition | Yes | Iterable values |
| `for...in` | Iterate keys/indexes | Hidden condition | Yes | Arrays and objects |

Target behavior:

```txt
for...of array  -> values
for...of string -> characters / string elements
for...of object -> invalid unless object is explicitly iterable
for...of object.keys() -> keys
for...of object.values() -> values
for...of object.entries() -> entries

for...in array  -> numeric indexes
for...in object -> string keys
```

---

## 17. Example Program

```ts
function run(values: number[]): number {
    let total: number = 0
    let i: number = 0

    while (i < values.length) {
        total = total + values[i]
        i = i + 1
    }

    do {
        total = total + 1
    } while (false)

    for (let index: number = 0; index < values.length; index = index + 1) {
        let scratch: number[] = [index]

        if (index == 1) {
            continue
        }

        total = total + scratch[0]

        if (index == 3) {
            break
        }
    }

    for (let value: number of values) {
        total = total + value
    }

    for (let index: number in values) {
        total = total + values[index]
    }

    return total
}
```

This program exercises:

```txt
while
do while
classic for
for...of
for...in
break
continue
array indexing
array length
body-scope aggregate cleanup
```

---

## 18. Codex Implementation Order

This is not a toy-language staged design. This is the implementation order for completing the full loop design cleanly.

Recommended order:

```txt
1. Confirm parser support for all five loop forms.
2. Confirm classic for optional parts: init/condition/increment.
3. Add do while parser, semantic validation, SIR, and LLVM lowering.
4. Add for...in parser, semantic validation, SIR/desugaring, and LLVM lowering.
5. Finalize for...of iterable target rules.
6. Add object keys/values/entries helpers.
7. Add object iteration diagnostics without turning objects into dynamic maps.
8. Verify cleanup for break, continue, and return inside nested loops.
9. Verify conservative move-state after loop bodies.
10. Add tests for every syntax form and every exit path.
```

---

## 19. Required Tests

### `while`

```ts
let i: number = 0

while (i < 3) {
    i = i + 1
}

print(i)
```

### `while` rejects non-boolean

```ts
let i: number = 3

while (i) {
    i = i - 1
}
```

Expected:

```txt
error: while condition must be boolean
```

### `do while`

```ts
let i: number = 0

do {
    i = i + 1
} while (i < 3)

print(i)
```

### Classic `for`

```ts
for (let i: number = 0; i < 3; i = i + 1) {
    print(i)
}
```

### Classic `for` with empty condition

```ts
let i: number = 0

for (;;) {
    i = i + 1

    if (i == 3) {
        break
    }
}
```

### `for...of` array

```ts
let values: number[] = [1, 2, 3]
let total: number = 0

for (let value: number of values) {
    total = total + value
}

print(total)
```

### `for...of` rejects plain object

```ts
let user: { name: string, age: number } = {
    name: "Ana",
    age: 20
}

for (let value: string of user) {
    print(value)
}
```

Expected:

```txt
error: for...of target is not iterable
```

### `for...in` array

```ts
let values: number[] = [10, 20, 30]
let total: number = 0

for (let index: number in values) {
    total = total + values[index]
}

print(total)
```

### `for...in` object

```ts
let user: { name: string, age: number } = {
    name: "Ana",
    age: 20
}

for (let key: string in user) {
    print(key)
}
```

### `break` cleanup

```ts
for (let i: number = 0; i < 4; i = i + 1) {
    let scratch: number[] = [i]

    if (i == 2) {
        break
    }
}
```

Expected:

```txt
scratch is dropped before break jumps to for.end
```

### `continue` cleanup

```ts
for (let i: number = 0; i < 4; i = i + 1) {
    let scratch: number[] = [i]

    if (i == 2) {
        continue
    }
}
```

Expected:

```txt
scratch is dropped before continue jumps to for.increment
```

### Move-state after loop

```ts
let saved: number[] = [0]

function save(values: number[]): void {
    saved = values
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

Expected:

```txt
error: local may have been moved inside loop
```

---

## 20. Final Rule

Yogi loops should look familiar to JavaScript/TypeScript developers, but behave according to Yogi's stricter model.

Final design principle:

```txt
JavaScript-like syntax.
Yogi-like semantics.
```

That means:

```txt
explicit types
boolean-only conditions
no truthy/falsy
strict scopes
deterministic cleanup
safe ownership
predictable LLVM lowering
```
