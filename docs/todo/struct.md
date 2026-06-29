# Yogi Struct Behavior Specification

This document defines the intended behavior of `struct` in Yogi.

The goal of `struct` is to provide real data types with physical layout, validation, inheritance, and ABI-compatible representation. A `struct` is not a class, not an interface, and not a TypeScript-style type alias. A `struct` represents a real type that can lower to LLVM with a concrete memory representation.

This document is written as implementation guidance for the compiler, semantic analyzer, SIR/FlatBuffers representation, LLVM lowering, and runtime validation behavior.

---

## 1. Core Purpose

A Yogi `struct` is a real data type.

It can be used to define:

- object-like data structures with fields;
- scalar/refined primitive types such as `int8`, `uint64`, `float32`, and `double`;
- semantic wrapper types such as `UserId`, `Temperature`, `FileDescriptor`, etc.;
- C ABI-compatible structures;
- pointer-like types such as `Ptr<T>` and `Ref<T>`;
- custom representations for primitive-like types;
- runtime validation rules for values.

A `struct` has two different dimensions:

```txt
compile-time type metadata
    layout, fields, inheritance, LLVM representation, ABI shape

runtime value behavior
    construction, assignment, conversion, validation
```

The most important distinction is:

```txt
layout()
    compile-time only
    produces physical layout metadata
    does not execute at runtime

validate(value)
    runtime-capable
    validates real values when they are created, assigned, converted, or constructed
```

---

## 2. Struct Is Not Class

A Yogi `struct` must not behave like a class.

Allowed members:

```txt
fields
layout(ctx)
validate(value)
```

Disallowed members:

```txt
arbitrary methods
static methods
manual constructors
runtime methods inside struct body
instance methods using this
```

The compiler must not treat `struct` hooks as class methods. The hooks are compiler-recognized functions with special behavior.

`this` must not be used inside `layout()` or `validate()`.

Instead:

```ts
layout(ctx: LayoutContext<T>): Layout<T>
validate(value: T): boolean
```

`layout(ctx)` receives compile-time layout context.

`validate(value)` receives a readonly runtime candidate value.

---

## 3. Compile-Time vs Runtime

### 3.1 `layout()`

`layout()` is evaluated by the compiler.

It produces normalized metadata that is later used by LLVM lowering.

It does not exist as a normal runtime function after compilation.

Pipeline conceptually:

```txt
source code
    ↓
parse
    ↓
semantic analysis
    ↓
evaluate/normalize layout()
    ↓
SIR / FlatBuffers layout metadata
    ↓
LLVM type generation
    ↓
object/executable
    ↓
runtime starts
```

At runtime, `layout()` has already done its job.

### 3.2 `validate(value)`

`validate(value)` may be emitted as runtime code.

It runs when a value must be accepted as a specific struct type.

Common trigger points:

```txt
variable initialization
assignment to a variable of the struct type
explicit conversion/cast into the struct type
object struct construction
returning a value as a struct type
passing a value to a parameter requiring that struct type
storing a value into a field with that struct type
```

Example:

```ts
let age: int8 = 25
```

Conceptually triggers:

```txt
int8.validate(25)
```

Example:

```ts
let user: User = User {
    id: 1,
    name: "Ana"
}
```

Conceptually triggers:

```txt
User.validate(user)
```

If validation fails, the runtime must report a validation failure using the struct name and validator name where possible.

---

## 4. Struct Categories

Yogi has several important struct categories.

---

## 5. Object Structs

An object struct declares fields directly.

Example:

```ts
struct Point {
    x: number
    y: number
}
```

This creates a real object-like type with real fields.

It must lower to an LLVM struct type.

Conceptual LLVM shape:

```llvm
%Point = type { double, double }
```

assuming Yogi `number` defaults to `float64/double`.

### 5.1 Object Struct Without `layout()`

If an object struct does not declare `layout()`, the compiler uses the default struct layout policy.

Default object struct behavior:

```txt
kind: struct
packed: false
alignment: compiler/platform default
field order: source declaration order plus inherited fields first
storage: normal value storage
```

Example:

```ts
struct User {
    id: uint64
    name: string
}
```

The compiler materializes fields in the declared order unless inheritance adds parent fields first.

### 5.2 Object Struct With `layout()`

Object structs may declare `layout(ctx)` to customize physical representation.

Example:

```ts
struct Packet {
    id: uint32
    checksum: uint32

    layout({ kind, type }: LayoutContext<Packet>): Layout<Packet> {
        return {
            kind: kind.struct,
            packed: true,
            align: type.i8
        }
    }
}
```

The compiler evaluates `layout()` at compile time and normalizes it.

`packed: true` means no automatic padding between fields.

`align` must normalize to a valid power-of-two alignment.

---

## 6. Scalar Structs Extending Primitive Types

A scalar struct extends a primitive type and creates a real refined physical type.

Primitive bases allowed:

```txt
number
string
boolean
null
undefined
```

