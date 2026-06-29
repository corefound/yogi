# Language Status To Do

This file tracks feature readiness at a language level. Keep it updated at the
end of each implementation lot so future work can start from the current state
without re-auditing the whole compiler.

## Data Types

- [x] Explicit primitive types: `number`, `string`, `boolean`, `void`, `undefined`, `null`
- [x] Explicit variable type annotations required
- [x] `any` allowed at declaration boundaries with explicit cast required before use
- [x] Union types for variables and returns
- [x] Basic equality narrowing
- [x] Object-like type aliases as compile-time data type contracts
- [x] Interfaces as compile-time data type contracts
- [x] Object-like interfaces/type aliases for variables, parameters, and returns
- [x] Generic interfaces and type aliases with real type substitution
- [x] Generic type parameter defaults
- [x] Generic type parameter constraints
- [x] Structs extending generic interfaces/type aliases after substitution
- [x] Readonly properties on object-like interfaces/type aliases
- [x] Optional properties on object-like interfaces/type aliases
- [x] Inherited readonly/optional fields in real structs
- [x] Direct `readonly` and optional field syntax inside `struct` bodies
- [x] Object-like intersection types
- [x] Primitive and aggregate type aliases lower through their resolved backend type
- [x] Interface extension with inherited object-like members
- [x] Struct declarations as real custom data types
- [x] Struct fields with primitive, string, array, nested struct, and inherited fields
- [x] Structs extending primitive scalar bases
- [x] Structs extending other structs with inherited fields and validate chains
- [x] Structs extending interfaces
- [x] Structs extending object-like type aliases
- [x] Reject struct extension from non-object type aliases
- [x] Reject method/call/construct/index signatures in data-only interface/type contracts
- [x] Reject implicit conversion between real structs and object-runtime contracts
- [x] Explicit object literal adapters from structs to interface/type contracts
- [x] Struct `layout(): Layout<T>` hook with compile-time readonly `this`
- [x] Numeric scalar `layout(): IntegerLayout` hook lowering to fixed-width LLVM integers
- [x] Struct `validate(): boolean` hook with runtime readonly `this`
- [x] Struct SIR FlatBuffer serialization
- [x] Struct LLVM lowering as real named LLVM structs
- [x] Struct runtime validation failure hook
- [ ] Higher-order type machinery such as mapped, conditional, infer, and keyof-style type operators
- [ ] Function-value model for interface/type behavior contracts
- [ ] Explicit runtime conversion API for non-literal `number` to fixed-width numeric structs
- [ ] Explicit copy/move policy for resource-owning structs
- [ ] Explicit adapter/copy semantics for resource-owning structs crossing interface/type contract boundaries

## Arrays

- [x] Dynamic arrays with runtime descriptor and heap buffer
- [x] Common non-callback array methods
- [x] Callback array methods
- [x] Iterator protocol support for arrays
- [x] Array print support
- [ ] Final audit against all JavaScript/TypeScript Array methods

## Strings

- [x] Strict string operators
- [x] Template literals and interpolation
- [x] Common string methods
- [x] String iteration support
- [ ] Final audit against all JavaScript/TypeScript String methods

## Memory And Ownership

- [x] Stack-first local lifetime model
- [x] Escape analysis basics
- [x] Aggregate assignment ownership
- [x] Function boundary ownership summaries
- [x] Destructor scheduling across common control flow
- [x] Runtime allocator ABI
- [x] Runtime ownership debug checks
- [ ] Explicit copy/move constructors for structs and aggregate resources
- [ ] Escape analysis for closures and advanced aliasing

## Control Flow

- [x] `if` / `else`
- [x] `while`
- [x] `for`
- [x] `for...of`
- [x] `switch` with TypeScript-style fall-through and definite-assignment validation
- [x] `break` / `continue`
- [ ] Exhaustiveness helpers for union-like values
