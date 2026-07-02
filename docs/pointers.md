# Yogi Pointer Implementation Checklist

This document tracks the full pointer model for Yogi/Joki.

It is meant to be a living implementation checklist for Codex. Update each checkbox from `[ ]` to `[x]` as the compiler supports the feature.

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

Pointers are explicit. Values do not become pointers automatically, and pointers do not become values automatically.

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

- [ ] `ptr<T>` is the official visible pointer type.
- [ ] `&value` is the official address-of syntax.
- [ ] `ptr<T>` can point to `let` storage.
- [ ] `ptr<T>` can point to `const` storage.
- [ ] No `ptr<const T>` syntax.
- [ ] No `readonly` pointer syntax.
- [ ] No implicit value-to-pointer conversion.
- [ ] No implicit pointer-to-value conversion.
- [ ] No implicit dereference.
- [ ] No pointer arithmetic in safe/default Yogi.
- [ ] Pointer mutability is tracked internally through provenance/permission.
- [ ] `const p: ptr<T>` means the pointer binding cannot be reassigned.
- [ ] `const p: ptr<T>` does not mean the pointed storage is readonly.
- [ ] Pointed storage mutability comes from the root storage: `let` or `const`.

---

## 2. Core Type Support

### Parser / Type AST

- [ ] Parse `ptr<T>` in type positions.
- [ ] Parse nested pointer types: `ptr<ptr<number>>`.
- [ ] Parse pointer to primitive: `ptr<number>`.
- [ ] Parse pointer to string: `ptr<string>`.
- [ ] Parse pointer to boolean: `ptr<boolean>`.
- [ ] Parse pointer to dynamic array descriptor: `ptr<number[]>`.
- [ ] Parse pointer to fixed array: `ptr<number[3]>`.
- [ ] Parse pointer to fixed matrix: `ptr<number[2, 3]>`.
- [ ] Parse pointer to custom type: `ptr<User>`.
- [ ] Parse pointer to object/dictionary type: `ptr<{ age: number }>` if inline object types are supported.

### Semantic Type Representation

- [ ] Add `PointerType` to the internal type system.
- [ ] `PointerType` stores `pointeeType`.
- [ ] `PointerType` supports equality comparison.
- [ ] `ptr<T>` assignability requires compatible `T`.
- [ ] `ptr<T>` and `T` are distinct types.
- [ ] `ptr<ptr<T>>` and `ptr<T>` are distinct types.

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

- [ ] Parse `&expr` as `AddressOfExpression`.
- [ ] Preserve source spans for diagnostics.
- [ ] Support `&identifier`.
- [ ] Support parenthesized addressable expressions: `&(age)`.
- [ ] Reject temporary expressions: `&(10 + 20)`.
- [ ] Reject literal expressions: `&10`, `&"hello"`, `&true`.
- [ ] Reject array literals: `&[1, 2, 3]`.
- [ ] Reject object literals directly: `&{ age: 20 }`.
- [ ] Reject function call result unless future rules explicitly allow addressable returns.

### Type Rules

- [ ] `&expr` has type `ptr<typeof expr>`.
- [ ] `&letValue` is valid and gets mutable permission.
- [ ] `&constValue` is valid and gets readonly permission.
- [ ] Address-of requires a stable l-value path.
- [ ] Address-of does not copy the value.

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

- [ ] Local variables are addressable.
- [ ] Global variables are addressable.
- [ ] Function parameters are addressable if they have real storage.
- [ ] Parenthesized l-values preserve addressability.
- [ ] Field access is addressable if the base is addressable.
- [ ] Nested field access is addressable if the root is addressable.
- [ ] Fixed array element access is addressable if the root is addressable.
- [ ] Fixed matrix element access is addressable if the root is addressable.
- [ ] Fixed partial array/matrix views are addressable if the root is addressable.
- [ ] Dynamic array element addressability is rejected initially.
- [ ] Temporaries are not addressable.
- [ ] Literals are not addressable.
- [ ] Function call results are not addressable by default.
- [ ] Binary/unary computed expressions are not addressable.

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

