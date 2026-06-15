# Backend and LLVM

The C++ backend reads the frontend FlatBuffers and lowers SIR into LLVM.

## Inputs

The backend receives the global metadata path from the frontend. The metadata
lists every parsed module, each module cache path, and external links required by
the program.

For each module, the backend reads:

```text
packages/.cache/modules/<module-name>/sir.fb
```

## LLVM Outputs

Each lowered module writes:

```text
packages/.cache/modules/<module-name>/<module>.ll
packages/.cache/modules/<module-name>/<module>.o
```

The `.ll` file is useful for debugging the generated LLVM IR. The `.o` file is
the object file consumed by the final link step.

## Linking

The backend links module object files into a final executable:

```text
packages/.cache/yogi
```

LLD is used through the LLVM toolchain configured by CMake. External links from
global metadata are included in the final link step.

The generated executable link also receives the Yogi runtime archive and, when
needed, the allocator archive selected by `YOGI_ALLOCATOR`. The backend still
emits calls only to `yogi_alloc`, `yogi_realloc`, and `yogi_free`; concrete
allocator calls stay inside the runtime.

## Runtime ABI

Generated LLVM IR calls the Yogi runtime for behavior that should not be
hand-written repeatedly in IR.

Runtime responsibilities currently include:

- `any` boxing and casting.
- Object property storage.
- Array element storage.
- Aggregate descriptor initialization and cleanup.
- Allocator abstraction.

Examples of runtime calls emitted by aggregate lowering:

```text
yogi_object_create
yogi_object_init
yogi_object_set
yogi_object_get
yogi_object_drop
yogi_array_create
yogi_array_init
yogi_array_set
yogi_array_get
yogi_array_drop
```

## Function Visibility

Functions are internal by default. Exported functions receive external linkage
so other modules can reference them. Internal functions are kept private at the
LLVM module level, which avoids symbol collisions and keeps the native boundary
explicit.

## C++ Source Layout

The LLVM backend is split by responsibility:

```text
src/core/llvm/
  context/    shared LLVM module state and helper utilities
  driver/     public lowering entry point used by the compiler driver
  linking/    final executable link step and external library handling
  lowering/   SIR-to-LLVM lowering for types, values, statements, declarations
  modules/    per-module lowering orchestration
  output/     LLVM IR and object file emission
```

This mirrors the frontend style: each phase has a home, and future features can
grow inside the right layer instead of making a single flat backend folder.
