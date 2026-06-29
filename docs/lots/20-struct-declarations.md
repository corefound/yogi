# Lot 20: Struct Declarations

## Goal

This lot connects `struct` declarations end-to-end through the compiler
pipeline:

```txt
source
  -> AST
  -> semantic SIR
  -> SIR FlatBuffer
  -> C++ FlatBuffer reader
  -> LLVM lowering
  -> object/executable
```

## Supported Syntax

Struct declarations can contain fields:

```ts
struct Point {
    x: number
    y: number
}
```

Structs can also define compiler-known hooks:

```ts
struct Packet {
    id: number
    label: string

    layout(): Layout<Packet> {
        return { packed: true, align: 8, storage: "stack" }
    }
}
```

For now, arbitrary methods inside structs are rejected. Struct members are
limited to:

- fields
- `layout()`
- `validate()`

`layout()` must be explicit. `any` is not allowed:

```ts
struct Packet {
    id: number

    layout(): Layout<Packet> {
        return { packed: true, align: 8, storage: "stack" }
    }
}
```

The compiler recognizes `Layout<T>` as a compiler-known layout description
type. The generic argument must also be explicit; `Layout<any>` is rejected.

`this` inside `layout()` is not the runtime struct value. It is a readonly
compile-time layout context used while the struct layout is being declared:

```ts
struct ChildPacket extends BasePacket {
    checksum: number

    layout(): Layout<ChildPacket> {
        return { packed: this.hasParent, align: this.fieldCount }
    }
}
```

Supported layout context properties are:

- `this.name`
- `this.parent`
- `this.hasParent`
- `this.fieldCount`
- `this.isScalar`

Runtime field reads such as `this.checksum` are rejected inside `layout()`
because the struct value does not exist yet.

## Struct As Type

Struct names resolve as object-like types:

```ts
let point: Point = { x: 4, y: 5 }
print(point.x)
```

Object literal assignment validates:

- missing required fields
- extra fields
- incorrect field types
- property access by declared field name

Scalar structs can extend supported primitive bases:

```ts
struct UserId extends number {
}

let id: UserId = 10
print(id)
```

Primitive bases supported by this lot are:

- `number`
- `string`
- `boolean`
- `undefined`
- `null`

These bases are treated as primitive type references, not symbol lookups.
Unknown non-primitive bases still report `cannot find type`.

## FlatBuffer Representation

The SIR schema now includes:

- `LayoutMetadata`
- `StructFieldDeclaration`
- `StructDeclaration`

`StructDeclaration` is part of the `SirNodeValue` union, so C++ can read it from
`sir.fb` just like variables, functions, arrays, and control-flow nodes.

## LLVM Lowering

The C++ lowering pass reads `StructDeclaration` nodes and registers LLVM named
struct types in the module lowering context before globals and functions are
lowered. This lets variables, parameters, return types, and object literals refer
to the real LLVM struct type.

Struct object literals lower to real LLVM struct values:

```llvm
%Point = type { double, double }
```

Field reads lower with `extractvalue`, and object construction lowers with
`insertvalue`. Struct values no longer use the generic `yogi_object_create`,
`yogi_object_set`, or `yogi_object_get` runtime path.

Struct fields can use other concrete Yogi types, including inherited interface
properties, inherited object-like type alias properties, strings, arrays, and
nested structs:

```ts
interface Labeled {
    label: string
}

type Tagged = {
    tag: string
    tags: string[]
}

struct ScoreBoard extends Labeled {
    scores: number[]

    validate(): boolean {
        return this.scores.length == 3
    }
}

struct TaggedScore extends Tagged {
    points: number[]
}

let board: ScoreBoard = { label: "scores", scores: [1, 2, 3] }
board.scores = [4, 5, 6]
```

`interface` and `type` declarations do not lower to standalone LLVM runtime
entities. They are compile-time data type contracts. When a real `struct`
extends an interface or an object-like type alias, the inherited properties are
expanded into the struct field list and then serialized into SIR. The backend
therefore sees a normal real struct and lowers those inherited properties as
real LLVM fields.

Object-like interfaces and type aliases can also be used directly as explicit
types for variables, parameters, and returns:

```ts
interface Profile {
    name: string
    scores: number[]
}

type Report = {
    label: string
    total: number
}

function profileScore(value: Profile): number {
    return value.scores.length
}

function makeReport(): Report {
    return { label: "daily", total: 42 }
}

let profile: Profile = { name: "ana", scores: [2, 4, 6] }
let report: Report = makeReport()
```

In that direct form, the contract is still compile-time, but the value lowers
through the current object-runtime representation. This is different from
`struct`, which lowers as a named LLVM value type. Primitive and aggregate type
aliases resolve to their underlying representation in the backend:

```ts
type Count = number
type ScoreList = number[]

let count: Count = 12
let scores: ScoreList = [5, 6, 7, 8]
```

Because these forms use different runtime representations, Yogi currently does
not perform implicit conversion between a real struct value and an object-runtime
contract value:

```ts
interface Dimensions {
    width: number
    height: number
}

struct Size extends Dimensions {
}

let size: Size = { width: 3, height: 4 }
let dimensions: Dimensions = size // rejected
```

Use an explicit object literal adapter when the runtime representation should be
object-based:

```ts
let dimensions: Dimensions = {
    width: size.width,
    height: size.height,
}
```

Or keep APIs concrete when the function should receive the real LLVM struct:

```ts
function area(value: Size): number {
    return value.width * value.height
}
```

This keeps ownership and cleanup correct until Yogi has explicit adapter/copy
semantics for resource-owning structs.