- [ ] Pointer from `let` root gets mutable permission.
- [ ] Pointer from `const` root gets readonly permission.
- [ ] Pointer copy preserves permission.
- [ ] Pointer assignment updates the target variable's current pointer provenance.
- [ ] Writing through readonly pointer is rejected.
- [ ] Reading through readonly pointer is allowed.
- [ ] `const p: ptr<T>` prevents reassignment of `p` only.
- [ ] `const p: ptr<T>` does not change pointed storage permission.

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

- [ ] Assigning `T` to `ptr<T>` without `&` is rejected.
- [ ] Assigning `ptr<T>` to `T` is rejected.
- [ ] Passing `T` to a parameter expecting `ptr<T>` without `&` is rejected.
- [ ] Passing `ptr<T>` to a parameter expecting `T` is rejected.
- [ ] `ptr<number>` is not assignable to `ptr<string>`.
- [ ] `ptr<number[2,3]>` is not assignable to `ptr<number[]>`.
- [ ] `ptr<ptr<number>>` is not assignable to `ptr<number>`.

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

Expected diagnostic:

```txt
error: expected number, got ptr<number>
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

- [ ] Function parameters can use `ptr<T>`.
- [ ] Return types can use `ptr<T>`.
- [ ] Call site must pass `&value` or existing pointer for `ptr<T>` parameter.
- [ ] Normal value parameter still uses local/value semantics.
- [ ] Passing pointer to normal value parameter is rejected.
- [ ] Passing normal value to pointer parameter is rejected.
- [ ] Pointer parameters can be copied as pointer values.
- [ ] Pointer parameters preserve provenance/permission from call site.

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

- [ ] Analyze function bodies for pointer parameter reads.
- [ ] Analyze function bodies for pointer parameter writes.
- [ ] Mark pointer parameters as `read-only-use` if only read.
- [ ] Mark pointer parameters as `may-write` if write-through occurs.
- [ ] Mark pointer parameters as `returned-view` if returned pointer derives from them.
- [ ] Mark pointer parameters as `retained` if stored globally/heap/closure.
- [ ] At call site, allow `&constValue` for read-only pointer params.
- [ ] At call site, reject `&constValue` for may-write pointer params.
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

Dereference syntax is not required initially.

Recommended access model:

```ts
p[0]          // scalar pointer access
arrayPtr[i]   // fixed array pointer access
matrixPtr[i,j] // fixed matrix pointer access
```

Checklist:

- [ ] Define read from `ptr<number>` using `p[0]`.
- [ ] Define read from `ptr<string>` if string pointer access is supported.
- [ ] Define read from `ptr<number[N]>` using `p[i]`.
- [ ] Define read from `ptr<number[R,C]>` using `p[i,j]`.
- [ ] No implicit pointer-to-value conversion.
- [ ] Optional `*p` dereference is not part of initial model.

Example:

```ts
let age: number = 10
let p: ptr<number> = &age
let value: number = p[0]
```

---

## 12. Pointer Write-Through

Checklist:

- [ ] Assignment through pointer is supported for scalar pointer access.
- [ ] Assignment through fixed array pointer access is supported.
- [ ] Assignment through fixed matrix pointer access is supported.
- [ ] Write-through checks pointer permission.
- [ ] Write-through is allowed for mutable provenance.
- [ ] Write-through is rejected for readonly provenance.
- [ ] Assigned value type must match pointed element type.

Example:

```ts
let age: number = 10
let p: ptr<number> = &age
p[0] = 20
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

- [ ] `&array` produces `ptr<number[N]>` for fixed arrays.
- [ ] `&matrix` produces `ptr<number[R,C]>` for fixed matrices.
- [ ] Passing `&matrix` to `ptr<number[R,C]>` parameter does not copy the matrix.
- [ ] Pointer to fixed array preserves shape.
- [ ] Pointer to fixed matrix preserves rank and shape.
- [ ] Shape mismatch is rejected.

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

