# Yogi Pointer Implementation Checklist

This document tracks the full pointer model for Yogi/Joki.

It is meant to be a living implementation checklist. Update each checkbox from `[ ]` to `[x]` as the compiler supports the feature.

---

## 0. Final Design Summary

Yogi pointer syntax is:

```ts
ptr<T>
&value
```

Meaning:

```txt
T        = normal value/local semantics
ptr<T>   = pointer to addressable storage shaped as T
&value   = address-of expression producing ptr<T>
```

Pointers are explicit. Values do not become pointers automatically. Scalar
`ptr<T>` values can be read through in scalar value contexts, and scalar pointer
bindings can be written through with `p = value`. Aggregate pointers do not
silently become owned aggregate values.

Yogi does **not** use:

```ts
ptr<const T>
readonly ptr<T>
ref T
borrow T
mut T
ptr(value)
value.ptr
value.ref
*p
(*p) = value
```

Pointer mutability is provenance-based:

```txt
ptr<T> does not encode mutability in the visible type.
The original storage decides whether write-through is allowed.

&letValue   -> ptr<T> with mutable permission
&constValue -> ptr<T> with readonly permission
```

This means `&constValue` is valid. The only invalid operation is mutating through a pointer derived from const storage.

---

## 1. Design Decisions

- [x] `ptr<T>` is the official visible pointer type.
- [x] `&value` is the official address-of syntax.
- [x] `ptr<T>` can point to `let` storage.
- [x] `ptr<T>` can point to `const` storage.
- [x] No `ptr<const T>` syntax.
- [x] No `readonly` pointer syntax.
- [x] No implicit value-to-pointer conversion.
- [x] No implicit aggregate pointer-to-owned-value conversion.
- [x] Scalar pointer read-through in scalar value contexts.
- [x] Public `*p` dereference syntax is rejected.
- [x] Public `(*p) = value` syntax is rejected.
- [x] No pointer arithmetic in safe/default Yogi.
- [x] Pointer mutability is tracked internally through provenance/permission.
- [x] `const p: ptr<T>` means the pointer binding cannot be reassigned.
- [x] `const p: ptr<T>` does not mean the pointed storage is readonly.
- [x] Pointed storage mutability comes from the root storage: `let` or `const`.

---

## 2. Core Type Support

### Parser / Type AST

- [x] Parse `ptr<T>` in type positions.
- [x] Parse nested pointer types: `ptr<ptr<number>>`.
- [x] Parse pointer to primitive: `ptr<number>`.
- [x] Parse pointer to string: `ptr<string>`.
- [x] Parse pointer to boolean: `ptr<boolean>`.
- [x] Parse pointer to dynamic array descriptor: `ptr<number[]>`.
- [x] Parse pointer to fixed array: `ptr<number[3]>`.
- [x] Parse pointer to fixed matrix: `ptr<number[2, 3]>`.
- [ ] Parse pointer to custom type: `ptr<User>`.
- [ ] Parse pointer to object/dictionary type: `ptr<{ age: number }>` if inline object types are supported.

### Semantic Type Representation

- [x] Add `PointerType` to the internal type system.
- [x] `PointerType` stores `pointeeType`.
- [x] `PointerType` supports equality comparison.
- [x] `ptr<T>` assignability requires compatible `T`.
- [x] `ptr<T>` and `T` are distinct types.
- [x] `ptr<ptr<T>>` and `ptr<T>` are distinct types.

Examples:

```ts
let age: number = 10
let p: ptr<number> = &age
```

```ts
let age: number = 10
let p: ptr<number> = &age
let pp: ptr<ptr<number>> = &p
```

---

## 3. Address-Of Expression: `&value`

### Parser / AST

- [x] Parse `&expr` as `AddressOfExpression`.
- [x] Preserve source spans for diagnostics.
- [x] Support `&identifier`.
- [x] Support parenthesized addressable expressions: `&(age)`.
- [x] Support direct and nested struct fields: `&point.x`, `&box.point.x`.
- [x] Support runtime object fields through addressable cells: `&user.age`.
- [x] Support full array element cells: `&values[0]`, `&matrix[1, 2]`.
- [x] Reject temporary expressions: `&(10 + 20)`.
- [ ] Reject literal expressions: `&10`, `&"hello"`, `&true`.
- [x] Reject array literals: `&[1, 2, 3]`.
- [ ] Reject object literals directly: `&{ age: 20 }`.
- [x] Reject function call result unless future rules explicitly allow addressable returns.

### Type Rules

- [x] `&expr` has type `ptr<typeof expr>`.
- [x] `&letValue` is valid and gets mutable permission.
- [x] `&constValue` is valid and gets readonly permission.
- [x] Address-of requires a stable l-value path.
- [x] Address-of does not copy the value.

Examples:

```ts
let age: number = 10
let p: ptr<number> = &age
```

```ts
const age: number = 10
let p: ptr<number> = &age
```

Invalid:

```ts
let p: ptr<number> = &(10 + 20)
```

Expected diagnostic:

```txt
error: cannot take address of temporary expression
```

---

## 4. Addressability Model

Implement a semantic concept similar to:

```txt
isAddressable(expr) -> boolean
getAddressableRoot(expr) -> root storage symbol
getAccessPath(expr) -> field/index projection path
getPointerPermission(root) -> mutable | readonly
```

Checklist:

- [x] Local variables are addressable.
- [x] Global variables are addressable.
- [x] Function parameters are addressable if they have real storage.
- [x] Parenthesized l-values preserve addressability.
- [x] Direct real struct field access is addressable if the root is addressable.
- [x] Nested struct field access is addressable if the root is addressable.
- [x] Runtime object field access is addressable through runtime cells.
- [x] Dynamic array element access is addressable through runtime cells.
- [x] Fixed array element access is addressable through row-major runtime cells.
- [x] Fixed matrix element access is addressable through row-major runtime cells.
- [x] Struct field projections through `ptr<Struct>` are addressable.
- [ ] Fixed partial array/matrix views are addressable if the root is addressable.
- [x] Runtime object/dictionary property addressability keeps a real cell pointer instead of a fake raw address.
- [x] Array element addressability keeps a real element cell pointer instead of a fake raw address.
- [x] Temporaries are not addressable.
- [x] Literals are not addressable.
- [x] Function call results are not addressable by default.
- [x] Binary/unary computed expressions are not addressable.

---

## Pointer / Addressability / Aggregate Assignment TODO

### Completed

- ✅ `ptr<T>` core type
- ✅ `&value`
- ✅ scalar pointer read-through: `let x: number = p`
- ✅ scalar pointer write-through: `p = 42`
- ✅ pointer rebind: `p = &other`
- ✅ `&struct.field`
- ✅ nested struct address-of: `&box.point.x`
- ✅ array/object runtime scalar cells: `&values[i]`, `&matrix[i, j]`, `&object.field`
- ✅ direct nested struct field assignment: `box.point.x = value`
- ✅ deeper nested struct field assignment: `box.point.x.value = value`
- ✅ projections through `ptr<Struct>`: `pBox.point.x = value`
- ✅ returning field pointers from `ptr<Struct>` parameters: `return &box.point.x`
- ✅ nested runtime object cell chains: `&user.address.zip`
- ✅ mixed array/object/struct chains: `&users[0].age`
- ✅ pointer invalidation diagnostics for dynamic arrays
- ✅ dynamic array `push` remains valid while a live interior pointer points into the array
- ✅ JavaScript-style mutating methods are allowed with live dynamic-array pointers when slot identity can be tracked
- ✅ removed dynamic-array element slots invalidate only pointers to removed element identities
- ✅ `pop`, `shift`, and `splice` report runtime pointer errors when a removed slot pointer is used later
- ✅ `unshift`, `reverse`, and `sort` preserve existing dynamic-array pointer identities
- ✅ `fill` and `copyWithin` preserve slot identity while overwriting current slot values
- ✅ dynamic array assignment preserves common slot identities, creates extra slots, and invalidates removed slots
- ✅ pointer rebind updates which dynamic array root is protected
- ✅ pointer scope end releases the protected dynamic array root
- ✅ adaptive dynamic array storage selection: contiguous by default, pointer-safe only when growth overlaps a live interior pointer
- ✅ readonly root rejection for nested field mutation
- ✅ RHS type checking for nested field mutation

### Pending

- ⬜ natural aggregate pointer replacement: `ptr<T> = T` for fixed arrays and structs
- ⬜ correct full mutability matrix for `let/const owner` and `let/const ptr`
- ⬜ pointer invalidation diagnostics for dynamic object storage, if object storage becomes structurally mutable
- ⬜ pointer-return provenance from `ptr<Array>` parameters into dynamic array cells
- ⬜ partial pointer views: `&matrix[0]` / `matrix[0] -> ptr<number[3]>`
- ⬜ dynamic shaped arrays: `Array<T, Rank>`
- ⬜ dynamic runtime-rank arrays: `Array<T>`
- ⬜ `ptr<Array<T, Rank>>` and `ptr<Array<T>>`
- ⬜ union support for dynamic shaped arrays
- ⬜ final diagnostics polish

### Known Limitations

- ⚠️ `&matrix[0]` remains rejected because it is a partial view, not a scalar cell.
- ⚠️ Dynamic array pointer validity currently uses runtime checks for removed slots; richer compile-time diagnostics for provable invalidated pointer use are still pending.
- ⚠️ Function returns from `ptr<Array>` parameters into dynamic array cells are still pending because address-of through pointer-derived array access is currently rejected.

### Philosophy

Yogi pointers are explicit in types, not noisy in expressions.

Do not require helper functions or C/C++-style syntax for natural pointer
navigation when the operation is type-safe and visually clear.

Yogi should avoid unnecessary helper functions for core language behavior.

If an operation is visually clear, type-safe, and has a natural interpretation
in the language, Yogi should allow it directly.

Helper functions are for algorithms, conversions, bulk operations, unsafe
operations, or special runtime behavior. They should not be required for
ordinary assignment, pointer write-through, or basic aggregate replacement.

---

## 5. Provenance-Based Mutability

Visible pointer type:

```ts
ptr<T>
```

Internal pointer metadata:

```txt
root: SymbolId
accessPath: AccessPath
permission: mutable | readonly
```

Rules:

- [x] Pointer from `let` root gets mutable permission.
- [x] Pointer from `const` root gets readonly permission.
- [x] Pointer copy preserves permission.
- [x] Pointer assignment updates the target variable's current pointer provenance.
- [x] Writing through readonly pointer is rejected.
- [x] Reading through readonly pointer is allowed.
- [x] `const p: ptr<T>` prevents reassignment of `p` only.
- [x] `const p: ptr<T>` does not change pointed storage permission.

Examples:

```ts
let age: number = 10
let p: ptr<number> = &age
// p has mutable permission
```