## Generic Interfaces And Type Aliases

Interfaces and type aliases support basic generic type parameters with real
substitution:

```ts
interface Box<T> {
    value: T
}

type Pair<T, U = number> = {
    first: T
    second: U
}

let text: Box<string> = { value: "boxed" }
let pair: Pair<string> = { first: "left", second: 5 }
```

Type parameter defaults are honored, and constraints are checked:

```ts
interface TextLabel<T extends string> {
    label: T
}

type Metric<T extends number = number> = {
    value: T
}

let label: TextLabel<string> = { label: "ok" }
let metric: Metric = { value: 21 }
```

Invalid generic usage is rejected:

```ts
let missing: Box = { value: 1 }                 // missing T
let extra: Pair<string, number, boolean> = ...  // too many args
let bad: TextLabel<number> = { label: 1 }       // violates T extends string
```

Structs can extend generic interfaces and object-like type aliases. The
inherited fields are materialized after substitution:

```ts
struct LabelledScore extends TextLabel<string> {
    score: number
}
```

## Readonly, Optional, And Intersections

Object-like interfaces and type aliases support `readonly` and optional
properties:

```ts
type AuditRecord = {
    readonly id: number
    note?: string
}

let audit: AuditRecord = { id: 44 }
print(audit.note ?? "none")
```

Assignments to readonly members are rejected:

```ts
audit.id = 2 // error
```

Structs inherit readonly and optional fields from interfaces/type aliases, and
those inherited fields are materialized into the real LLVM struct layout:

```ts
interface ConfigShape {
    readonly id: number
    label?: string
}

struct Config extends ConfigShape {
}

let config: Config = { id: 66 }
print(config.label ?? "default")
config.id = 2 // error
```

Direct `readonly`/`?` syntax inside a `struct` body still needs parser support
before it can be accepted as source syntax. The semantic/lowering model is
already exercised through inherited fields.

Object-like intersections merge their required members:

```ts
type NamedPart = {
    name: string
}

type ValuePart = {
    value: number
}

type NamedMetric = NamedPart & ValuePart

let metric: NamedMetric = { name: "nm", value: 55 }
```

Missing or incorrectly typed properties in the intersection are rejected.

Non-object type aliases are rejected as struct bases:

```ts
type Numeric = number

struct Bad extends Numeric {
    value: number
}
```

The error is intentional because `Numeric` has no statically known object
members to materialize into the struct layout.

Resource fields are owned by the containing struct. Cleanup recursively destroys
owned resource fields when a struct global/module value is cleaned up or when a
local struct leaves scope. Replacing a resource field destroys the previous
field value before storing the new one.

`layout()` metadata is preserved. The current backend applies `packed: true` to
the LLVM struct body:

```llvm
%Packet = type <{ double, ptr }>
```

`validate()` is a compiler-known hook. This lot validates its shape:

- it must declare a return type
- it must return `boolean`
- it must not take parameters
- it must have a body

Validate hooks are inherited as an ordered chain. If a parent and child both
declare `validate()`, the semantic SIR stores the chain in parent-to-child order:

```ts
struct BasePacket {
    version: number

    validate(): boolean {
        return this.version == 1
    }
}

struct ChildPacket extends BasePacket {
    checksum: number

    validate(): boolean {
        return this.checksum == 7
    }
}
```

The child carries a validate chain equivalent to:

```txt
BasePacket.validate -> ChildPacket.validate
```

Each validate hook is emitted as an internal boolean function. When a struct
literal is constructed, the LLVM backend calls the chain in order. If any
validator returns `false`, runtime aborts through:

```txt
yogi_struct_validate_failed(structName, validatorName)
```

Validators receive an implicit readonly runtime `this` value. `this.field` reads are
type-checked against the struct fields and lowered as LLVM struct field reads.
For inherited validation, the child struct value is projected to the parent
layout before the parent validator is called.

Mutating `this` inside validate is rejected.

## Tests

`yogi_pipeline_struct_declarations` covers:

- struct declaration through AST/SIR/SIR FlatBuffer
- generated `ast.fb`, `sir.fb`, `main.ll`, and `main.o`
- executable output from struct-typed object literals
- property access on struct-typed values
- layout hook parsing/serialization
- strict `Layout<T>` return type validation
- inherited validate chain metadata
- validate chain lowering and runtime failure diagnostics
- interface-inherited struct fields
- object-like type-alias-inherited struct fields
- array/string/nested struct fields
- `string[]` fields inherited from interface/type bases
- direct object-like interface/type variables, parameters, and returns
- generic interface/type substitution in variables, parameters, returns, and
  struct extends
- generic type parameter defaults
- generic type parameter constraints
- readonly properties on object-like interfaces/type aliases
- optional properties on object-like interfaces/type aliases
- inherited readonly/optional fields in real structs
- object-like intersection types
- primitive and aggregate type aliases lowering through their resolved type
- explicit object literal adapters from struct fields to object-like contracts
- diagnostics for implicit struct/object-contract runtime representation crossing
- resource field cleanup and replacement
- real LLVM struct representation checks
- scalar primitive struct inheritance
- duplicate field diagnostics
- unsupported member diagnostics
- missing field diagnostics
- wrong field type diagnostics
- unknown extends diagnostics
- non-object type alias extends diagnostics
- object-like interface/type missing and wrong property diagnostics
- object-like interface/type function argument diagnostics
- generic arity and constraint diagnostics
- readonly property assignment diagnostics
- object-like intersection missing/wrong property diagnostics
- invalid validate return diagnostics