Example:

```ts
struct UserId extends number {
}
```

If no `layout()` is declared, the struct inherits the physical layout of its primitive base.

Since `number` defaults to `float64/double`, the above behaves physically like a number.

Conceptually:

```txt
semantic type: UserId
base type: number
physical layout: default number layout
```

This is not a TypeScript alias. `UserId` is a real semantic type, but it inherits the base physical representation unless customized.

---

## 7. Scalar Structs With Custom Numeric Layout

Numeric scalar structs can change the representation of `number` into real integer or float layouts.

Example:

```ts
struct int8 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return {
            kind: kind.integer,
            type: type.i8,
            signed: sign.signed
        }
    }

    validate(value: number): boolean {
        return value >= -128 && value <= 127
    }
}
```

This creates a real signed 8-bit integer type.

Conceptual normalized layout:

```txt
kind: integer
llvmType: i8
bitWidth: 8
signed: true
```

Unsigned version:

```ts
struct uint8 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return {
            kind: kind.integer,
            type: type.i8,
            signed: sign.unsigned
        }
    }

    validate(value: number): boolean {
        return value >= 0 && value <= 255
    }
}
```

Conceptual normalized layout:

```txt
kind: integer
llvmType: i8
bitWidth: 8
signed: false
```

Important LLVM rule:

```txt
LLVM integer types are not signed or unsigned by themselves.
LLVM has i8, i16, i32, i64, etc.
Signed/unsigned behavior affects generated operations, not the physical type.
```

For example:

```txt
signed compare vs unsigned compare
signed divide vs unsigned divide
sign extension vs zero extension
```

### 7.1 Float Types

Example:

```ts
struct float32 extends number {
    layout({ kind, type }: LayoutContext<number>): Layout<number> {
        return {
            kind: kind.float,
            type: type.f32
        }
    }
}
```

Conceptual normalized layout:

```txt
kind: float
llvmType: float
bitWidth: 32
```

Example:

```ts
struct double extends number {
    layout({ kind, type }: LayoutContext<number>): Layout<number> {
        return {
            kind: kind.float,
            type: type.f64
        }
    }
}
```

Conceptual normalized layout:

```txt
kind: float
llvmType: double
bitWidth: 64
```

`double` does not need to be a built-in keyword. It can be built as a real Yogi struct using `layout()`.

---

## 8. `kind`, `type`, and `sign`

The final decision is that `LayoutContext<T>` exposes readonly compile-time objects.

These are not runtime enums.

These are not ordinary dynamic values.

They are symbolic compiler-known tokens.

Recommended context shape for numeric layouts:

```ts
type NumberLayoutContext = {
    readonly kind: {
        readonly integer: LayoutKindInteger
        readonly float: LayoutKindFloat
    }

    readonly type: {
        readonly i8: LayoutTypeI8
        readonly i16: LayoutTypeI16
        readonly i32: LayoutTypeI32
        readonly i64: LayoutTypeI64
        readonly i128: LayoutTypeI128

        readonly f32: LayoutTypeF32
        readonly f64: LayoutTypeF64
    }

    readonly sign: {
        readonly signed: true
        readonly unsigned: false
    }

    readonly defaultLayout: Layout<number>
    readonly baseLayout: Layout<number>
}
```

Usage:

```ts
layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
    return {
        kind: kind.integer,
        type: type.i32,
        signed: sign.unsigned
    }
}
```

The compiler normalizes:

```txt
kind.integer -> normalized kind = integer
type.i32     -> normalized LLVM integer type = i32
sign.unsigned -> normalized signed = false
```

No runtime object is required.

No numeric enum value is required.

No dynamic number is trusted for layout.

---

## 9. Why `type.i8` Instead of `bits.b8`

Yogi is intentionally close to LLVM representation.

Therefore, `type.i8`, `type.i16`, `type.i32`, etc. are preferred over `bits.b8`, `bits.b16`, etc.

Reason:

```txt
type.i8 resembles LLVM i8
type.i16 resembles LLVM i16
type.i32 resembles LLVM i32
type.i64 resembles LLVM i64
```

This makes numeric layout declarations feel like real backend type declarations.

Example:

```ts
return {
    kind: kind.integer,
    type: type.i8,
    signed: sign.signed
}
```

This means:

```txt
integer family
LLVM i8 physical representation
signed operation semantics
```

For unsigned:

```ts
return {
    kind: kind.integer,
    type: type.i8,
    signed: sign.unsigned
}
```

This means:

```txt
integer family
LLVM i8 physical representation
unsigned operation semantics
```

Yogi should not introduce `type.u8` initially if the goal is LLVM-like representation, because LLVM does not have separate `u8` and `i8` physical integer types.

---

## 10. Is `kind` Required?

`Layout<number>` already says the layout is numeric.

However, numeric layouts still need to distinguish:

```txt
integer
float
```

Therefore, `kind` is still useful.

Recommended rule:

```txt
kind is preferred and should be accepted explicitly.
```

The compiler may later infer `kind` from `type`:

```txt
type.i8  -> kind.integer
type.i16 -> kind.integer
type.i32 -> kind.integer
type.i64 -> kind.integer

type.f32 -> kind.float
type.f64 -> kind.float
```

But for initial implementation, requiring explicit `kind` is simpler and clearer.

Recommended first version:

```txt
For NumberLayout, require kind.
For custom numeric layout, require type.
For integer layout, signed defaults to signed unless explicitly unsigned.
For float layout, signed is ignored if present.
```

---

## 11. Ignoring Irrelevant Layout Properties

Some properties may exist in a returned layout object even when they do not apply.

Example:

```ts
struct double extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return {
            kind: kind.float,
            type: type.f64,
            signed: sign.signed
        }
    }
}
```

For float layouts, `signed` does not apply.

The compiler should ignore it.

No warning is required.

Rule:

```txt
Properties that are valid layout properties but irrelevant to the selected kind may be ignored silently.
```

However, properties that are not known layout properties should still be rejected.

Example:

```ts
return {
    kind: kind.float,
    type: type.f64,
    banana: true
}
```

Should be a semantic error unless index-like extension properties are explicitly supported.

---

## 12. LayoutContext Is Readonly

All `LayoutContext<T>` values must be readonly.

This must be rejected:

```ts
layout(ctx: LayoutContext<number>): Layout<number> {
    ctx.kind.integer = ctx.kind.float
    return {
        kind: ctx.kind.integer,
        type: ctx.type.i8
    }
}
```

Context objects are compile-time metadata views. They cannot be modified.

---

## 13. Layout Tokens Are Compile-Time Only

`kind.integer`, `type.i8`, `sign.signed`, etc. are compile-time layout tokens.

They must not be lowered as runtime values.

They must not become dynamic objects.

They must not depend on numeric enum ordering.

Semantic analyzer behavior:

```txt
source token: type.i8
    ↓
semantic token: LayoutTypeI8
    ↓
normalized metadata: bitWidth = 8, llvmType = i8
```

Backend behavior:

```txt
LLVM lowering receives normalized metadata only.
It should not receive user-facing context objects.
```

---

## 14. Generic LayoutContext<T>

`LayoutContext<T>` changes based on `T`.

Conceptual type:

```ts
type LayoutContext<T> =
    T extends number ? NumberLayoutContext :
    T extends string ? StringLayoutContext :
    T extends boolean ? BooleanLayoutContext :
    T extends null ? NullLayoutContext :
    T extends undefined ? UndefinedLayoutContext :
    StructLayoutContext<T>
```

This can be implemented either as:

```txt
compiler-known intrinsic generic type
```

or later as:

```txt
conditional type in the standard library
```

Initial implementation recommendation:

```txt
Treat LayoutContext<T> as compiler-known.
```

This avoids requiring full conditional type support before struct layout is implemented.

---

## 15. Generic Layout<T>

`Layout<T>` describes the returned physical layout for a family of types.

Conceptual type:

```ts
type Layout<T> =
    T extends number ? NumberLayout :
    T extends string ? StringLayout :
    T extends boolean ? BooleanLayout :
    T extends null ? NullLayout :
    T extends undefined ? UndefinedLayout :
    StructLayout | PointerLayout<T>
```

The generic parameter is meaningful.

Examples:

```ts
Layout<number>
```

means a layout describing number-like physical representations.

```ts
Layout<string>
```

means a layout describing string representation.

```ts
Layout<User>
```

means a layout describing object struct representation.

---

## 16. Layout Generic Argument Rules

### 16.1 Scalar Struct Extending Primitive

For scalar structs extending primitives, use the primitive base in `layout()`.

Recommended:

```ts
struct int8 extends number {
    layout(ctx: LayoutContext<number>): Layout<number> {
        return { ... }
    }
}
```

Not recommended:

```ts
struct int8 extends number {
    layout(ctx: LayoutContext<int8>): Layout<int8> {
        return { ... }
    }
}
```

Reason:

```txt
int8 is the type currently being defined.
Using LayoutContext<int8> creates a circular layout dependency.
```

### 16.2 Object Struct

Object structs may use themselves in `LayoutContext<T>` because the compiler can register the struct symbol before resolving its layout.

Example:

```ts
struct User {
    id: uint64
    name: string

    layout(ctx: LayoutContext<User>): Layout<User> {
        return {
            kind: ctx.kind.struct
        }
    }
}
```

This is valid because `User` is being used as a type symbol, not as a runtime value.

### 16.3 Struct Extending Struct

If a struct extends another struct and does not declare `layout()`, it inherits or composes layout according to the inheritance rules.

If it declares `layout()`, it may receive context for the current struct or for an already resolved base struct.

However, the compiler must prevent layout cycles.

---

## 17. Validate Hook Signature

`validate()` must use an explicit parameter.