```ts
const age: number = 10
let p: ptr<number> = &age
// p has readonly permission
```

```ts
let age: number = 10
const p: ptr<number> = &age
// p cannot be reassigned, but pointed storage is mutable because age is let
```

```ts
const age: number = 10
const p: ptr<number> = &age
// p cannot be reassigned, and pointed storage is readonly because age is const
```

---

## 6. Strict Assignability

- [x] Assigning `T` to `ptr<T>` without `&` is rejected.
- [x] Assigning scalar `ptr<T>` to scalar `T` reads through the pointer.
- [x] Assigning aggregate `ptr<T>` to aggregate `T` is rejected unless an explicit API exists.
- [x] Passing `T` to a parameter expecting `ptr<T>` without `&` is rejected.
- [x] Passing scalar `ptr<T>` to scalar parameter `T` reads through the pointer.
- [x] Passing aggregate `ptr<T>` to aggregate parameter `T` is rejected.
- [x] `ptr<number>` is not assignable to `ptr<string>`.
- [x] `ptr<number[2,3]>` is not assignable to `ptr<number[]>`.
- [x] `ptr<ptr<number>>` is not assignable to `ptr<number>`.

Invalid:

```ts
let age: number = 10
let p: ptr<number> = age
```

Expected diagnostic:

```txt
error: expected ptr<number>, got number
help: use '&age' to create a pointer
```

Invalid:

```ts
let age: number = 10
let p: ptr<number> = &age
let value: number = p
```

This is valid for scalar pointees and copies the pointed value. Aggregate
pointees such as `ptr<number[]>` do not perform an implicit owned copy.

Invalid:

```ts
let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let p: ptr<number[2, 3]> = &matrix
let value: number[2, 3] = p
```

Expected diagnostic:

```txt
error: expected number[2, 3], got ptr<number[2, 3]>
```

---

## 7. Pointer Variables and Copying

- [ ] Pointer variables can be declared with `let`.
- [ ] Pointer variables can be declared with `const`.
- [ ] Pointer values can be copied when types match.
- [ ] Copying a pointer does not copy the pointed-to data.
- [ ] Copying a pointer preserves provenance/permission.
- [ ] Pointer-to-pointer works: `ptr<ptr<T>>`.
- [ ] A pointer variable can be reassigned if the binding is `let`.
- [ ] A pointer variable cannot be reassigned if the binding is `const`.

Example:

```ts
let age: number = 10
let p1: ptr<number> = &age
let p2: ptr<number> = p1
```

Example:

```ts
let age: number = 10
let p: ptr<number> = &age
let pp: ptr<ptr<number>> = &p
```

Invalid:

```ts
let age: number = 10
let p: ptr<number> = &age
let pp: ptr<ptr<number>> = p
```

Expected diagnostic:

```txt
error: expected ptr<ptr<number>>, got ptr<number>
```

---

## 8. Function Parameters

Normal parameter:

```ts
function f(value: T): void
```

Uses value/local semantics.

Pointer parameter:

```ts
function f(value: ptr<T>): void
```

Uses explicit pointer/reference semantics.

Checklist:

- [x] Function parameters can use `ptr<T>`.
- [ ] Return types can use `ptr<T>`.
- [x] Call site must pass `&value` or existing pointer for `ptr<T>` parameter.
- [x] Normal value parameter still uses local/value semantics.
- [x] Passing pointer to normal value parameter is rejected.
- [x] Passing normal value to pointer parameter is rejected.
- [x] Pointer parameters can be copied as pointer values.
- [x] Pointer parameters preserve provenance/permission from call site.

Example:

```ts
function acceptsPointer(value: ptr<number>): void {
    print(1)
}

let age: number = 10
acceptsPointer(&age)
```

Invalid:

```ts
acceptsPointer(age)
```

Expected diagnostic:

```txt
error: expected ptr<number>, got number
help: pass '&age'
```

---

## 9. Function Read/Write Summaries

Because `&constValue` is valid, the compiler needs to know whether a function writes through a pointer parameter.

Checklist:

- [x] Analyze function bodies for pointer parameter reads.
- [x] Analyze function bodies for pointer parameter writes.
- [x] Mark pointer parameters as `read-only-use` if only read.
- [x] Mark pointer parameters as `may-write` if write-through occurs.
- [ ] Mark pointer parameters as `returned-view` if returned pointer derives from them.
- [ ] Mark pointer parameters as `retained` if stored globally/heap/closure.
- [x] At call site, allow `&constValue` for read-only pointer params.
- [x] At call site, reject `&constValue` for may-write pointer params.
- [ ] Unknown/external functions are conservative by default.

Read-only function:

```ts
function sum(values: ptr<number[1000]>): number {
    return values[0]
}

const values: number[1000] = loadValues()
sum(&values) // valid
```

May-write function:

```ts
function change(values: ptr<number[1000]>): void {
    values[0] = 99
}

const values: number[1000] = loadValues()
change(&values) // error
```

Expected diagnostic:

```txt
error: function 'change' may mutate pointer parameter 'values', but argument '&values' points to const storage
```

---

## 10. External / Unknown Functions

Checklist:

- [ ] External function pointer parameters are assumed `may-write` by default.
- [ ] Passing `&constValue` to unknown/external pointer parameter is rejected by default.
- [ ] Passing `&letValue` to unknown/external pointer parameter is allowed.
- [ ] Future C ABI metadata may allow explicit read-only external pointer params.
- [ ] No user-facing `readonly` keyword is required in the core pointer model.