- [ ] If `values: ptr<number[N]>`, then `values[i]` in read position returns `number`.
- [ ] If `values: ptr<number[N]>`, then `values[i] = x` writes through pointer if mutable.
- [ ] If `matrix: ptr<number[R,C]>`, then `matrix[i,j]` in read position returns `number`.
- [ ] If `matrix: ptr<number[R,C]>`, then `matrix[i,j] = x` writes through pointer if mutable.
- [ ] Index rank must match shape for full element access.
- [ ] Bounds checking is performed according to Yogi's array rules.
- [ ] Const provenance blocks write-through.

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

- [ ] If `matrix: ptr<number[2,3]>`, then `matrix[0]` returns `ptr<number[3]>`.
- [ ] If `image: ptr<number[2,2,3]>`, then `image[1]` returns `ptr<number[2,3]>`.
- [ ] If `image: ptr<number[2,2,3]>`, then `image[1,0]` returns `ptr<number[3]>`.
- [ ] Full indexing returns scalar value in read position.
- [ ] Partial views do not copy.
- [ ] Partial views inherit provenance/permission.
- [ ] Partial views can be returned only when derived from pointer params or storage that outlives return.

Example:

```ts
function firstRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {
    return matrix[0]
}
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

Yogi objects/dictionaries are fixed-layout records. They are not dynamic JavaScript objects.

Rules:

```txt
All object/dictionary fields are known at compile time.
Each field has a real memory location and stable offset.
&object.field is valid when object is addressable.
```

Checklist:

- [ ] Objects/dictionaries have real memory representation.
- [ ] Object/dictionary fields have stable offsets.
- [ ] `&object.field` is supported.
- [ ] `&object.nested.field` is supported.
- [ ] Result type is `ptr<FieldType>`.
- [ ] Unknown field is rejected.
- [ ] Field type mismatch is rejected.
- [ ] Field from temporary object is rejected.
- [ ] Root mutability controls pointer permission.

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

- [ ] Struct fields have fixed layout.
- [ ] `&struct.field` is supported.
- [ ] Result type is `ptr<FieldType>`.
- [ ] Nested struct fields work.
- [ ] Root mutability controls pointer permission.
- [ ] LLVM lowering uses field offset / GEP.

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

Dynamic arrays can reallocate their buffer. Therefore, element pointers are dangerous unless borrow/lifetime restrictions exist.

Initial rule:

```txt
&dynamicArray[index] is not supported initially.
```

Checklist:

- [ ] Reject `&dynamicArray[index]` initially.
- [ ] Diagnostic explains that dynamic array buffer may reallocate.
- [ ] Future support requires restrictions on push/pop/resize/realloc while pointer is alive.
- [ ] Future support may use pinned slices/views if added.

Invalid initially:

```ts
let values: number[] = [1, 2, 3]
let p: ptr<number> = &values[0]
```

Expected diagnostic:

```txt
error: cannot take pointer to dynamic array element because the array buffer may reallocate
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

- [ ] Add `PointerType` node/variant.
- [ ] `PointerType` stores pointee type.
- [ ] Add `AddressOfExpression` node/variant.
- [ ] `AddressOfExpression` stores target expression.
- [ ] `AddressOfExpression` stores result type.
- [ ] `AddressOfExpression` stores root symbol/provenance.
- [ ] `AddressOfExpression` stores access path.
- [ ] `AddressOfExpression` stores permission: mutable/readonly.
- [ ] Add pointer read/access expression representation.
- [ ] Add pointer write-through representation.
- [ ] Add pointer function parameter metadata.
- [ ] Add function pointer summary metadata.

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

- [ ] Add `pointer_type` to FBS type union/table.
- [ ] Add `address_of_expression` to FBS expression union/table.
- [ ] Add access path representation.
- [ ] Add root symbol/provenance representation.
- [ ] Add permission representation: mutable/readonly.
- [ ] Add pointer parameter representation.
- [ ] Add pointer return type representation.
- [ ] Add pointer read/write expressions if needed.
- [ ] Add function summary metadata for pointer params.

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

