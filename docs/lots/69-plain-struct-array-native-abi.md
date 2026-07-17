# Lot 69: Plain Struct Array Native ABI

This lot extends native array ABI interop from numeric arrays to plain numeric
struct arrays.

## Implemented

- `Struct[]` extern parameters are supported when the struct is ABI-safe.
- `ptr<Struct[]>` extern parameters are supported with copy-back after the
  native call returns.
- ABI-safe struct arrays lower as:

```txt
Struct[]      -> Struct* data, uint64_t length
ptr<Struct[]> -> Struct* data, uint64_t length, copy-back
```

- The backend materializes a temporary native struct buffer in LLVM, fills it
  from Yogi array elements, calls the native function, and copies modified
  structs back into existing Yogi array slots for mutable pointer parameters.
- Existing Yogi array pointer identity is preserved because copy-back writes
  through `yogi_array_set`.
- Frontend validation rejects non-ABI-safe struct arrays.

## ABI-Safe Struct Rule

A struct is currently native-array ABI-safe only when:

- it is a real Yogi `struct`
- every field is required
- every field type is `number`
- field order matches the C struct declaration order

Example:

```ts
struct Reading {
    value: number
    offset: number
}
```

The matching C struct is:

```c
typedef struct {
    double value;
    double offset;
} Reading;
```

## Rejected For Now

- structs with `string` fields
- structs with array fields
- nested structs
- optional fields
- boolean fields
- resource-owning fields

These need explicit layout and ownership rules before crossing C ABI.

## Tests

- `tests/runtime/sessions/02-variables-aggregates/array_native_abi_policy.cmake`
- `tests/programs/native_reading_calibrator.cmake`
- compiler frontend extern ABI tests

## Next

The next array-focused native ABI lot should handle string array marshalling or
resource-owning/nested struct array marshalling. String arrays likely need an
explicit `const char**` borrowed ABI plus clear ownership for generated strings.