Example:

```ts
extern native from "./lib.o" {
    function process(values: ptr<number[1000]>): void
}

const values: number[1000] = loadValues()
process(&values) // error by default
```

Expected diagnostic:

```txt
error: cannot pass pointer derived from const storage to external function 'process' because external pointer parameters are assumed may-write
```

---

## 11. Pointer Reads

Pointer reads use direct scalar read-through or index-style pointer access.

```ts
p             // scalar pointer read-through in scalar value context
p[0]          // scalar pointer access
arrayPtr[i]   // fixed array pointer access
matrixPtr[i,j] // fixed matrix pointer access
```

Checklist:

- [x] Define read from `ptr<number>` using `p[0]`.
- [x] Define read from `ptr<string>` if string pointer access is supported.
- [x] Define read from `ptr<number[N]>` using `p[i]`.
- [x] Define read from `ptr<number[R,C]>` using `p[i,j]`.
- [x] Define read from `ptr<number[]>` using `p[i]`.
- [x] Scalar pointer read-through for variable init, assignment RHS, call args, returns, and `print`.
- [x] Aggregate pointer read-through is rejected to avoid implicit ownership/copy semantics.
- [x] Public `*p` syntax is rejected.

Example:

```ts
let age: number = 10
let p: ptr<number> = &age
let value: number = p[0]
let same: number = p
print(p)
```

---

## 12. Pointer Write-Through

Checklist:

- [x] Assignment through pointer is supported for scalar pointer access.
- [x] Assignment through scalar pointer binding is supported with `p = value`.
- [x] Assignment through fixed array pointer access is supported.
- [x] Assignment through fixed matrix pointer access is supported.
- [x] Write-through checks pointer permission.
- [x] Write-through is allowed for mutable provenance.
- [x] Write-through is rejected for readonly provenance.
- [x] Assigned value type must match pointed element type.

Example:

```ts
let age: number = 10
let p: ptr<number> = &age
p[0] = 20
p = 30
```

`p = value` writes through when `p` has type `ptr<T>` and `value` has scalar
type `T`. `p = &other` rebinds the pointer when `p` is a mutable pointer
binding. Full aggregate replacement through a pointer is rejected so ownership
cannot be accidentally moved through an arbitrary pointer:

```ts
let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let p: ptr<number[2, 3]> = &matrix

p = [[7, 8, 9], [10, 11, 12]] // error
p[1, 2] = 99                  // ok
```

Invalid:

```ts
const age: number = 10
let p: ptr<number> = &age
p[0] = 20
```

Expected diagnostic:

```txt
error: cannot mutate storage derived from const value 'age'
```

---

## 13. Pointers to Fixed Arrays and Matrices

Checklist:

- [x] `&array` produces `ptr<number[N]>` for fixed arrays.
- [x] `&matrix` produces `ptr<number[R,C]>` for fixed matrices.
- [x] Passing `&matrix` to `ptr<number[R,C]>` parameter does not copy the matrix.
- [x] Pointer to fixed array preserves shape.
- [x] Pointer to fixed matrix preserves rank and shape.
- [x] Shape mismatch is rejected.

Example:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let p: ptr<number[2, 3]> = &matrix
```

Invalid:

```ts
let p: ptr<number[3, 2]> = &matrix
```

Expected diagnostic:

```txt
error: expected ptr<number[3, 2]>, got ptr<number[2, 3]>
```

---

## 14. Pointer Indexing for Fixed Arrays and Matrices

Checklist:

- [x] If `values: ptr<number[N]>`, then `values[i]` in read position returns `number`.
- [x] If `values: ptr<number[N]>`, then `values[i] = x` writes through pointer if mutable.
- [x] If `matrix: ptr<number[R,C]>`, then `matrix[i,j]` in read position returns `number`.
- [x] If `matrix: ptr<number[R,C]>`, then `matrix[i,j] = x` writes through pointer if mutable.
- [x] Index rank must match shape for full element access.
- [x] Bounds checking is performed according to Yogi's array rules.
- [x] Const provenance blocks write-through.

Example:

```ts
function change(matrix: ptr<number[2, 3]>): void {
    matrix[0, 2] = 99
}
```

Example:

```ts
function read(matrix: ptr<number[2, 3]>): number {
    return matrix[0, 2]
}
```

---

## 15. Partial Pointer Views

Partial indexing returns a pointer/view into the original storage.

Checklist:

- [x] If `matrix: ptr<number[2,3]>`, then `matrix[0]` returns `ptr<number[3]>`.
- [x] If `image: ptr<number[2,2,3]>`, then `image[1]` returns `ptr<number[2,3]>`.
- [x] If `image: ptr<number[2,2,3]>`, then `image[1,0]` returns `ptr<number[3]>`.
- [x] Full indexing returns scalar value in read position.
- [x] Partial views do not copy.
- [x] Partial views inherit direct provenance/permission.
- [ ] Interprocedural borrow/lifetime summaries for returned pointer-derived views.

Example:

```ts
function firstRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {
    return matrix[0]
}

