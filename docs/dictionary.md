# Yogi Dictionary / Object Semantics

This document defines the planned dictionary/object model for Yogi.

Yogi keeps a TypeScript-like surface syntax, but it is not a dynamic JavaScript object model.
Yogi is a statically typed, strictly typed, Ahead-of-Time compiled language.
Because of that, object and dictionary shapes must be predictable at compile time.

Core idea:

```txt
object/type/interface/struct = fixed-shape record
array[]                      = dynamic length, fixed element type
map<K, V>                    = future explicit dynamic key/value collection
```

Yogi objects are not open-ended dynamic dictionaries by default.
Every object key must be known and typed.

---

## 1. Main Rule

Yogi object/dictionary values must have explicitly declared keys and value types.

Valid:

```ts
let user: {
    name: string
    age: number
    active: boolean
} = {
    name: "Ana",
    age: 20,
    active: true
}
```

Invalid:

```ts
let user = {
    name: "Ana",
    age: 20
}
```

Expected diagnostic:

```txt
error: object declaration requires an explicit type
```

Reason:

```txt
Yogi does not infer object shapes.
All fields and field types must be declared explicitly.
```

---

## 2. Fixed-Shape Records

A Yogi dictionary/object with declared keys is a fixed-shape record.

Example:

```ts
type User = {
    name: string
    age: number
    score: number
}
```

Conceptually, the compiler knows:

```txt
User.name  -> string
User.age   -> number
User.score -> number
```

The compiler can represent this as stable memory:

```txt
[ name ][ age ][ score ]
```

This means Yogi can know field offsets, field types, and addressability at compile time.

---

## 3. Structs, Types, Interfaces, and Object Literals

Yogi may expose multiple ways to describe structured data:

```ts
struct User {
    name: string
    age: number
}
```

```ts
type User = {
    name: string
    age: number
}
```

```ts
interface User {
    name: string
    age: number
}
```

```ts
let user: {
    name: string
    age: number
} = {
    name: "Ana",
    age: 20
}
```

These forms may have different semantic roles later, but for object shape purposes, they all describe known fields.

Rule:

```txt
Declared object shapes are fixed-shape records.
```

Therefore, fields from these shapes are known at compile time.

---

## 4. No TypeScript-Style Dynamic Index Signatures

Yogi should not support TypeScript-style index signatures inside object/type/interface declarations.

Invalid:

```ts
type Scores = {
    [key: string]: number
}
```

Invalid:

```ts
interface Scores {
    [key: string]: number
}
```

Expected diagnostic:

```txt
error: dynamic index signatures are not supported in Yogi object types
help: declare explicit keys or use a typed collection designed for dynamic keys
```

Reason:

```txt
An index signature means any string key is valid.
That creates an open object shape.
Open object shapes are less predictable and do not have a fixed field layout.
```

Yogi objects should be strict, predictable, and AOT-friendly.

---

## 5. Why Dynamic Arrays Are Allowed but Dynamic Object Keys Are Not

Dynamic arrays are acceptable because they are dynamic only in length, not in element type.

Example:

```ts
let names: string[] = []
```

This is still predictable:

```txt
- every element is string
- access is by numeric index
- the element type is known
- the layout model is sequential
```

A dynamic object index signature is different:

```ts
type Data = {
    [key: string]: number
}
```

This means:

```txt
- any string key may exist
- the set of keys is not known at compile time
- the shape is open
- field layout is not fixed
- storage may require a map/hash table representation
```

Yogi should avoid this in normal object/type/interface shapes.

Summary:

```txt
Dynamic array  = dynamic length, fixed element type, predictable.
Dynamic object = dynamic shape, dynamic keys, less predictable.
```

---

## 6. Unknown Properties Are Errors

Because objects are fixed-shape records, object literals must not contain unknown properties.

Example:

```ts
type User = {
    age: number
}

let user: User = {
    age: 20,
    name: "Ana"
}
```

Expected diagnostic:

```txt
error: object for 'user' has unknown property 'name'
```

Reason:

```txt
The declared shape of User only contains 'age'.
'name' is not part of the record layout.
```

This must also apply inside arrays:

```ts
type User = {
    age: number
}

let users: User[] = [
    {
        age: 20,
        name: "Ana"
    }
]
```

Expected diagnostic:

```txt
error: object element has unknown property 'name'
```

---

## 7. Missing Properties Are Errors

A fixed-shape object must provide all required fields unless Yogi later adds explicit optional fields.

Example:

```ts
type User = {
    name: string
    age: number
}

let user: User = {
    name: "Ana"
}
```

Expected diagnostic:

```txt
error: object for 'user' is missing required property 'age'
```

Reason:

```txt
The object shape requires both 'name' and 'age'.
```

---

## 8. Field Type Mismatches Are Errors

Each declared field has a specific type.

Example:

```ts
type User = {
    age: number
}

let user: User = {
    age: "20"
}
```

