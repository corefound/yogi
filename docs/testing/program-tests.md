# Program Tests

Program Tests are end-to-end programs written in Yogi.

They do not replace unit tests or focused runtime pipeline tests. They protect a
different layer: the way language features behave when they are used together in
programs that look like real user code.

## Purpose

Unit and focused pipeline tests answer questions like:

```txt
Does this one semantic rule work?
Does this diagnostic fire?
Does this runtime function handle this edge case?
```

Program Tests answer a broader question:

```txt
Can a real Yogi program compile, lower to LLVM, link, run, and produce the
expected result when multiple language systems interact?
```

## Location

Program Tests live in:

```txt
tests/programs/
```

Each test should:

- write a complete `main.ts` into `TEST_WORK_DIR`
- compile it with `YOGI_EXECUTABLE`
- verify cache artifacts such as `main.ll`, `main.o`, and the final executable
- run the executable
- assert the expected output

## Current Program Tests

| Program | Test | Status | Coverage |
|---|---|---|---|
| Inventory Manager | `tests/programs/inventory_manager.cmake` | Implemented | structs, arrays, struct arrays, functions, `for`, `for...of`, callbacks, mutation, arithmetic, control flow, LLVM/runtime execution |
| Tagged User Cleanup | `tests/programs/tagged_user_cleanup.cmake` | Implemented | `ptr<User[]>` parameters, value and pointer iteration over array pointers, string equality, boolean negation, dynamic array `splice`, struct mutation, `.length`, LLVM/runtime execution |
| Player Scoreboard | `tests/programs/player_scoreboard.cmake` | Implemented | returned pointers into dynamic array cells, struct field pointer mutation, `push`, value iteration over `ptr<Player[]>`, function calls, LLVM/runtime execution |
| Matrix Report | `tests/programs/matrix_report.cmake` | Implemented | fixed-shape matrix row views, returned/materialized views, global view retention, value-parameter isolation, LLVM/runtime execution |
| Sales Destructuring Report | `tests/programs/sales_destructuring_report.cmake` | Implemented | array destructuring, rest bindings, tuple-rest annotations, `entries()` destructuring, structs, function calls, LLVM/runtime execution |
| Array Storage Policy Report | `tests/programs/array_storage_policy_report.cmake` | Implemented | contiguous vs pointer-safe array storage, live interior pointers, fixed-shape indexing, functions, LLVM/runtime execution |
| Native Signal Processor | `tests/programs/native_signal_processor.cmake` | Implemented | extern native numeric array ABI, temporary contiguous buffers, mutable copy-back through `ptr<number[]>`, fixed-shape matrix dimensions, static native library linking, LLVM/runtime execution |
| Native Reading Calibrator | `tests/programs/native_reading_calibrator.cmake` | Implemented | extern native plain numeric struct array ABI, `Struct* + length` marshalling, mutable copy-back through `ptr<Struct[]>`, static native library linking, LLVM/runtime execution |
| Native Dictionary Lookup | `tests/programs/native_dictionary_lookup.cmake` | Implemented | extern native `string[]` ABI, temporary `const char** + length` marshalling, native lookup, original array preservation, static native library linking, LLVM/runtime execution |

## Rules

Program Tests must use only language features that Yogi currently supports.

They should not introduce future syntax just because TypeScript supports it.
Yogi is TypeScript-like syntactically, but strict and RAII-oriented
semantically.

Good Program Tests feel like small applications:

- inventory manager
- contact manager
- matrix operations
- graph traversal
- expression evaluator
- scheduler

Focused feature tests still belong in `tests/runtime/sessions/`.

## Growth Policy

Every major language feature should eventually appear inside at least one
Program Test when it can be used naturally.

Examples:

- new pointer behavior should appear in a program that benefits from pointers
- new array behavior should appear in a program using realistic collection logic
- new struct/data-type behavior should appear in a real custom data model
- new control-flow behavior should appear inside an algorithm

Program Tests should grow with the language instead of staying as tiny examples.
They do not need to wait for an entire feature family to be finished; add one
when the implemented subset can form a coherent program that a user might
actually write.