let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: ptr<number[3]> = firstRow(&matrix)
row[1] = 77
print(matrix[0, 1]) // 77
```

---

## 16. Returning Pointers and Views

Checklist:

- [ ] Returning pointer derived from pointer parameter is allowed.
- [ ] Returning pointer derived from local variable is rejected.
- [ ] Returning pointer/view derived from value parameter is rejected.
- [ ] Returning pointer to field of local object is rejected.
- [ ] Returning pointer to fixed array element of local array is rejected.
- [ ] Returning owned value from view requires `.copy()` where applicable.
- [ ] Borrow summary records returned pointer derivation.

Valid:

```ts
function firstRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {
    return matrix[0]
}
```

Invalid:

```ts
function getCell(): ptr<number> {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return &matrix[0, 0]
}
```

Expected diagnostic:

```txt
error: cannot return pointer to local storage 'matrix'
```

---

## 17. Object / Dictionary Field Pointers

Yogi typed objects/dictionaries are fixed-shape records semantically, but their
current runtime representation stores fields in an object property table.

Rules:

```txt
All object/dictionary fields are known at compile time.
The current backend exposes a real runtime property cell for each field.
&object.field is valid when object is addressable.
```

Checklist:

- [x] Objects/dictionaries have runtime object storage.
- [x] Object/dictionary fields have addressable runtime cells.
- [x] `&object.field` is supported.
- [ ] `&object.nested.field` is supported.
- [x] Result type is `ptr<FieldType>`.
- [x] Unknown field is rejected.
- [x] Field type mismatch is rejected.
- [x] Field from temporary object is rejected.
- [x] Root mutability controls pointer permission.

Example:

```ts
type User = {
    age: number
    score: number
}

let user: User = {
    age: 20,
    score: 90
}

let p: ptr<number> = &user.age
```

Const root:

```ts
const user: User = {
    age: 20,
    score: 90
}

let p: ptr<number> = &user.age
// valid, readonly by root provenance
```

Invalid:

```ts
let p: ptr<number> = &getUser().age
```

Expected diagnostic:

```txt
error: cannot take address of field 'age' from temporary value
```

---

## 18. Struct Field Pointers

Checklist:

- [x] Struct fields have fixed layout.
- [x] `&struct.field` is supported.
- [x] Result type is `ptr<FieldType>`.
- [x] Nested struct fields work.
- [x] Root mutability controls pointer permission.
- [x] LLVM lowering uses field offset / GEP.

Example:

```ts
struct User {
    age: number
    score: number
}

let user: User = {
    age: 20,
    score: 90
}

let p: ptr<number> = &user.age
```

---

## 19. Dynamic Index Signatures Are Not Supported

Yogi object/type/interface shapes are fixed. TypeScript-style dynamic index signatures are prohibited.

Invalid:

```ts
type Scores = {
    [key: string]: number
}
```

Checklist:

- [ ] Reject `[key: string]: T` in object/type/interface declarations.
- [ ] Reject `[key: number]: T` in object/type/interface declarations if it represents open dynamic shape.
- [ ] Reject open object shapes.
- [ ] Diagnostic explains that Yogi requires explicit fields.
- [ ] If future `map<K,V>` exists, recommend it for dynamic key/value storage.
- [ ] `&map[key]` is not supported initially.

Expected diagnostic:

```txt
error: dynamic index signatures are not supported in Yogi object types
help: declare explicit fields or use map<string, number> for dynamic key/value storage
```

---

## 20. Address-Of Fixed Array Elements

Checklist:

- [ ] `&fixedArray[index]` is supported.
- [ ] `&fixedMatrix[i,j]` is supported.
- [ ] `&fixedMatrix[i]` returns pointer to row/subarray.
- [ ] Result type is correct.
- [ ] Root mutability controls pointer permission.
- [ ] Bounds checking applies.
- [ ] Address-of from temporary array is rejected.

Example:

```ts
let values: number[5] = [1, 2, 3, 4, 5]
let p: ptr<number> = &values[2]
```

Example:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let cell: ptr<number> = &matrix[1, 2]
let row: ptr<number[3]> = &matrix[1]
```

---

## 21. Dynamic Array Element Pointers

Dynamic array element pointers are supported through runtime cells. The array
descriptor may grow, but existing element slots remain stable, so `push` does
not invalidate pointers such as `&values[0]` or `&users[0].age`.

Current rule:

```txt
&dynamicArray[index] is supported.
push while an interior pointer is live is supported.
destructive/reordering operations are rejected conservatively while an interior pointer is live.
```

Checklist:

- [x] Support `&dynamicArray[index]`.
- [x] Preserve element slots across `push` when a live interior pointer requires pointer-safe storage.
- [x] Keep normal dynamic arrays on contiguous fast-path storage when no live interior pointer can be invalidated.
- [x] Reject destructive/reordering operations while a live pointer targets the array.
- [x] Add adaptive fast contiguous storage when no live interior pointers can be invalidated.
- [ ] Add index-sensitive checks for destructive operations.

Valid:

```ts
let values: number[] = [1, 2, 3]
let p: ptr<number> = &values[0]
values.push(4)
p = 10
print(values[0]) // 10
```

---

## 22. Pointer Lifetime and Escape Rules

Pointers do not own memory and do not automatically extend lifetime.

Checklist:

- [ ] Pointer to local variable cannot escape its scope.
- [ ] Pointer to local object field cannot escape its scope.
- [ ] Pointer to local array element cannot escape its scope.
- [ ] Pointer stored in global must point to storage that outlives global use.
- [ ] Pointer stored in heap/container requires escape analysis.
- [ ] Pointer captured by closure requires escape analysis.
- [ ] Returning pointer to local storage is rejected.
- [ ] Passing pointer to unknown/external function is conservative.

Invalid:

```ts
let globalPointer: ptr<number>

function store(): void {
    let age: number = 10
    globalPointer = &age
}
```

