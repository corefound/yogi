# Lot 12: Array Completion

## Goal

This lot closes the remaining array surface that can be implemented with the
current function, callback, aggregate, and runtime model:

```ts
scores.sort((left: number, right: number): number => left - right)
scores.toSorted((left: number, right: number): number => right - left)
nested.flat(1)
scores.keys()
scores.values()
scores.entries()
scores.toLocaleString()
```

## Semantic Rules

`sort(compareFn)` and `toSorted(compareFn)` require a callable comparator that
accepts two array element values and returns `number`.

```ts
let scores: number[] = [3, 1, 20]
scores.sort((left: number, right: number): number => left - right)
```

Invalid comparator return types are rejected before LLVM is generated:

```ts
scores.sort((left: number, right: number): boolean => true)
```

`flat(depth)` accepts an optional `number` depth. The runtime honors the depth
value. The semantic result type currently flattens one statically known nesting
level, so deeper compile-time typing is tracked in `docs/todo/arrays.md`.

`keys`, `values`, and `entries` materialize arrays for now:

```ts
let keys: number[] = scores.keys()
let values: number[] = scores.values()
let entries: [number, number][] = scores.entries()
```

This keeps the TypeScript-facing method names available before Yogi has a full
iterator protocol.

## Runtime And LLVM

The runtime now exposes C ABI calls for:

```cpp
yogi_array_flat
yogi_array_keys
yogi_array_values
yogi_array_entries
yogi_any_from_array
yogi_any_to_array
```

Nested arrays can be stored inside `Any` values. That makes `flat` and
`entries` work without requiring a special LLVM-only representation.

Comparator sorting is lowered directly in LLVM as a small compare/swap loop
that calls the known comparator callback. Default `sort()` still uses the
runtime string-order implementation, and `toSorted()` clones before sorting.

## Printing

`print` can now display arrays containing nested arrays:

```ts
let nested: number[][] = [[1, 2], [3, 4]]
print(nested)
```

The output is bracketed for direct printing, while `join`, `toString`, and
`toLocaleString` use comma-separated JavaScript-style stringification.

## Tests

`yogi_pipeline_array_methods` covers:

- comparator `sort`
- comparator `toSorted`
- `flat(depth)`
- `keys`
- `values`
- `entries`
- `toLocaleString`
- recursive array printing through `print`
- semantic rejection for invalid comparator return type

