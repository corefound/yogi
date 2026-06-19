# Lot 10: Array At And Richer Print

## Goal

This lot fixes array element methods that return boxed runtime values and makes
`print` useful for more realistic pipeline testing.

The motivating examples are:

```ts
let scores: number[] = [7, 8, 9]

print(scores)
print(scores.at(0))
```

Expected output:

```text
[7, 8, 9]
7
```

## Array Element Return Values

The array runtime stores elements as boxed `Any` values. Methods like `at`,
`pop`, `shift`, and `find` therefore return a boxed pointer from the runtime.

When the semantic context expects a primitive value, LLVM lowering now unboxes
that element before returning or storing it:

```ts
function first(): number {
    let scores: number[] = [8, 9, 10]
    return scores.at(0)
}
```

This keeps `T | undefined` available when a variable explicitly asks for it,
while allowing checked primitive contexts to receive the element value.

## Print

`print` now lowers arrays and tuples through the runtime function
`yogi_print_array`.

Supported output today:

```ts
print(42)
print(true)
print("ready")
print([1, 2, 3])
print(scores.at(0))
```

The runtime array printer reads each element as `Any` and prints primitive
values in JavaScript-like array syntax.

## Current Limitations

Array printing currently targets arrays whose elements are runtime `Any`
primitives: numbers, booleans, strings, null, and undefined.

Nested arrays and object values need a richer `Any` representation before they
can be printed recursively.

## Tests

- `yogi_pipeline_array_methods` now verifies `scores.at(0)` in a primitive
  return context and verifies `print(scores)`.
- `yogi_package_manager_init_build_run` verifies `yogi run` can print strings,
  numbers, booleans, arrays, and `scores.at(0)` from a generated project.