Expected diagnostic:

```txt
error: property 'age' expected number, got string
```

No implicit conversion should happen.

---

## 9. Field Addressability

Because typed objects are fixed-shape records, their fields are addressable.

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

let agePtr: ptr<number> = &user.age
```

Rule:

```txt
&object.field is valid when object is addressable and field is a declared field.
```

Result type:

```txt
&user.age -> ptr<number>
```

Reason:

```txt
user.age has stable storage inside user.
The compiler knows the field offset and field type.
```

---

## 10. Const Object Field Addressability

Taking the address of a field inside a const object is allowed.

Example:

```ts
type User = {
    age: number
    score: number
}

const user: User = {
    age: 20,
    score: 90
}

let agePtr: ptr<number> = &user.age
```

This is valid.

However, the pointer is read-only by origin because the root storage is const.

Valid:

```ts
print(agePtr[0])
```

Invalid:

```ts
agePtr[0] = 30
```

Expected diagnostic:

```txt
error: cannot mutate storage derived from const value 'user'
```

Rule:

```txt
Pointer mutability is decided by the original/root storage.
```

```txt
&letObject.field   -> pointer with mutable permission
&constObject.field -> pointer with readonly permission
```

The visible type stays the same:

```ts
ptr<number>
```

Yogi should not require:

```ts
ptr<const number>
readonly<number>
```

---

## 11. Root Storage Decides Mutability

For pointers to object fields, the root owner decides whether mutation is allowed.

Example:

```ts
let user: User = {
    age: 20,
    score: 90
}

let p: ptr<number> = &user.age
```

Internal pointer provenance:

```txt
root storage: user
root mutability: mutable
field path: age
permission: mutable
```

But:

```ts
const user: User = {
    age: 20,
    score: 90
}

let p: ptr<number> = &user.age
```

Internal pointer provenance:

```txt
root storage: user
root mutability: const
field path: age
permission: readonly
```

This keeps the user-facing syntax simple while preserving const safety.

---

## 12. No Open Object Expansion

Yogi object values cannot receive new fields outside their declared shape.

Invalid:

```ts
type User = {
    age: number
}

let user: User = {
    age: 20
}

user.name = "Ana"
```

Expected diagnostic:

```txt
error: property 'name' does not exist on type User
```

Reason:

```txt
The record shape is closed.
New keys cannot be added dynamically.
```

---

## 13. No Dynamic Bracket Keys for Object Shapes

For fixed-shape objects, dot-access is the recommended form for fields.

Valid:

```ts
let age: number = user.age
```

Bracket access with a string literal may be supported as a strict alias later:

```ts
let age: number = user["age"]
```

But it must only be valid when the key is a known declared field.

Invalid:

```ts
let value: number = user[someString]
```

Expected diagnostic:

```txt
error: dynamic object key access is not supported for fixed-shape records
```

Reason:

```txt
Yogi objects are not open dynamic dictionaries.
Field access must be statically known.
```

---

## 14. Future `map<K, V>`

If Yogi needs true dynamic key/value storage, it should be represented with a separate collection type.

Example future syntax:

```ts
let scores: map<string, number> = Map()

scores["math"] = 90
scores["science"] = 80
```

This is different from a fixed-shape object.

Rule:

```txt
object/type/interface/struct = fixed-shape record
map<K, V>                    = dynamic key/value collection
```

Pointers to map entries should not be allowed initially.

Invalid:

```ts
let p: ptr<number> = &scores["math"]
```

Expected diagnostic:

```txt
error: cannot take address of map entry because map storage is dynamic
```

Reason:

```txt
Map entries may move when the map grows, resizes, or rehashes.
```

---

## 15. Relationship with Pointers

Because Yogi objects are fixed-shape records, pointers can safely target declared fields.

Valid:

```ts
type User = {
    age: number
    score: number
}

let user: User = {
    age: 20,
    score: 90
}

function increase(value: ptr<number>): void {
    value[0] = value[0] + 1
}

increase(&user.age)

print(user.age) // 21
```

This avoids passing or copying the whole object when only a field is needed.

For large records, structs, or nested data, this can be very efficient.

---

## 16. Relationship with LLVM

Fixed-shape records map cleanly to LLVM aggregate layouts.

Example:

```ts
type User = {
    age: number
    score: number
}
```

Possible LLVM-style conceptual layout:

```txt
%User = type { double, double }
```

Field address:

```ts
&user.age
```

Can lower conceptually to:

```txt
getelementptr %User, ptr %user, 0, fieldIndex(age)
```

This is simple, efficient, and AOT-friendly.

Dynamic object shapes would not lower this cleanly because keys and storage layout would not be fixed.

---

## 17. Nested Objects

Nested fixed-shape objects are also addressable if every step in the path is fixed and addressable.

Example:

```ts
type Address = {
    zip: number
}