Expected diagnostic:

```txt
error: pointer to local variable 'age' escapes to global storage
```

Invalid:

```ts
let p: ptr<number>

{
    let age: number = 10
    p = &age
}

print(p[0])
```

Expected diagnostic:

```txt
error: pointer to local variable 'age' escapes its scope
```

---

## 23. Ownership / Move / RAII Interaction

Pointers are non-owning references to storage.

Checklist:

- [ ] Pointer does not free memory.
- [ ] Pointer does not own pointee.
- [ ] Pointer does not extend lifetime by itself.
- [ ] Root storage cannot be destroyed while live pointer can still be used.
- [ ] Moving root storage while pointer exists is rejected or invalidates pointer explicitly.
- [ ] RAII cleanup must respect pointer lifetime/escape analysis.
- [ ] Pointer to root field counts as pointer to root storage for lifetime purposes.

Recommended simple rule:

```txt
While an active pointer to root storage exists, do not allow moving/destroying the root before the pointer's last use.
```

---

## 24. Nullable Pointers

Initial recommendation:

```txt
ptr<T> is non-null by default.
```

Checklist:

- [ ] `ptr<T>` cannot be assigned `null`.
- [ ] `ptr<T>` cannot be assigned `undefined`.
- [ ] Nullable pointer requires union: `ptr<T> | null` if/when supported.
- [ ] Null checks are required before access if nullable pointers are supported.

Invalid:

```ts
let p: ptr<number> = null
```

Expected diagnostic:

```txt
error: expected ptr<number>, got null
```

---

## 25. Pointer Equality

Optional future feature.

Checklist:

- [ ] Define whether `p1 == p2` compares addresses.
- [ ] Define whether pointer equality is allowed across same pointer type only.
- [ ] Reject pointer ordering comparisons: `<`, `>`, `<=`, `>=`.
- [ ] Reject pointer arithmetic.

Possible valid:

```ts
if p1 == p2 {
    print(1)
}
```

Invalid:

```ts
if p1 < p2 {
    print(1)
}
```

Expected diagnostic:

```txt
error: ordering comparison is not supported for pointers
```

---

## 26. Pointer Arithmetic

Pointer arithmetic is not part of safe/default Yogi.

Checklist:

- [ ] Reject `p + 1`.
- [ ] Reject `p - 1`.
- [ ] Reject `p1 - p2`.
- [ ] Use typed indexing instead.

Invalid:

```ts
let age: number = 10
let p: ptr<number> = &age
let q = p + 1
```

Expected diagnostic:

```txt
error: pointer arithmetic is not supported in safe Yogi
help: use typed array/matrix indexing instead
```

---

## 27. SIR Representation

Checklist:

- [x] Add `PointerType` node/variant.
- [x] `PointerType` stores pointee type.
- [x] Add `AddressOfExpression` node/variant.
- [x] `AddressOfExpression` stores target expression.
- [x] `AddressOfExpression` stores result type.
- [x] `AddressOfExpression` stores root symbol/provenance.
- [x] `AddressOfExpression` stores access path.
- [x] `AddressOfExpression` stores permission: mutable/readonly.
- [x] Add pointer read/access expression representation.
- [x] Add pointer write-through representation.
- [x] Add pointer function parameter metadata.
- [x] Add function pointer summary metadata.

Suggested shape:

```txt
PointerType {
    pointeeType: Type
}

AddressOfExpression {
    target: Expression
    resultType: PointerType
    rootSymbol: SymbolId
    accessPath: AccessPath
    permission: Mutable | Readonly
}

AccessPath = [] | Field(name) | Index(expr) | IndexList(expr[])
```

---

## 28. FBS Representation

Checklist:

- [x] Add `pointer_type` to FBS type union/table.
- [x] Add `address_of_expression` to FBS expression union/table.
- [x] Add access path representation.
- [x] Add root symbol/provenance representation.
- [x] Add permission representation: mutable/readonly.
- [x] Add pointer parameter representation.
- [x] Add pointer return type representation.
- [x] Add pointer read/write expressions if needed.
- [x] Add function summary metadata for pointer params.

Suggested fields:

```txt
PointerTypeFbs:
  pointee_type: TypeRef

AddressOfExpressionFbs:
  target_expr: ExprRef
  result_type: TypeRef
  root_symbol_id: SymbolId
  access_path: [AccessPathSegment]
  permission: PointerPermission
```

---

## 29. LLVM Lowering

Checklist:

- [x] Lower `ptr<T>` to LLVM pointer type.
- [x] Lower `&localVariable` to address of local alloca/storage.
- [x] Lower `&globalVariable` to global address.
- [x] Lower `&parameter` to parameter storage address where applicable.
- [x] Lower pointer copy as pointer value copy.
- [x] Lower pointer function argument as address, not pointee copy.
- [x] Lower scalar `p[0]` read as pointee load.
- [x] Lower scalar `p[0] = value` as pointee store.
- [x] Lower scalar read-through as pointee load.
- [x] Lower scalar `p = value` as pointee store.
- [x] Reject public `*p` / `(*p) = value` syntax.
- [x] Lower `&object.field` as a tagged runtime property cell pointer.
- [x] Lower direct and nested `&struct.field` using LLVM struct GEP field index.
- [x] Lower `&fixedArray[index]` / `&matrix[i,j]` as tagged row-major runtime array cells.
- [x] Lower pointer read as LLVM load for raw pointers or `yogi_cell_get` for cell pointers.
- [x] Lower pointer write as LLVM store for raw pointers or `yogi_cell_set` for cell pointers.
- [ ] Do not emit copy of large matrix when passing `&matrix`.
- [ ] Optionally attach readonly/noalias metadata in future when safe.