No `this`.

No implicit value.

### 17.1 Object Struct Validate

For object structs, `validate()` should receive the current struct type.

Example:

```ts
struct User {
    name: string
    age: uint8

    validate(value: User): boolean {
        return value.name.length > 0 && value.age > 0
    }
}
```

Even though `User` is still being declared, the compiler may allow a self type reference inside `validate()`.

This is similar to using a type symbol inside its own declaration.

The parameter is a readonly candidate value.

This must be rejected:

```ts
validate(value: User): boolean {
    value.name = "Changed"
    return true
}
```

### 17.2 Scalar Struct Validate

For scalar structs extending primitives, `validate()` should receive the direct base type.

Example:

```ts
struct int8 extends number {
    validate(value: number): boolean {
        return value >= -128 && value <= 127
    }
}
```

The value has not yet been accepted as `int8`; it is a candidate `number` value.

### 17.3 Struct Extending Scalar Struct

Example:

```ts
struct uint64 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return {
            kind: kind.integer,
            type: type.i64,
            signed: sign.unsigned
        }
    }
}

struct UserId extends uint64 {
    validate(value: uint64): boolean {
        return value > 0
    }
}
```

`UserId` inherits the physical layout of `uint64` and adds semantic validation.

---

## 18. Validate Is Readonly

The parameter passed to `validate(value)` must be readonly.

The validator may read values but may not mutate them.

Allowed:

```ts
validate(value: User): boolean {
    return value.name.length > 0
}
```

Rejected:

```ts
validate(value: User): boolean {
    value.name = "Ana"
    return true
}
```

Rejected for scalar assignment too:

```ts
validate(value: number): boolean {
    value = 10
    return true
}
```

---

## 19. Validate Return Type

`validate()` must return `boolean`.

Valid:

```ts
validate(value: number): boolean {
    return value >= 0
}
```

Invalid:

```ts
validate(value: number): number {
    return 1
}
```

Invalid:

```ts
validate(value: number): void {
}
```

Invalid:

```ts
validate(value: number) {
    return true
}
```

Return type should be explicit because Yogi is strict.

---

## 20. Layout Return Type

`layout()` must return `Layout<T>` with an explicit generic argument.

Valid:

```ts
layout(ctx: LayoutContext<number>): Layout<number> {
    return { ... }
}
```

Invalid:

```ts
layout(ctx: LayoutContext<number>): Layout<any> {
    return { ... }
}
```

Invalid:

```ts
layout(ctx: LayoutContext<number>) {
    return { ... }
}
```

Invalid:

```ts
layout(): Layout<number> {
    return { ... }
}
```

The context parameter is required in the final design.

---

## 21. LayoutContext Destructuring

Because `layout()` receives a normal-looking parameter, destructuring should be supported.

Example:

```ts
layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
    return {
        kind: kind.integer,
        type: type.i8,
        signed: sign.signed
    }
}
```

This is preferred because it is concise and avoids `this`.

Nested destructuring may be supported but is not required for first implementation.

Example optional style:

```ts
layout({ kind: { integer }, type: { i8 }, sign: { signed } }: LayoutContext<number>): Layout<number> {
    return {
        kind: integer,
        type: i8,
        signed
    }
}
```

---

## 22. `this` Is Disallowed in Hooks

Inside `layout()`:

```ts
layout(ctx: LayoutContext<number>): Layout<number> {
    return {
        kind: this.kind.integer
    }
}
```

must be rejected.

Inside `validate()`:

```ts
validate(value: number): boolean {
    return this >= 0
}
```

must be rejected.

Reason:

```txt
struct is not class
layout receives ctx
validate receives value
```

---

## 23. Interface and Type Alias Inheritance

`struct` may extend interfaces and object-like type aliases.

Interfaces and type aliases do not lower as independent runtime entities.

They are compile-time contracts.

When a struct extends an object-like interface or type alias, inherited members are materialized as real struct fields.

Example:

```ts
interface Tagged {
    tag: string
}

struct Packet extends Tagged {
    id: uint32
}
```

Materialized fields:

```txt
tag: string
id: uint32
```

The LLVM struct for `Packet` contains both fields.

Example with type alias:

```ts
type Tagged = {
    tag: string
}

struct Packet extends Tagged {
    id: uint32
}
```

Also valid.

### 23.1 Primitive Type Alias as Base Is Rejected

This should be rejected:

```ts
type Numeric = number

struct UserId extends Numeric {
}
```

Reason:

```txt
Numeric is only a compile-time alias of number.
It has no fields, no layout, no validate, no physical identity.
```

The user should write:

```ts
struct UserId extends number {
}
```

or create a real struct:

```ts
struct Numeric extends number {
    layout({ kind, type }: LayoutContext<number>): Layout<number> {
        return {
            kind: kind.float,
            type: type.f64
        }
    }
}
```

Rule:

```txt
struct extends interface                 -> valid if object-like
struct extends object-like type alias     -> valid
struct extends primitive type alias       -> invalid
struct extends primitive directly         -> valid
struct extends struct                     -> valid
```

---

## 24. Struct Extending Struct

A struct may extend another struct.

### 24.1 Object Struct Inheritance

Example:

```ts
struct Person {
    firstName: string
    lastName: string
}

struct Customer extends Person {
    customerId: uint64
}
```

Fields materialized in `Customer`:

```txt
firstName: string
lastName: string
customerId: uint64
```

Parent fields come before child fields unless another ABI policy is explicitly defined later.

### 24.2 Validation Chain

If both parent and child declare `validate()`, validation runs parent-to-child.

Example:

```ts
struct Person {
    firstName: string
    lastName: string

    validate(value: Person): boolean {
        return value.firstName.length > 0 && value.lastName.length > 0
    }
}

struct Customer extends Person {
    customerId: uint64

    validate(value: Customer): boolean {
        return value.customerId > 0
    }
}
```

Constructing `Customer` runs:

```txt
Person.validate(customer projected as Person)
Customer.validate(customer)
```

If any validator returns false, construction/conversion fails.

### 24.3 Layout Inheritance

If child does not declare `layout()`, it inherits or composes parent layout according to category.

For scalar struct extending scalar struct:

```txt
child inherits parent physical layout
```

For object struct extending object struct:

```txt
child includes parent fields, then child fields
layout is normalized for the complete child struct
parent layout policies may influence child layout
```

If parent is packed and child does not override, the compiler may inherit packed policy. This should be deterministic and documented in normalized metadata.

Recommended initial rule:

```txt
If child has no layout(), inherit applicable parent layout policy.
If child has layout(), use child layout for the final child type.
Parent fields still remain materialized.
```

---

## 25. Primitive Defaults

Primitive default layouts:

```txt
number      -> kind.float, type.f64
string      -> default Yogi string representation
boolean     -> default boolean representation, likely i1/i8 depending ABI/runtime policy
null        -> null marker / pointer null depending context
undefined   -> undefined marker / zero-size marker depending context
```

`number` default must be treated as `float64/double` unless the language changes this globally.

Therefore:

```ts
struct UserId extends number {
}
```

physically inherits `number` default:

```txt
kind: float
type: f64
```

---

## 26. Null and Undefined Structs

Yogi may allow structs extending `null` and `undefined`.

Examples:

```ts
struct NotLoaded extends undefined {
}

struct NullHandle extends null {
}
```

These are semantic absence types.

If no layout is declared, they inherit default `undefined` or `null` representation.

If layout is declared, they may customize representation for that specific struct.

Important:

```txt
This does not change global null or undefined.
It only changes the representation of that struct type.
```

Example:

```ts
struct NullHandle extends null {
    layout({ kind }: LayoutContext<null>): Layout<null> {
        return {
            kind: kind.pointer,
            nullable: true
        }
    }
}
```

The exact `LayoutContext<null>` shape may be finalized later.

---

## 27. String Layouts

String structs may customize encoding/storage.

Example:

```ts
struct CString extends string {
    layout({ kind, encoding, storage }: LayoutContext<string>): Layout<string> {
        return {
            kind: kind.string,
            encoding: encoding.utf8,
            storage: storage.pointer,
            nullTerminated: true
        }
    }

    validate(value: string): boolean {
        return value.length > 0
    }
}
```

Possible string layout metadata:

```txt
kind: string
encoding: utf8 | utf16 | ascii
storage: runtime | inline | pointer | slice
nullTerminated: boolean
maxLength: number
align: layout type token
```

String layout must normalize to a backend representation.

---

## 28. Pointer-Like Structs

Pointer-like structs are declared using `layout()`.

Example:

```ts
struct Ptr<T> {
    layout({ kind }: LayoutContext<T>): Layout<T> {
        return {
            kind: kind.pointer,
            mutable: true,
            nullable: false
        }
    }
}
```

Readonly pointer:

```ts
struct Ref<T> {
    layout({ kind }: LayoutContext<T>): Layout<T> {
        return {
            kind: kind.pointer,
            mutable: false,
            nullable: false
        }
    }
}
```

Pointer layout metadata:

```txt
kind: pointer
mutable: boolean
nullable: boolean
align: optional layout type token
```

Pointer-like structs may expose compiler-known pseudo-properties in normal code:

```txt
.value
.ref
.address
.stage
.typeSize
.align
.isMutable
.isReadonly
.isNull
```

These pseudo-properties are not ordinary fields unless explicitly implemented otherwise.

---

## 29. Object-Based Pointer Syntax

Yogi should avoid C-like `&` and `*` syntax.

Recommended mapping:

```txt
C/C++                Yogi
&value               value.ref
*ptr                 ptr.value
ptr->field           ptr.value.field
User**               Ptr<Ptr<User>>
**ptr                ptr.value.value
```

Example:

```ts
let user: User = User { id: 1, name: "Ana" }
let ptr: Ptr<User> = user.ref

ptr.value.name = "Luis"
```

`user.ref` is a compiler-known pseudo-property that produces a pointer/reference to an addressable value.

Temporaries should not be addressable unless a specific lifetime extension rule is implemented.

Reject or carefully handle:

```ts
let ptr: Ptr<User> = User { id: 1, name: "Ana" }.ref
```

---

## 30. Packed Layout

`packed: true` means the compiler does not insert normal padding between fields.

Example:

```ts
struct Example {
    a: uint8
    b: uint32

    layout({ kind }: LayoutContext<Example>): Layout<Example> {
        return {
            kind: kind.struct,
            packed: true
        }
    }
}
```

Normal layout may be:

```txt
a: 1 byte
padding: 3 bytes
b: 4 bytes
total: 8 bytes
```

Packed layout may be:

```txt
a: 1 byte
b: 4 bytes
total: 5 bytes
```

LLVM representation:

```llvm
%Normal = type { i8, i32 }
%Packed = type <{ i8, i32 }>
```

`packed` should not be the default because it may cause unaligned access or reduced performance.

---

## 31. Alignment

`align` must normalize to a valid alignment.

Valid alignments are powers of two:

```txt
1, 2, 4, 8, 16, 32, 64, 128, ...
```

If alignment is represented through `type.i8`, `type.i16`, etc., the compiler must normalize it to byte alignment or a defined alignment policy.

Recommended initial behavior:

```txt
type.i8  -> align 1
type.i16 -> align 2
type.i32 -> align 4
type.i64 -> align 8
type.i128 -> align 16
```

Invalid dynamic align values should be rejected.

Example invalid if raw numeric align is allowed:

```ts
return {
    kind: kind.struct,
    align: 7
}
```

Diagnostic:

```txt
invalid layout align: expected power of two, got 7
```

If Yogi uses only layout tokens for align, invalid numeric align can be avoided entirely.

---

## 32. Storage Policy

Layouts may eventually include `storage`.

Possible storage values:

```txt
runtime
inline
pointer
slice
```

For object structs, storage should be treated as a policy/preference rather than an absolute command, because Yogi uses stack-first ownership and escape analysis.

Rules:

```txt
Default storage is stack/local when possible.
Escaping values may be promoted to heap.
storage.inline means inline representation when embedded.
storage.pointer means pointer representation.
storage.runtime means default runtime-managed representation for that category.
```

A `storage: stack` property is probably unnecessary because stack-first is already Yogi's default.

---

## 33. Layout Normalization

The compiler must normalize all layout results to canonical metadata.

Example source:

```ts
return {
    kind: kind.integer,
    type: type.i8,
    signed: sign.unsigned
}
```

Normalized metadata:

```txt
kind: integer
llvmType: i8
bitWidth: 8
signed: false
```

Example source:

```ts
return {
    kind: kind.float,
    type: type.f64,
    signed: sign.signed
}
```

Normalized metadata:

```txt
kind: float
llvmType: double
bitWidth: 64
```

`signed` is ignored for float.

Example source:

```ts
return {
    kind: kind.struct,
    packed: true,
    align: type.i8
}
```

Normalized metadata:

```txt
kind: struct
packed: true
alignBytes: 1
```

---

## 34. Layout Evaluation Restrictions

`layout()` should be deterministic and compile-time safe.

Allowed:

```txt
return object literals
read ctx metadata
read compile-time constants
simple conditional logic based on ctx metadata
pure compile-time expressions
```

Example:

```ts
layout(ctx: LayoutContext<Packet>): Layout<Packet> {
    if (ctx.fieldCount > 2) {
        return {
            kind: ctx.kind.struct,
            packed: false
        }
    }

    return {
        kind: ctx.kind.struct,
        packed: true
    }
}
```

Disallowed:

```txt
runtime function calls
I/O
printing
reading runtime values
mutating global state
allocating runtime objects
calling validate()
depending on non-constant variables
```

Invalid:

```ts
layout(ctx: LayoutContext<User>): Layout<User> {
    print("hello")
    return { kind: ctx.kind.struct }
}
```

Invalid:

```ts
layout(ctx: LayoutContext<User>): Layout<User> {
    let user: User = getRuntimeUser()
    return { kind: ctx.kind.struct }
}
```

---

## 35. Layout Dependencies and Cycles

The compiler must detect layout dependency cycles.

Invalid:

```ts
struct A extends number {
    layout(ctx: LayoutContext<B>): Layout<B> {
        return ctx.baseLayout
    }
}

struct B extends number {
    layout(ctx: LayoutContext<A>): Layout<A> {
        return ctx.baseLayout
    }
}
```

Diagnostic:

```txt
cyclic layout dependency between A and B
```

A struct may reference the layout context of another struct only if that other struct's layout can be resolved first.

---

## 36. Validation Chain and Inheritance

