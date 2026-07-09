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

- [x] Core pointer type syntax `ptr<T>`
- [x] Address-of expression `&value` for addressable variables
- [x] Address-of `const` storage with readonly pointer provenance
- [x] Strict pointer assignability and pointer parameter passing
- [x] Pointer copy preserving mutable/readonly provenance
- [x] Pointer SIR/FBS metadata for root symbol, access path, and permission
- [x] Pointer arithmetic rejection in safe Yogi
- [x] Scalar pointer access/read with `p[0]` for `ptr<number>`, `ptr<string>`, and `ptr<boolean>`
- [x] Scalar pointer write-through with `p[0] = value`
- [x] Pointer parameters for scalar values, dynamic 1D arrays, and fixed-shape arrays
- [x] Full fixed-shape array pointer indexing read/write through caller storage
- [x] Dynamic 1D array pointer indexing through `ptr<number[]>`
- [x] Normal fixed-shape array parameters use local/value semantics
- [x] Readonly provenance enforcement for pointer write-through
- [x] `const p: ptr<T>` binding behavior separated from pointed storage mutability
- [x] Basic function pointer mutation summaries and call-site rejection for `&const`
- [x] `prt<T>` typo diagnostic for pointer type annotations
- [x] Dynamic arrays with runtime descriptor and heap buffer
- [x] Strict bracket access with runtime range errors
- [x] Safe `.at(index)` access that may return `undefined`
- [x] Fixed-size one-dimensional arrays such as `number[3]`
- [x] Fixed-shape multidimensional arrays such as `number[2, 3]`
- [x] Coordinate indexing syntax such as `matrix[1, 2]`
- [x] Fixed-shape array literal validation by dimension and element type
- [x] Fixed-shape metadata in FlatBuffers/SIR
- [x] Flat row-major backend lowering for fixed-shape array literals and full coordinate access
- [x] Partial fixed-shape indexing type inference
- [x] Borrowed fixed-shape views for local partial indexing
- [x] Mutation through borrowed fixed-shape views updates original storage
- [x] Returning borrowed fixed-shape views from local owners is rejected unless `.copy()` is used
- [x] Explicit `.copy()` for owned fixed-shape view/array copies
- [x] Array spread in dynamic literals with runtime push/get lowering
- [x] Fixed-size 1D array spread when spread length is compile-time known
- [x] Spread element type checking for dynamic, fixed, tuple, and union targets
- [x] Common non-callback array methods
- [x] Callback array methods
- [x] Local captures for immediate inline array callbacks
- [x] Depth-aware semantic result typing for `flat(depth)` with known literal depth
- [x] Iterator protocol support for arrays
- [x] Array print support
- [x] Const/readonly propagation through borrowed fixed-shape views
- [x] General array pointer indexing beyond scalar literal `0`
- [x] Pointer partial views such as `ptr<number[2, 3]>[0] -> ptr<number[3]>`
- [x] Borrow summaries adjusted for `ptr<T>` parameter-derived returns
- [x] Semantic rejection for returning pointer views derived from local storage
- [x] Semantic rejection for pointer-return paths borrowing from different parameters
- [x] General dereference operator syntax: `*p` read and scalar `(*p) = value` write-through
- [ ] Interprocedural lifetime summaries for borrowed views
- [ ] Native LLVM `[N x T]` or equivalent fixed-shape ABI without runtime array descriptor
- [ ] Dynamic shaped arrays with compile-time rank and runtime dimensions
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
