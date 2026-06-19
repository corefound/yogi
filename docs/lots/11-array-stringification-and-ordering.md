# Lot 11: Array Stringification And Ordering

## Goal

This lot adds the remaining high-value non-callback array methods that are used
constantly in real TypeScript code:

```ts
scores.join("-")
scores.toString()
scores.sort()
scores.toSorted()
```

## Runtime

The runtime now exposes:

```cpp
yogi_array_join
yogi_array_to_string
yogi_array_sort
yogi_array_to_sorted
```

`join` and `toString` convert primitive `Any` elements to text. `null` and
`undefined` become empty fields in `join`, matching JavaScript array joining at
the useful surface level.

`sort()` mutates the receiver. `toSorted()` clones first, sorts the clone, and
leaves the original array unchanged.

## Ordering

The default ordering is JavaScript-style string ordering for primitive elements:

```ts
let values: number[] = [3, 1, 20]
values.sort()
print(values)
// [1, 20, 3]
```

Comparator overloads are still future work:

```ts
values.sort((a: number, b: number): number => a - b)
```

That path needs comparator lowering into runtime/native sorting.

## Tests

`yogi_pipeline_array_methods` verifies:

- `join`
- `toString`
- mutating `sort`
- non-mutating `toSorted`
- semantic diagnostics for invalid `join` separator and `const` sort mutation
