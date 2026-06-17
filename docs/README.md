# Yogi Documentation

Yogi is a programming language with TypeScript-like syntax and an ahead-of-time
native backend. The frontend accepts familiar TypeScript forms, but the semantic
model is intentionally stricter and closer to systems programming:

- Types must be explicit.
- Variables must be initialized.
- `var` is not allowed.
- `let` is mutable and `const` is immutable.
- Values are local by default.
- Heap allocation is reserved for values that escape, dynamic storage, or future
  ownership features.

The compiler currently lowers source code through this pipeline:

```text
.io source
  -> TypeScript-style parser AST
  -> AST FlatBuffer
  -> semantic analysis
  -> Semantic Intermediate Representation FlatBuffer
  -> LLVM IR
  -> object file
  -> linked executable
```

## Documents

- [Frontend Pipeline](frontend-pipeline.md)
- [Variables](variables.md)
- [Externs](externs.md)
- [Memory Model](memory-model.md)
- [Function Ownership](ownership.md)
- [Move-State Validation](move-state-validation.md)
- [Destructor Scheduling](destructor-scheduling.md)
- [Loops and Aggregate Methods](loops-and-methods.md)
- [Runtime Debug Ownership](runtime-debug.md)
- [Runtime Allocator](runtime-allocator.md)
- [Runtime Memory Telemetry](runtime-memory-telemetry.md)
- [Backend and LLVM](backend-llvm.md)

These docs describe the current implementation plus the intended direction when
a feature is still partial.

## Test Layout

Runtime pipeline tests are grouped by implementation session:

- `tests/runtime/unit/`: C++ runtime unit tests.
- `tests/runtime/sessions/01-runtime/`: runtime ABI and `any` behavior.
- `tests/runtime/sessions/02-variables-aggregates/`: variables, dynamic expressions, arrays, tuples, and objects.
- `tests/runtime/sessions/03-memory-management/`: escape analysis, ownership, destructor scheduling, and move-state validation.
- `tests/runtime/sessions/04-control-flow/`: loops, `break`, and TypeScript-style `switch` behavior.