Validators run in inheritance order.

Parent first, then child.

Example:

```ts
struct A {
    validate(value: A): boolean {
        return true
    }
}

struct B extends A {
    validate(value: B): boolean {
        return true
    }
}

struct C extends B {
    validate(value: C): boolean {
        return true
    }
}
```

Constructing `C` runs:

```txt
A.validate(projected C as A)
B.validate(projected C as B)
C.validate(C)
```

If any validator returns false, construction fails.

No override behavior should remove parent validation unless an explicit future feature is added.

---

## 37. Compile-Time Constant Validation

If a value is a compile-time literal and the validator can be evaluated safely at compile time, the compiler may report validation errors at compile time.

Example:

```ts
let x: int8 = 999
```

Could produce compile-time error:

```txt
value 999 is not valid for int8
```

If the value is not known until runtime, emit runtime validation.

Example:

```ts
let x: int8 = readNumber()
```

Must validate at runtime.

---

## 38. Runtime Validation Failure

When validation fails at runtime, Yogi should call a runtime helper similar to:

```txt
yogi_struct_validate_failed(structName, validatorName)
```

The error should include at minimum:

```txt
struct name
validator name or source location
optional value/source info if available
```

Example message:

```txt
struct validation failed: int8.validate
```

---

## 39. Object Literal Construction

Object literals for object structs must lower to real LLVM struct values.

Example:

```ts
struct Point {
    x: number
    y: number
}

let p: Point = Point { x: 1, y: 2 }
```

Lowering concept:

```txt
create LLVM aggregate
insert field x
insert field y
run validation chain if present
```

Property access should lower to LLVM field extraction or pointer field access depending value category.

Example:

```ts
p.x
```

should lower to field access, not dynamic object lookup.

---

## 40. Struct Field Rules

Fields must have explicit types.

Valid:

```ts
struct User {
    id: uint64
    name: string
}
```

Invalid:

```ts
struct User {
    id
    name
}
```

Duplicate fields after inheritance expansion must be rejected unless an explicit override/shadowing rule is introduced.

Example invalid:

```ts
interface A {
    id: uint64
}

struct User extends A {
    id: string
}
```

Diagnostic should mention duplicate inherited field.

---

## 41. Field Order

Recommended field order:

```txt
parent fields first
then child fields in source order
```

For interface/type inherited fields:

```txt
inherited contract fields first in declaration order
then struct's own fields
```

Field order matters for ABI and LLVM struct layout.

The compiler must preserve deterministic ordering.

---

## 42. Struct Export/Import

Exported structs expose their semantic type and layout metadata to importing modules.

If a struct is exported, dependent modules must see:

```txt
name
fields
base type
normalized layout metadata
validate presence/signature
ABI shape
```

Imported modules should not need to re-evaluate source layout if metadata is available and fresh.

---

## 43. SIR / Metadata Expectations

The semantic representation should include enough information for backend lowering.

For each struct:

```txt
name
base kind: none | primitive | struct | interface | typeAlias
base name if any
field list after inheritance materialization
own field list
inherited field list
layout hook metadata
normalized layout metadata
validate hook metadata
validate chain parent-to-child
isScalar
isObjectLike
isPointerLike
isPacked
alignment
storage policy
LLVM type kind
```

For scalar numeric layout:

```txt
kind: integer | float
llvmType: i8 | i16 | i32 | i64 | i128 | float | double
bitWidth
signed behavior for integer
```

For object struct layout:

```txt
packed
align
field LLVM types
field order
```

For pointer layout:

```txt
pointee type
mutable
nullable
address space if added later
```

---

## 44. LLVM Lowering Expectations

Object structs lower to LLVM named struct types.

Scalar numeric structs lower to the selected primitive LLVM type.

Examples:

```txt
int8    -> i8
uint8   -> i8 with unsigned operation semantics
int32   -> i32
uint32  -> i32 with unsigned operation semantics
float32 -> float
double  -> double
```

Object struct:

```ts
struct Point {
    x: double
    y: double
}
```

lowers conceptually to:

```llvm
%Point = type { double, double }
```

Packed struct:

```llvm
%Packet = type <{ i32, i32 }>
```

---

## 45. Operations on Signed and Unsigned Integers

Physical LLVM type is the same for signed and unsigned integer structs with the same bit width.

Example:

```txt
int8  -> i8
uint8 -> i8
```

The difference is semantic operation lowering.

For signed integers:

```txt
signed comparisons
signed division
signed remainder
sign extension
```

For unsigned integers:

```txt
unsigned comparisons
unsigned division
unsigned remainder
zero extension
```

The compiler must carry signedness in semantic type information.

---

## 46. Assignment and Conversion

When assigning a value to a struct-typed variable, Yogi must ensure the value is valid for that struct.

Example:

```ts
let x: int8 = 10
```

If `10` is known at compile time, compile-time validation may be done.

If not known, runtime validation is required.

Example:

