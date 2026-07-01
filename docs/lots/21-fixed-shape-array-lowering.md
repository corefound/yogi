# Lot 21: Fixed-Shape Array Lowering

This lot continues the fixed-shape array work after syntax, semantic validation,
and FlatBuffers metadata were added.

## Goal

Yogi arrays with shape are rectangular shaped values accessed by logical
coordinate addresses. `value[i, j, k]` is Yogi multidimensional indexing, not the
JavaScript comma operator.

## Implemented

- Fixed-shape array literals now lower to flat row-major runtime descriptor
  storage when the expected type carries `fixed = true` and `shape.length > 1`.
- `number[2, 3]` stores six values in one descriptor instead of nested row
  descriptors.
- Full coordinate access computes row-major offsets in LLVM:

```text
matrix[1, 2] => 1 * 3 + 2
```

- Fixed-shape writes use the same offset path:

```ts
matrix[0, 1] = 9
```

- Partial indexing now creates a borrowed shaped view descriptor:

```ts
let row: number[3] = matrix[1]
row[2] = 99
print(matrix[1, 2]) // 99
```

## Current Lowering Shape

The backend still uses the runtime array descriptor ABI:

```text
yogi_array_create(totalElementCount)
yogi_array_set(flatIndex, boxedValue)
yogi_array_get(flatIndex)
yogi_array_view(source, baseOffset, visibleLength)
```

This means fixed-shape arrays are rectangular and row-major, but they are not
yet native LLVM `[N x T]` values. Partial indexing uses non-owning view
descriptors, so simple slices no longer copy elements.

## Tests

The runtime pipeline test verifies:

- fixed 1D array indexing still works
- fixed 2D literal validation and runtime execution
- fixed 3D coordinate indexing
- partial indexing
- borrowed view mutation updating the original storage
- multidimensional assignment
- invalid nested shape syntax
- dimension-specific out-of-bounds diagnostics
- row-major lowering markers in LLVM IR
- `yogi_array_view` IR marker and absence of the old element copy loop marker

Test file:

```text
tests/runtime/sessions/02-variables-aggregates/array_indexing_semantics.cmake
```

## Next Work

- Const/readonly propagation through borrowed views.
- Interprocedural borrowed-view lifetime summaries.
- Native fixed-shape ABI for non-escaping values.
- Dynamic shaped arrays such as `Array<float32, 2>`.
