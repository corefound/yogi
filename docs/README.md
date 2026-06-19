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
.ts/.io source
  -> TypeScript-style parser AST
  -> AST FlatBuffer
  -> semantic analysis
  -> Semantic Intermediate Representation FlatBuffer
  -> LLVM IR
  -> object file
  -> linked executable
```

## Documents

### Frontend And Language Semantics

- [Frontend Pipeline](frontend-pipeline.md)
- [Variables](variables.md)
- [Externs](externs.md)
- [Loops and Aggregate Methods](loops-and-methods.md)
- [Package Manager CLI](package-manager.md)

### Memory And Ownership

- [Memory Model](memory-model.md)
- [Function Ownership](ownership.md)
- [Aggregate Assignment Ownership](memory/aggregate-assignment.md)
- [Move-State Validation](move-state-validation.md)
- [Destructor Scheduling](destructor-scheduling.md)

### Runtime

- [Runtime Debug Ownership](runtime-debug.md)
- [Runtime Allocator](runtime-allocator.md)
- [Runtime Memory Telemetry](runtime-memory-telemetry.md)

### Backend

- [Backend and LLVM](backend-llvm.md)

### Lots

- [Array Serialization](lots/02-array-serialization.md)
- [Runtime Array Lowering](lots/03-array-pop-at-lowering.md)
- [Non-Callback Array Methods](lots/05-array-methods-without-callbacks.md)
- [Array Copy and Splice Methods](lots/06-array-copy-splice-methods.md)
- [Array With and Range Diagnostics](lots/07-array-with-range-diagnostics.md)
- [Array Named Callback Methods](lots/08-array-named-callback-methods.md)
- [Array Inline Callback Expressions](lots/09-array-inline-callbacks.md)
- [Array At And Richer Print](lots/10-array-at-and-print.md)

### To Do

- [Arrays](todo/arrays.md)

### Testing

- [Runtime Test Organization](testing/runtime-test-organization.md)

### Audits

- [Switch/Case/Default Audit](audit/control-flow/switch-case-default-audit.md)
- [Aggregate Assignment Ownership Audit](audit/memory/aggregate-assignment-ownership-audit.md)

These docs describe the current implementation plus the intended direction when
a feature is still partial.

## Test Layout

Runtime pipeline tests are grouped by implementation session:

- `tests/runtime/unit/`: C++ runtime unit tests.
- `tests/runtime/sessions/01-runtime/`: runtime ABI and `any` behavior.
- `tests/runtime/sessions/02-variables-aggregates/`: variables, dynamic expressions, arrays, tuples, and objects.
- `tests/runtime/sessions/03-memory-management/`: escape analysis, ownership, destructor scheduling, and move-state validation.
- `tests/runtime/sessions/04-control-flow/`: loops, `break`, and TypeScript-style `switch` behavior.
