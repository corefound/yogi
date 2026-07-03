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
.ts source
  -> TypeScript-style parser AST
  -> AST FlatBuffer
  -> semantic analysis
  -> Semantic Intermediate Representation FlatBuffer
  -> LLVM IR
  -> object file
  -> linked executable
```

## Language Status

This section summarizes where Yogi stands today. It is derived from the
`docs/` folder and updated as implementation lots land.

### Implemented and Working

- **Core language surface**
  - `let` (mutable) and `const` (immutable) declarations.
  - `var` is rejected.
  - Explicit type annotations are required; type inference is not used.
  - Variables must be initialized.
  - Primitive types: `number`, `string`, `boolean`, `void`, `undefined`, `null`, `any`.
  - `any` requires an explicit cast before use as a concrete type.
  - Union types and basic equality narrowing.
  - `null`/`undefined` coalescing (`??`, `??=`).

- **Aggregates and structured data**
  - Fixed-shape object literals, `type` aliases, and `interface` contracts.
  - Tuples: `[number, string]`.
  - Dynamic 1D arrays: `T[]`.
  - Fixed-size 1D arrays: `T[N]`.
  - Fixed-shape multidimensional arrays: `T[N, M]` with coordinate indexing `m[i, j]`.
  - Partial array indexing produces borrowed views; `.copy()` creates an owned copy.
  - Readonly propagation through borrowed array views.
  - Array spread in dynamic, fixed, tuple, and union contexts.
  - Array iterator protocol and `for...of` over arrays and strings.
  - Common array methods (mutating, non-mutating, and callback-based) including
    `map`, `filter`, `reduce`, `find`, `flat`, `with`, `sort`, `toSorted`, etc.

- **Structs**
  - Real `struct` declarations that lower to named LLVM struct types.
  - Struct fields with primitives, strings, arrays, nested structs, and inherited members.
  - Struct extension from other structs, interfaces, and object-like type aliases.
  - Generic interfaces/type aliases with real substitution, defaults, and constraints.
  - Readonly and optional properties in interfaces, type aliases, and struct bodies.
  - Object-like intersection types.
  - `layout()` and `validate()` hooks with inherited validate chains.
  - Numeric scalar structs with explicit `IntegerLayout` lowering to fixed-width integers.
  - Explicit object-literal adapters between real structs and object-runtime contracts.

- **Pointers and addressability**
  - Explicit `ptr<T>` type and `&value` address-of expression.
  - Pointer parameters and pointer assignment with provenance tracking.
  - Read/write through scalar, fixed-array, fixed-matrix, and dynamic 1D array pointers.
  - Provenance-based mutability: `&const` produces readonly pointers.
  - Function pointer read/write summaries that reject `&const` arguments for may-write params.

- **Functions and control flow**
  - Function declarations with explicit parameter and return types.
  - `if` / `else`, `while`, classic `for`, `for...of`, `switch`, `break`, `continue`.
  - TypeScript-style `switch` fall-through with definite-assignment validation.
  - Exported/internal function visibility.

- **Memory and ownership**
  - Stack-first local lifetime model.
  - Escape analysis for globals, exports, returned aggregates, and alias chains.
  - Function-effect summaries (`returnsParam`, `storesParam`, `mutatesParam`, etc.).
  - Aggregate assignment ownership (local-to-global, alias chains, returned values).
  - Destructor scheduling across common control flow including early returns,
    `break`, and `continue`.
  - RAII-like cleanup for non-escaping aggregates.

- **Externs and runtime**
  - `extern` blocks for external functions and variables.
  - External link inputs: `.a`, `.dylib`, `.so`, `.asm`.
  - Runtime allocator abstraction (mimalloc / jemalloc / system).
  - Runtime debug ownership checks (double free, use-after-drop, leak reports).
  - Runtime memory telemetry with source-location attribution.
  - Builtin `print(...)` for primitives, arrays, tuples, and strings.

- **Tooling and build**
  - Package-manager CLI: `yogi init`, `yogi build`, `yogi run`, `yogi start`,
    direct-file compile.
  - Ahead-of-time compilation to native executables through LLVM and LLD.

### In Progress / Partial

- `do while` loops.
- `for...in` loops over arrays and objects.
- Object helper methods `keys()`, `values()`, `entries()`.
- Pointer partial views for fixed-shape arrays (`ptr<number[2, 3]>[0] -> ptr<number[3]>`).
- Borrow summaries adjusted for `ptr<T>` parameter returns.
- Returning pointers and views with lifetime rules.
- Object and struct field addressability (`&object.field`, `&struct.field`).
- Dynamic shaped arrays (`Array<T, Rank>`) with runtime dimensions.
- Final audit of all JavaScript/TypeScript Array methods.
- Final audit of all JavaScript/TypeScript String methods.
- More precise cleanup for string temporaries in complex control flow and callbacks.
- Explicit copy/move constructors for resource-owning structs.
- Escape analysis for closures and captured variables.

### Not Started / Future Work

- Function-value model for interface/type behavior contracts (methods as values).
- Higher-order type machinery: mapped, conditional, `infer`, `keyof`-style operators.
- Full closure capture with lifetime rules.
- Reference counting or shared ownership.
- Explicit `move` / `consume` syntax.
- Lazy iterator objects.
- Native fixed-shape ABI without runtime array descriptors.
- Complete C ABI interop rules for aggregates, pointers, and arrays.
- Dynamic key/value collection type (`map<K, V>`).
- Dynamic index signatures in object types (intentionally not supported).
- Regular expressions and string methods that depend on them (`match`, `split`, etc.).
- Unicode-aware string semantics (current runtime is byte-oriented).
- Catchable exceptions / error handling.
- A full standard library.

## Documents

### Frontend And Language Semantics

- [Frontend Pipeline](docs/frontend-pipeline.md)
- [Variables](docs/variables.md)
- [Externs](docs/externs.md)
- [Loops](docs/loops.md)
- [Package Manager CLI](docs/package-manager.md)

### Memory And Ownership

- [Memory Model](docs/memory-model.md)
- [Function Ownership](docs/ownership.md)
- [Aggregate Assignment Ownership](docs/memory/aggregate-assignment.md)
- [Move-State Validation](docs/move-state-validation.md)
- [Destructor Scheduling](docs/destructor-scheduling.md)

### Runtime

- [Runtime Debug Ownership](docs/runtime-debug.md)
- [Runtime Allocator](docs/runtime-allocator.md)
- [Runtime Memory Telemetry](docs/runtime-memory-telemetry.md)

### Backend

- [Backend and LLVM](docs/backend-llvm.md)

### Control Flow

- [Loops And Iterator Protocol](docs/loops.md)

### Lots

- [Array Serialization](docs/lots/02-array-serialization.md)
- [Runtime Array Lowering](docs/lots/03-array-pop-at-lowering.md)
- [Non-Callback Array Methods](docs/lots/05-array-methods-without-callbacks.md)
- [Array Copy and Splice Methods](docs/lots/06-array-copy-splice-methods.md)
- [Array With and Range Diagnostics](docs/lots/07-array-with-range-diagnostics.md)
- [Array Named Callback Methods](docs/lots/08-array-named-callback-methods.md)
- [Array Inline Callback Expressions](docs/lots/09-array-inline-callbacks.md)
- [Array At And Richer Print](docs/lots/10-array-at-and-print.md)
- [Array Stringification And Ordering](docs/lots/11-array-stringification-and-ordering.md)
- [Array Completion](docs/lots/12-array-completion.md)
- [Iterator Protocol And Loops](docs/lots/13-iterator-protocol-and-loops.md)
- [String Operators And Template Literals](docs/lots/14-string-operators-and-template-literals.md)
- [String Methods](docs/lots/15-string-methods.md)
- [String Lifetime And Array At Extraction](docs/lots/16-string-lifetime-and-array-at.md)
- [String Expression Temporaries](docs/lots/17-string-expression-temporaries.md)
- [Strict String Method Batch](docs/lots/18-strict-string-methods.md)
- [Strict Operator Semantics](docs/lots/19-strict-operator-semantics.md)
- [Struct Declarations](docs/lots/20-struct-declarations.md)

### To Do

- [Language Status](docs/todo/language-status.md)
- [Arrays](docs/todo/arrays.md)
- [Strings](docs/todo/strings.md)

### Testing

- [Runtime Test Organization](docs/testing/runtime-test-organization.md)

### Audits

- [Switch/Case/Default Audit](docs/audit/control-flow/switch-case-default-audit.md)
- [Aggregate Assignment Ownership Audit](docs/audit/memory/aggregate-assignment-ownership-audit.md)

These docs describe the current implementation plus the intended direction when
a feature is still partial.

## Test Layout

Runtime pipeline tests are grouped by implementation session:

- `tests/runtime/unit/`: C++ runtime unit tests.
- `tests/runtime/sessions/01-runtime/`: runtime ABI and `any` behavior.
- `tests/runtime/sessions/02-variables-aggregates/`: variables, dynamic expressions, arrays, tuples, and objects.
- `tests/runtime/sessions/03-memory-management/`: escape analysis, ownership, destructor scheduling, and move-state validation.
- `tests/runtime/sessions/04-control-flow/`: loops, `break`, and TypeScript-style `switch` behavior.