Conceptual example:

```ts
let p: ptr<number> = &user.age
```

LLVM concept:

```llvm
%fieldPtr = getelementptr %User, ptr %user, i32 0, i32 <ageIndex>
```

---

## 30. Diagnostics Checklist

- [x] `expected ptr<T>, got T`
- [x] `help: use '&value' to create a pointer`
- [x] `expected T, got ptr<T>`
- [x] `expected ptr<X>, got ptr<Y>`
- [x] `cannot take address of temporary expression`
- [x] `cannot take address of temporary string literal`
- [x] `cannot take address of temporary array literal`
- [ ] `cannot take address of object literal`
- [ ] `cannot take address of field from temporary value`
- [ ] `cannot mutate storage derived from const value 'name'`
- [ ] `function 'x' may mutate pointer parameter 'p', but argument '&v' points to const storage`
- [ ] `cannot return pointer to local storage 'name'`
- [ ] `cannot return pointer/view derived from value parameter 'name'`
- [x] dynamic array element pointers use stable runtime cells when semantic analysis selects pointer-safe storage
- [ ] `pointer arithmetic is not supported in safe Yogi`
- [ ] `dynamic index signatures are not supported in Yogi object types`

Removed/obsolete diagnostic:

```txt
cannot create mutable ptr<T> from readonly value
```

That diagnostic must not be used because `&constValue` is valid in the final design.

---

## 31. Core Tests

### Pointer to `let` number

- [ ] Implemented

```ts
let age: number = 10
let p: ptr<number> = &age
print(1)
```

Expected:

```txt
1
```

### Pointer to `const` number

- [ ] Implemented

```ts
const age: number = 10
let p: ptr<number> = &age
print(1)
```

Expected:

```txt
1
```

### Pointer copy

- [ ] Implemented

```ts
let age: number = 10
let p1: ptr<number> = &age
let p2: ptr<number> = p1
print(1)
```

Expected:

```txt
1
```

### Pointer parameter

- [ ] Implemented

```ts
function acceptsPointer(value: ptr<number>): void {
    print(1)
}

let age: number = 10
acceptsPointer(&age)
```

Expected:

```txt
1
```

### Missing address-of

- [ ] Implemented

```ts
let age: number = 10
let p: ptr<number> = age
```

Expected diagnostic:

```txt
expected ptr<number>, got number
use '&age'
```

### Pointer passed to value parameter

- [ ] Implemented

```ts
function acceptsValue(value: number): void {
    print(value)
}

let age: number = 10
acceptsValue(&age)
```

Expected diagnostic:

```txt
expected number, got ptr<number>
```

### Address-of temporary

- [ ] Implemented

```ts
let p: ptr<number> = &(10 + 20)
```

Expected diagnostic:

```txt
cannot take address of temporary expression
```

---

## 32. Provenance Tests

### Write through pointer from `let`

- [ ] Implemented

```ts
let age: number = 10
let p: ptr<number> = &age
p[0] = 20
print(age)
```

Expected:

```txt
20
```

### Write through pointer from `const`

- [ ] Implemented

```ts
const age: number = 10
let p: ptr<number> = &age
p[0] = 20
```

Expected diagnostic:

```txt
cannot mutate storage derived from const value 'age'
```

### Pointer copied from const remains readonly

- [ ] Implemented

```ts
const age: number = 10
let p1: ptr<number> = &age
let p2: ptr<number> = p1
p2[0] = 20
```

Expected diagnostic:

```txt
cannot mutate storage derived from const value 'age'
```

### Pointer reassignment updates permission

- [ ] Implemented

```ts
const fixed: number = 10
let mutable: number = 20

let p: ptr<number> = &fixed
p = &mutable
p[0] = 30

print(mutable)
```

Expected:

```txt
30
```

---

## 33. Function Summary Tests

### Const pointer passed to read-only function

- [ ] Implemented

```ts
function read(value: ptr<number>): number {
    return value[0]
}

const age: number = 10
print(read(&age))
```

Expected:

```txt
10
```

### Const pointer passed to may-write function

- [ ] Implemented

```ts
function write(value: ptr<number>): void {
    value[0] = 20
}

const age: number = 10
write(&age)
```

Expected diagnostic:

```txt
function 'write' may mutate pointer parameter 'value', but argument '&age' points to const storage
```

---

## 34. Object/Dictionary Field Tests

### Address of field from let object

- [ ] Implemented

```ts
type User = {
    age: number
    score: number
}

let user: User = {
    age: 20,
    score: 90
}

let p: ptr<number> = &user.age
print(1)
```

Expected:

```txt
1
```

### Address of field from const object

- [ ] Implemented

```ts
type User = {
    age: number
    score: number
}

const user: User = {
    age: 20,
    score: 90
}

let p: ptr<number> = &user.age
print(1)
```

Expected:

```txt
1
```

### Unknown field

- [ ] Implemented

```ts
type User = {
    age: number
}

let user: User = {
    age: 20
}

let p: ptr<number> = &user.score
```

Expected diagnostic:

```txt
type 'User' has no field 'score'
```

### Field from temporary

- [ ] Implemented

```ts
let p: ptr<number> = &getUser().age
```

Expected diagnostic:

```txt
cannot take address of field 'age' from temporary value
```

---

## 35. Array / Matrix Pointer Tests

### Pointer to fixed array

- [x] Implemented

```ts
let values: number[3] = [1, 2, 3]
let p: ptr<number[3]> = &values
print(1)
```

Expected:

```txt
1
```

### Pointer to fixed matrix

- [x] Implemented

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let p: ptr<number[2, 3]> = &matrix
print(1)
```

Expected:

```txt
1
```

### Pointer matrix read

- [x] Implemented

```ts
function read(matrix: ptr<number[2, 3]>): number {
    return matrix[1, 2]
}

let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

print(read(&matrix))
```

Expected:

```txt
6
```

### Pointer matrix write

- [x] Implemented

```ts
function change(matrix: ptr<number[2, 3]>): void {
    matrix[1, 2] = 99
}

let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

change(&matrix)
print(matrix[1, 2])
```

Expected:

```txt
99
```

### Pointer matrix write from const root

- [x] Implemented

```ts
function change(matrix: ptr<number[2, 3]>): void {
    matrix[1, 2] = 99
}

const matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

change(&matrix)
```

Expected diagnostic:

```txt
function 'change' may mutate pointer parameter 'matrix', but argument '&matrix' points to const storage
```

---

## 36. Implementation Phases

### Phase 1 — Core Pointer Type

- [x] Parser: `ptr<T>`.
- [x] Type system: `PointerType`.
- [x] Semantic assignability rules.
- [x] Pointer variable declarations.
- [x] Pointer parameter declarations.
- [x] Pointer return types.

### Phase 2 — Basic Address-Of

- [x] Parser: `&expr`.
- [x] Semantic: `AddressOfExpression`.
- [x] Support `&localVariable`.
- [x] Support `&constVariable`.
- [x] Reject temporaries/literals.
- [x] Track root symbol and permission.

### Phase 3 — SIR/FBS/LLVM Core

- [x] SIR `PointerType`.
- [x] SIR `AddressOfExpression`.
- [x] Internal SIR `DereferenceExpression` for compiler-created scalar read-through.
- [x] FBS `pointer_type`.
- [x] FBS `address_of_expression`.
- [x] FBS `dereference_expression` as internal lowering node.
- [x] LLVM pointer lowering.
- [x] Function arg pointer passing.

### Phase 4 — Pointer Access

- [x] `p[0]` read for scalar pointer.
- [x] `p[0]` write for scalar pointer.
- [x] `p` read-through for scalar pointer value contexts.
- [x] `p = value` write-through for scalar pointer binding.
- [x] Permission check for write-through.
- [x] Const provenance diagnostic.

### Phase 5 — Function Summaries

- [x] Detect read-only pointer params.
- [x] Detect may-write pointer params.
- [ ] Detect returned pointer views.
- [ ] Detect retained pointer params.
- [x] Call-site check for `&constValue`.

### Phase 6 — Arrays / Matrices

- [x] `ptr<number[N]>` support.
- [x] `ptr<number[R,C]>` support.
- [x] Pointer indexing read.
- [x] Pointer indexing write.
- [x] Fixed array/matrix row-major descriptor lowering.
- [ ] Partial views.

### Phase 7 — Object / Struct Fields

- [ ] `&object.field`.
- [ ] `&struct.field`.
- [ ] Nested field paths.
- [ ] Field GEP lowering.
- [ ] Const root permission.

### Phase 8 — Lifetime / Escape Analysis

- [ ] Reject pointer to local escaping.
- [ ] Reject pointer retained past root lifetime.
- [ ] Detect pointer stored in global.
- [ ] Detect pointer captured by closure.
- [ ] Integrate with RAII cleanup.
- [ ] Integrate with ownership/move rules.

### Phase 9 — Optional Future

- [ ] Nullable pointers via `ptr<T> | null`.
- [ ] Pointer equality.
- [ ] External C ABI read/write metadata.
- [ ] Dynamic array element pointers with strict lifetime restrictions.

---

## 37. Current Status

Update this section as implementation progresses.

### Implemented

- [ ] `ptr<T>` parser support
- [ ] `ptr<T>` type checker support
- [ ] `&value` parser support
- [ ] `&localVariable`
- [ ] `&constVariable`
- [ ] pointer assignment
- [ ] pointer function arguments
- [ ] SIR pointer type
- [ ] SIR address-of expression
- [ ] FBS pointer type
- [ ] FBS address-of expression
- [ ] LLVM basic pointer lowering
- [ ] pointer diagnostics

### In Progress

- [x] pointer access/read
- [x] pointer write-through
- [x] provenance/permission tracking
- [x] function read/write summaries
- [x] pointer indexing for arrays
- [x] partial views
- [x] internal dereference expression for compiler-created read-through

### Not Started

- [ ] object/dictionary field address-of
- [ ] struct field address-of
- [ ] escape/lifetime hardening
- [ ] C ABI pointer metadata
- [ ] nullable pointer unions
- [ ] pointer equality

---

## 38. Notes

When updating this file:

```txt
- Change `[ ]` to `[x]` only when the feature is implemented and tested.
- Add links or filenames for relevant tests when possible.
- Do not mark advanced pointer views as complete if only basic `&variable` works.
- Do not use obsolete diagnostics that reject `&constValue`.
- Remember: `&constValue` is valid; mutation through it is what fails.
```

Important final rule:

```txt
The storage root decides mutability.
The visible pointer type does not.
```