- [ ] Lower `ptr<T>` to LLVM pointer type.
- [ ] Lower `&localVariable` to address of local alloca/storage.
- [ ] Lower `&globalVariable` to global address.
- [ ] Lower `&parameter` to parameter storage address where applicable.
- [ ] Lower pointer copy as pointer value copy.
- [ ] Lower pointer function argument as address, not pointee copy.
- [ ] Lower `&object.field` using GEP field index.
- [ ] Lower `&struct.field` using GEP field index.
- [ ] Lower `&fixedArray[index]` using GEP element offset.
- [ ] Lower `&matrix[i,j]` using row-major offset / GEP.
- [ ] Lower pointer read as LLVM load.
- [ ] Lower pointer write as LLVM store after permission check.
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

- [ ] `expected ptr<T>, got T`
- [ ] `help: use '&value' to create a pointer`
- [ ] `expected T, got ptr<T>`
- [ ] `expected ptr<X>, got ptr<Y>`
- [ ] `cannot take address of temporary expression`
- [ ] `cannot take address of temporary string literal`
- [ ] `cannot take address of temporary array literal`
- [ ] `cannot take address of object literal`
- [ ] `cannot take address of field from temporary value`
- [ ] `cannot mutate storage derived from const value 'name'`
- [ ] `function 'x' may mutate pointer parameter 'p', but argument '&v' points to const storage`
- [ ] `cannot return pointer to local storage 'name'`
- [ ] `cannot return pointer/view derived from value parameter 'name'`
- [ ] `cannot take pointer to dynamic array element because the array buffer may reallocate`
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

- [ ] Implemented

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

- [ ] Implemented

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

- [ ] Implemented

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

- [ ] Implemented

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

- [ ] Implemented

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

- [ ] Parser: `ptr<T>`.
- [ ] Type system: `PointerType`.
- [ ] Semantic assignability rules.
- [ ] Pointer variable declarations.
- [ ] Pointer parameter declarations.
- [ ] Pointer return types.

### Phase 2 — Basic Address-Of

- [ ] Parser: `&expr`.
- [ ] Semantic: `AddressOfExpression`.
- [ ] Support `&localVariable`.
- [ ] Support `&constVariable`.
- [ ] Reject temporaries/literals.
- [ ] Track root symbol and permission.

### Phase 3 — SIR/FBS/LLVM Core

- [ ] SIR `PointerType`.
- [ ] SIR `AddressOfExpression`.
- [ ] FBS `pointer_type`.
- [ ] FBS `address_of_expression`.
- [ ] LLVM pointer lowering.
- [ ] Function arg pointer passing.

### Phase 4 — Pointer Access

- [ ] `p[0]` read for scalar pointer.
- [ ] `p[0]` write for scalar pointer.
- [ ] Permission check for write-through.
- [ ] Const provenance diagnostic.

### Phase 5 — Function Summaries

- [ ] Detect read-only pointer params.
- [ ] Detect may-write pointer params.
- [ ] Detect returned pointer views.
- [ ] Detect retained pointer params.
- [ ] Call-site check for `&constValue`.

### Phase 6 — Arrays / Matrices

- [ ] `ptr<number[N]>` support.
- [ ] `ptr<number[R,C]>` support.
- [ ] Pointer indexing read.
- [ ] Pointer indexing write.
- [ ] Fixed array/matrix GEP lowering.
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

- [ ] pointer access/read
- [ ] pointer write-through
- [ ] provenance/permission tracking
- [ ] function read/write summaries
- [ ] pointer indexing for arrays
- [ ] partial views

### Not Started

- [ ] object/dictionary field address-of
- [ ] struct field address-of
- [ ] escape/lifetime hardening
- [ ] C ABI pointer metadata
- [ ] nullable pointer unions
- [ ] pointer equality

---

## 38. Notes for Codex

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