type User = {
    age: number
    address: Address
}

let user: User = {
    age: 20,
    address: {
        zip: 10001
    }
}

let zipPtr: ptr<number> = &user.address.zip
```

Result:

```txt
&user.address.zip -> ptr<number>
```

Rule:

```txt
A field path is addressable when the root is addressable and every field in the path is a declared fixed field.
```

---

## 18. Arrays of Objects

Objects inside arrays should also be checked strictly.

Example:

```ts
type User = {
    age: number
    score: number
}

let users: User[2] = [
    { age: 20, score: 90 },
    { age: 30, score: 100 }
]
```

Field address of an element is supported when the element is reached through an
addressable array cell:

```ts
let p: ptr<number> = &users[0].age
```

For fixed-size arrays this uses row-major array cell addressability.

For dynamic arrays:

```ts
let users: User[] = [
    { age: 20, score: 90 }
]

let p: ptr<number> = &users[0].age
```

This is also supported through a tagged runtime cell pointer. The pointer keeps
the root provenance and readonly permission from `users`; writes through the
pointer are rejected if the root is `const`.

Current dynamic-array policy:

```txt
Yogi rejects dynamic array structural mutation while a live pointer points into
that array.
```

Dynamic object structural invalidation remains pending if Yogi later adds
operations that can insert/remove object fields or replace object storage.

---

## 19. Implementation Notes

The semantic analyzer should classify object shapes as fixed records.

Suggested internal metadata:

```txt
RecordType
  fields:
    - name: string
      type: string
      index: 0
    - name: age
      type: number
      index: 1
```

Address-of field expression:

```txt
AddressOfExpression
  base: Identifier(user)
  path:
    - Field(age)
  resultType: ptr<number>
  provenance:
    root: user
    permission: mutable | readonly
```

No index-signature field should be allowed in RecordType.

---

## 20. Diagnostics Summary

Recommended diagnostics:

```txt
error: dynamic index signatures are not supported in Yogi object types
help: declare explicit keys or use a typed collection designed for dynamic keys
```

```txt
error: object declaration requires an explicit type
```

```txt
error: object for 'name' has unknown property 'field'
```

```txt
error: object for 'name' is missing required property 'field'
```

```txt
error: property 'field' expected T, got U
```

```txt
error: property 'field' does not exist on type T
```

```txt
error: dynamic object key access is not supported for fixed-shape records
```

```txt
error: cannot mutate storage derived from const value 'name'
```

```txt
error: cannot take address of map entry because map storage is dynamic
```

---

## 21. Core Tests

### Valid fixed-shape object

```ts
type User = {
    age: number
    score: number
}

let user: User = {
    age: 20,
    score: 90
}

print(user.age)
```

Expected:

```txt
20
```

---

### Unknown property

```ts
type User = {
    age: number
}

let user: User = {
    age: 20,
    name: "Ana"
}
```

Expected diagnostic:

```txt
object for 'user' has unknown property 'name'
```

---

### Missing property

```ts
type User = {
    age: number
    score: number
}

let user: User = {
    age: 20
}
```

Expected diagnostic:

```txt
object for 'user' is missing required property 'score'
```

---

### Index signature rejected

```ts
type Scores = {
    [key: string]: number
}
```

Expected diagnostic:

```txt
dynamic index signatures are not supported in Yogi object types
```

---

### Address of object field

```ts
type User = {
    age: number
}

let user: User = {
    age: 20
}

let p: ptr<number> = &user.age

print(1)
```

Expected:

```txt
1
```

---

### Address of const object field

```ts
type User = {
    age: number
}

const user: User = {
    age: 20
}

let p: ptr<number> = &user.age

print(p[0])
```

Expected:

```txt
20
```

---

### Mutating pointer derived from const object field

```ts
type User = {
    age: number
}

const user: User = {
    age: 20
}

let p: ptr<number> = &user.age

p[0] = 30
```

Expected diagnostic:

```txt
cannot mutate storage derived from const value 'user'
```

---

## 22. Final Design Summary

Yogi dictionary/object model:

```txt
Yogi objects are fixed-shape records.
All keys must be explicitly declared.
All field value types must be explicitly declared.
TypeScript-style index signatures are not supported.
Dynamic object keys are not part of normal object/type/interface declarations.
```

Addressability:

```txt
Declared fields have stable storage.
&object.field is valid for typed objects/records.
The resulting pointer type is ptr<FieldType>.
Pointer mutability is inherited from the root storage.
```

Mutability:

```txt
let object   -> field pointer can mutate
const object -> field pointer is readonly by origin
```

Collections:

```txt
Dynamic arrays are allowed because their element type is fixed and predictable.
Dynamic key/value collections should use a separate future map<K, V> type.
```

Core philosophy:

```txt
Yogi is strict, predictable, and AOT-friendly.
Objects should have known shapes and stable layouts.
```
