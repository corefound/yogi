# Lot 30 - Pointer Core

This lot adds the first native pointer surface to Yogi:

```ts
ptr<T>
&value
```

The design sentence is:

```text
ptr<T> is Yogi's explicit pointer type, and &value creates a pointer to addressable storage. Pointer behavior is explicit; normal values do not implicitly become pointers, and pointers do not implicitly become values.
```

## Supported

Pointer type syntax:

```ts
let age: number = 10
let p: ptr<number> = &age
let pp: ptr<ptr<number>> = &p
```

Pointers to aggregate descriptors/storage:

```ts
let values: number[] = [1, 2, 3]
let p: ptr<number[]> = &values
```

Pointers to fixed-shape arrays:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let p: ptr<number[2, 3]> = &matrix
```

Pointer values can be copied when the pointer type matches exactly:

```ts
let p2: ptr<number> = p
```

Pointers can also be created from `const` storage. The visible type is still
`ptr<T>`, but the semantic node carries readonly provenance internally:

```ts
const locked: number = 20
let p: ptr<number> = &locked
let copy: ptr<number> = p
```

Function calls can receive pointer values:

```ts
function acceptsPointer(value: ptr<number>): void {
    print(1)
}

acceptsPointer(&age)
```

## Rules

- `ptr<T>` appears only in type positions.
- `&value` appears in expression positions.
- `&value` has type `ptr<typeof value>`.
- Address-of is currently supported only for variables.
- Normal values do not implicitly convert to pointer values.
- Pointer values do not implicitly convert to normal values.
- Pointer pointee types must match exactly.
- `&constValue` is valid.
- Pointer mutability is provenance-based: pointers derived from `let` storage are mutable, and pointers derived from `const` storage are readonly.
- Pointer copy preserves provenance.
- Pointer arithmetic is rejected in safe Yogi.

## Rejected

Missing address-of:

```ts
let age: number = 10
let p: ptr<number> = age
```

Pointer-to-value:

```ts
let age: number = 10
let p: ptr<number> = &age
let value: number = p
```

Wrong pointee:

```ts
let age: number = 10
let p: ptr<string> = &age
```

Temporary address-of:

```ts
let p: ptr<number> = &(10 + 20)
let q: ptr<number[3]> = &[1, 2, 3]
```

Pointer arithmetic:

```ts
let age: number = 10
let p: ptr<number> = &age
let q: ptr<number> = p + 1
```

## SIR And LLVM

`ptr<T>` serializes as:

```text
TypeRef.kind = pointer_type
TypeRef.element_type = T
```

`&value` serializes as:

```text
AddressOfExpression {
  target: ValueRef
  type: ptr<T>
  root_symbol_id: number
  root_name: string
  access_path: string[]
  permission: "mutable" | "readonly"
}
```

LLVM lowering uses pointer values directly:

```text
ptr<T> -> LLVM pointer to T storage
&local -> alloca/global address
pointer assignment -> pointer copy
```

For dynamic arrays, `ptr<number[]>` points at the array descriptor/value storage, not directly at the heap element buffer.

## Current Limitations

- Mutation-through-pointer.
- Pointer array indexing.
- Pointer partial views such as `ptr<number[2, 3]>[0] -> ptr<number[3]>`.
- Dereference operator.
- Borrow summaries for functions that return pointer-derived views.

## Tests

CTest:

```txt
yogi_pipeline_pointer_core
```

The suite covers:

- pointer to local number storage
- pointer to fixed-shape array storage
- pointer to dynamic array storage
- pointer value copy
- pointer copy from readonly provenance
- pointer-to-pointer
- function pointer parameter
- `&const` positive behavior
- missing address-of diagnostics
- pointer-to-value diagnostics
- wrong pointer type diagnostics
- temporary address-of diagnostics
- pointer arithmetic diagnostics
