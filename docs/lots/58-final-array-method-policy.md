# Lot 58: Final JavaScript-Compatible Array Method Policy

This lot closes the array method policy pass.

Yogi keeps the familiar JavaScript/TypeScript `Array.prototype` method names,
but the compiler applies strict Yogi semantics:

```txt
JavaScript-like syntax
Yogi type checking
Yogi ownership and pointer-validity rules
Yogi readonly and fixed-size restrictions
```

## Supported Surface

Dynamic arrays support the current JavaScript array method surface that Yogi has
lowering for:

```txt
at, concat, copy, copyWithin, entries, every, fill, filter, find, findIndex,
findLast, findLastIndex, flat, flatMap, forEach, includes, indexOf, join, keys,
lastIndexOf, map, pop, push, reduce, reduceRight, reverse, shift, slice, some,
sort, splice, toLocaleString, toReversed, toSorted, toSpliced, toString,
unshift, values, with
```

`copy` is the explicit Yogi-owned-copy method. It is not a JavaScript method, but
it is part of Yogi's array ownership model.

## Strict Rules

Readonly arrays allow non-mutating methods such as `slice`, `toSorted`,
`toReversed`, `keys`, and `values`. Mutating methods such as `reverse`, `fill`,
`sort`, and `splice` are rejected.

`const` array bindings reject mutating methods on the binding. Copy-returning
methods stay valid because they do not mutate the original binding.

Fixed arrays allow read/index/search/iteration-style methods. Size-changing
methods such as `push`, `pop`, `shift`, `unshift`, and `splice` are rejected.

Tuples reject mutating length/ordering methods. Tuple shape remains explicit.

Callbacks must be callable and explicitly typed. Predicate callbacks must return
`boolean`, and sort comparators must return `number`.

Unsupported JavaScript proposals or methods that Yogi has not accepted are
reported as unsupported methods instead of silently lowering to dynamic behavior.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/array_method_policy.cmake
```

The suite checks:

- runtime execution across the supported method surface
- LLVM IR calls for runtime-backed method families
- readonly and `const` mutation rejection
- fixed-size array size-change rejection
- tuple mutation rejection
- strict callback/comparator diagnostics
- strict search/join/flat argument diagnostics
- unsupported method diagnostics

## Remaining Array Work

The next array-focused lot is callback ownership and borrow semantics. The
method names are available, but Yogi still needs a deeper final answer for
callback value ownership, mutable borrows, returned aggregates, and source-array
mutation while callbacks are running.
