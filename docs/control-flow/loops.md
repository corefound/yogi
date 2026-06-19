# Loops And Iterator Protocol

Yogi currently supports `while`, classic `for`, `break`, `continue`, and
array-backed `for...of`.

## Classic For

Classic `for` uses the TypeScript syntax surface:

```ts
let total: number = 0
let values: number[] = [1, 2, 3]

for (let index: number = 0; index < values.length; index = index + 1) {
    total = total + values[index]
}
```

The initializer lives for the full loop lifetime. Aggregates created by the
initializer are cleaned after `for.end`, not before the first condition check.

## For Of

`for...of` is supported for arrays, strings, and array-producing methods:

```ts
let total: number = 0
let values: number[] = [3, 1, 20]

for (let value: number of values) {
    total = total + value
}
```

The loop variable must have an explicit type annotation, matching Yogi's strict
type rules:

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

Strings are indexable and iterable:

```ts
let text: string = "yogi"

for (let ch: string of text) {
    print(ch)
}
```

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

## Lowering Model

The visitor desugars `for...of` into the existing `for` pipeline:

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

This keeps the full pipeline intact:

```txt
TypeScript parser -> AST -> semantic IR -> FlatBuffer -> LLVM -> executable
```

## Ownership

If the iterable expression creates an aggregate, that aggregate belongs to the
loop initializer and is cleaned after the loop exits.

```ts
for (let score: number of makeScores()) {
    print(score)
}
```

`makeScores()` is evaluated once, stored in a hidden loop temp, and the temp is
destroyed after the loop.

Mutating array methods that return the receiver, such as `sort()`, are aliases:

```ts
let values: number[] = [3, 1, 20]
let sorted: number[] = values.sort()
```

`values` and `sorted` point at the same array. Module cleanup detects this and
destroys the aggregate once.

## Current Limits

- `for...of` supports identifier, array destructuring, and object destructuring
  loop bindings with explicit type annotations.
- `keys`, `values`, and `entries` currently return arrays, not lazy iterator
  objects.
- String concatenation is not part of this iterator lot yet. String iteration
  can read and print characters; concatenating them into a new string is tracked
  as string-method work.
