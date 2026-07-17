# Lot 68: Array Native ABI and Contiguous Interop

This lot introduces the first real native C ABI bridge for Yogi arrays.

## Goal

Yogi arrays must not expose their internal runtime descriptor as public ABI.
Native code receives a conventional contiguous pointer plus length or shape
metadata, while Yogi keeps ownership, pointer identity, and cleanup rules under
compiler/runtime control.

## Implemented

- `extern native from "./lib.a" { ... }` calls can be invoked as
  `native.functionName(...)`.
- `number[]` parameters lower to `double* data, uint64_t length`.
- `ptr<number[]>` parameters lower to `double* data, uint64_t length` and copy
  modified values back into existing Yogi array slots after the call returns.
- `number[N]` parameters lower to `double* data, uint64_t length`.
- `number[N, M]` and pointer variants lower to `double* data, uint64_t N,
  uint64_t M`.
- The runtime materializes temporary native number buffers and destroys them
  after the synchronous native call.
- Unsafe array ABI shapes are rejected semantically:
  - `string[]`
  - nested dynamic arrays such as `number[][]`
  - array returns
  - array extern variables
  - arrays of structs until a stable marshalling layout exists

## Ownership Model

Native array calls are borrowed calls.

```txt
number[]:
  copy in to a temporary contiguous buffer
  native reads it
  Yogi destroys the temporary buffer

ptr<number[]>:
  copy in to a temporary contiguous buffer
  native may mutate values
  Yogi copies values back into existing slots
  Yogi destroys the temporary buffer
```

Native code must not retain the pointer after returning and must not structurally
resize the array.

## Tests

- `tests/runtime/sessions/02-variables-aggregates/array_native_abi_policy.cmake`
- `tests/programs/native_signal_processor.cmake`
- compiler frontend tests for allowed/rejected extern array ABI declarations

## Remaining

- ABI-safe struct array marshalling.
- String array marshalling.
- Explicit async/retained native pointer policy.
- Native fixed-shape LLVM value ABI independent from the runtime descriptor.
