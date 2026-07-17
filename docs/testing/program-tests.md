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