```ts
let x: int8 = readNumber()
```

Runtime validation must occur before `x` is accepted as `int8`.

---

## 47. Layout Does Not Validate

`layout()` must never call `validate()`.

`LayoutContext<Float32>` refers to compile-time metadata for `Float32`, not a runtime value of `Float32`.

Example:

```ts
struct Float32 extends number {
    layout({ kind, type }: LayoutContext<number>): Layout<number> {
        return {
            kind: kind.float,
            type: type.f32
        }
    }

    validate(value: number): boolean {
        return value >= -1000 && value <= 1000
    }
}
```

If another struct references `LayoutContext<Float32>`, the compiler reads `Float32`'s normalized layout metadata.

It does not run `Float32.validate()`.

---

## 48. Struct Extending Already Defined Scalar Struct

Example:

```ts
struct float32 extends number {
    layout({ kind, type }: LayoutContext<number>): Layout<number> {
        return {
            kind: kind.float,
            type: type.f32
        }
    }
}

struct Temperature extends float32 {
    validate(value: float32): boolean {
        return value >= -273.15
    }
}
```

`Temperature` inherits `float32` physical layout.

It adds runtime validation.

Conceptually:

```txt
float32:
    physical layout: f32

Temperature:
    physical layout: f32
    semantic validation: value >= -273.15
```

---

## 49. Diagnostics

Recommended diagnostics:

### Invalid primitive alias base

```txt
struct cannot extend primitive type alias 'Numeric'; extend 'number' directly or declare a struct
```

### Invalid validate return type

```txt
validate() must return boolean
```

### Invalid validate mutation

```txt
validate() parameter is readonly and cannot be mutated
```

### Invalid layout return type

```txt
layout() must return Layout<T> with an explicit generic type
```

### Invalid layout context type

```txt
layout() parameter must be LayoutContext<T>
```

### Invalid use of this

```txt
'this' is not allowed inside struct hooks; use layout(ctx) or validate(value)
```

### Unknown layout property

```txt
unknown layout property 'banana'
```

### Layout cycle

```txt
cyclic layout dependency between A and B
```

### Invalid align

```txt
invalid layout align: expected power of two
```

---

## 50. Recommended Standard Numeric Structs

The standard library can define real numeric data types using `struct`.

```ts
struct int8 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return { kind: kind.integer, type: type.i8, signed: sign.signed }
    }

    validate(value: number): boolean {
        return value >= -128 && value <= 127
    }
}

struct uint8 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return { kind: kind.integer, type: type.i8, signed: sign.unsigned }
    }

    validate(value: number): boolean {
        return value >= 0 && value <= 255
    }
}

struct int16 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return { kind: kind.integer, type: type.i16, signed: sign.signed }
    }
}

struct uint16 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return { kind: kind.integer, type: type.i16, signed: sign.unsigned }
    }
}

struct int32 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return { kind: kind.integer, type: type.i32, signed: sign.signed }
    }
}

struct uint32 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return { kind: kind.integer, type: type.i32, signed: sign.unsigned }
    }
}

struct int64 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return { kind: kind.integer, type: type.i64, signed: sign.signed }
    }
}

struct uint64 extends number {
    layout({ kind, type, sign }: LayoutContext<number>): Layout<number> {
        return { kind: kind.integer, type: type.i64, signed: sign.unsigned }
    }
}

struct float32 extends number {
    layout({ kind, type }: LayoutContext<number>): Layout<number> {
        return { kind: kind.float, type: type.f32 }
    }
}

struct double extends number {
    layout({ kind, type }: LayoutContext<number>): Layout<number> {
        return { kind: kind.float, type: type.f64 }
    }
}
```

These are real types, not aliases.

---

## 51. Summary Rules

```txt
struct is a real type.
interface/type are compile-time contracts unless consumed by struct.
type alias of primitive cannot be a struct base.
struct extending primitive creates scalar struct.
scalar struct without layout inherits primitive layout.
scalar struct with layout customizes physical representation.
object struct lowers to LLVM struct.
layout(ctx) is compile-time only.
validate(value) runs when real values need validation.
this is not allowed in struct hooks.
LayoutContext<T> is readonly and compiler-known.
kind/type/sign are readonly compile-time token objects.
type.i8/type.i16/type.i32/type.i64 model LLVM integer types.
sign controls signed/unsigned operation semantics.
float layouts ignore signed silently.
layout tokens do not lower to runtime.
backend receives normalized metadata only.
validators run parent-to-child.
validate parameter is readonly.
layout must be deterministic and cannot use runtime values.
```

---

## 52. Final Mental Model

```txt
struct + layout
    defines physical reality

struct + validate
    defines semantic validity

interface/type object-like
    defines compile-time shape contracts

LLVM lowering
    receives normalized struct metadata

runtime
    only sees real values and validation checks
```

A Yogi struct is therefore both:

```txt
a semantic type in the language
and a physical representation contract for the backend
```

That is the core design.
