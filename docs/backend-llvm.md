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
packages/.cache/bin/main
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
- Builtin `print(...)` output.

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
yogi_print_number
yogi_print_boolean
yogi_print_string
yogi_print_any
```

## Pointer Values

Yogi pointer syntax is explicit:

```ts
let age: number = 10
let p: ptr<number> = &age
let value: number = *p
(*p) = 20
```

The frontend serializes `ptr<T>` as a SIR `TypeRef` with:

```text
kind = pointer_type
element_type = T
```

The address-of expression `&value` is serialized as `AddressOfExpression`.
The explicit dereference expression `*p` is serialized as
`DereferenceExpression`. Address-of is supported for variables and lowers to
the storage address for that local/global binding.

LLVM lowering uses pointer values directly:

```text
ptr<T> -> LLVM pointer to T storage
&local -> alloca/global address
pointer assignment -> pointer value copy
*p read -> LLVM load for scalar pointees
(*p) = value -> LLVM store for scalar pointees
```

For aggregate pointees, dereference produces a borrowed view/descriptor rather
than a deep copy. Full aggregate assignment through dereference is rejected for
now; element mutation should use pointer indexing such as `matrix[row, col] =
value` or `(*matrix)[row, col] = value`.

## Fixed-Shape Arrays

Fixed-shape arrays use Yogi's rectangular coordinate syntax:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

print(matrix[1, 2])
```

The frontend preserves shape metadata in SIR `TypeRef`:

```text
kind = array_type
fixed = true
shape = [2, 3]
element_type = number
```

The backend currently lowers fixed-shape literals to a flat runtime array
descriptor using row-major order. For `number[2, 3]`, the descriptor stores six
elements:

```text
[1, 2, 3, 4, 5, 6]
```

Full coordinate indexing computes a row-major offset:

```text
matrix[1, 2] => 1 * 3 + 2 => 5
```

Partial indexing creates a borrowed, non-owning view descriptor:

```ts
let row: number[3] = matrix[1]
```

The view descriptor stores:

```text
source array descriptor
base offset into row-major storage
visible length for the remaining shape
borrowed/non-owning ownership bit
```

No elements are copied for supported local partial indexing. Reads and writes
through the view are forwarded to the original storage:

```ts
row[2] = 99
print(matrix[1, 2]) // 99
```

Readonly ownership is enforced before lowering. A borrowed view from a `const`
or readonly fixed-shape owner remains readonly even when stored in a `let`
binding:

```ts
const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: number[3] = matrix[1]

print(row[2]) // ok
row[0] = 99  // semantic error
```

The LLVM/runtime view ABI is unchanged for this rule. The compiler carries the
readonly source metadata in SIR/semantic nodes and rejects mutation before
emitting `yogi_array_set` or mutating array method calls.

The view descriptor itself is cleaned up normally, but it does not destroy the
borrowed storage. Returning a partial view from a local fixed-shape array without
an explicit copy is rejected:

```ts
function bad(): number[3] {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    return matrix[1]
}
```

The explicit owned path is `.copy()`:

```ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    return matrix[1].copy()
}
```

The backend lowers `array.copy` by evaluating the receiver, allocating
`yogi_array_create(yogi_array_length(receiver))`, and copying elements with
`yogi_array_get`/`yogi_array_set`. For borrowed fixed-shape views, this copies
only the selected view shape. Parameter-borrow summaries now cover returned
pointer-derived views from `ptr<T>` parameters; explicit borrowed return/view
syntax remains future work.

The next backend step is replacing descriptor-backed fixed-shape storage with a
native fixed-shape ABI when the value never needs runtime array behavior.

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
