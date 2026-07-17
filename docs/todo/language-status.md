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
- [x] Address-of expression `&struct.field` for direct real struct fields
- [x] Address-of expression `&box.point.x` for nested real struct fields
- [x] Address-of expression `&object.field` through runtime property cells
- [x] Address-of expression `&matrix[i, j]` through row-major runtime array cells
- [x] Direct nested struct field assignment through real storage, such as `box.point.x = 100`
- [x] Direct nested struct assignment agrees with `&box.point.x` pointer write-through
- [x] Struct field projections through `ptr<Struct>`, such as `pBox.point.x = 100`
- [x] Returning field pointers from `ptr<Struct>` parameters, such as `return &box.point.x`
- [x] Tagged pointer-cell lowering for runtime object/array slots
- [x] Address-of `const` storage with readonly pointer provenance
- [x] Strict pointer assignability and pointer parameter passing
- [x] Pointer copy preserving mutable/readonly provenance
- [x] Pointer SIR/FBS metadata for root symbol, access path, and permission
- [x] Pointer arithmetic rejection in safe Yogi
- [x] Scalar pointer access/read with `p[0]` for `ptr<number>`, `ptr<string>`, and `ptr<boolean>`
- [x] Scalar pointer write-through with `p[0] = value`
- [x] Scalar pointer read-through in scalar contexts such as `print(p)`, `let value: number = p`, call args, and returns
- [x] Scalar pointer write-through through pointer binding assignment such as `p = 42`
- [x] Public `*p` and `(*p) = value` syntax rejection
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
- [x] Partial fixed-shape slice assignment copies RHS arrays/views into row-major target slices
- [x] Returning borrowed fixed-shape views from local owners is rejected unless `.copy()` is used
- [x] Explicit `.copy()` for owned fixed-shape view/array copies
- [x] Array spread in dynamic literals with runtime push/get lowering
- [x] Fixed-size 1D array spread when spread length is compile-time known
- [x] Spread element type checking for dynamic, fixed, tuple, and union targets
- [x] Common non-callback array methods
- [x] Callback array methods
- [x] Local captures for immediate inline array callbacks
- [x] Array destructuring declarations, holes, rest bindings, tuple-rest annotations, and `for...of` destructuring
- [x] Depth-aware semantic result typing for `flat(depth)` with known literal depth
- [x] Iterator protocol support for arrays
- [x] Array print support
- [x] Const/readonly propagation through borrowed fixed-shape views
- [x] General array pointer indexing beyond scalar literal `0`
- [x] `ptr<T[]>` readonly `.length` access
- [x] `for-of` value/pointer iteration over `ptr<T[]>`
- [x] Pointer partial views such as `ptr<number[2, 3]>[0] -> ptr<number[3]>`
- [x] Borrow summaries adjusted for `ptr<T>` parameter-derived returns
- [x] Semantic rejection for returning pointer views derived from local storage
- [x] Semantic rejection for pointer-return paths borrowing from different parameters
- [x] Internal dereference SIR for scalar pointer read-through lowering
- [x] Aggregate pointer read-through rejection to avoid implicit owned copies
- [x] Nested runtime object cell chains such as `&user.address.zip`
- [x] Mixed array/object/struct addressability such as `&users[0].age`
- [x] Pointer-safe dynamic array `push` while a live internal pointer exists
- [x] Dynamic array mutating methods keep JavaScript-style surface while tracking element identity
- [x] Runtime pointer validity checks for dynamic array slots removed by `pop`, `shift`, and `splice`
- [x] Nested dynamic-array pointer chains such as `&matrix[0][1]`
- [x] Compile-time diagnostics for provably invalidated nested dynamic-array pointer use
- [x] Pointer identity preservation across `unshift`, `reverse`, `sort`, `fill`, and `copyWithin`
- [x] Copy-returning array methods do not invalidate original dynamic array pointers
- [x] Pointer rebind and scope-exit updates for dynamic array invalidation diagnostics
- [x] Dynamic array assignment performs in-place slot replacement: preserved indexes keep pointer identity, removed indexes invalidate pointers
- [x] Adaptive fast contiguous vs pointer-safe/chunked dynamic array storage selected by semantic analysis
- [x] Runtime migration from contiguous to pointer-safe storage when an interior pointer cell is requested after allocation
- [x] Extern native ABI supports numeric arrays through temporary contiguous buffers (`number[]`, `ptr<number[]>`, and fixed-shape numeric arrays)
- [x] Pointer-return provenance from `ptr<Array>` parameters into dynamic array cells
- [ ] Pointer invalidation diagnostics for dynamic object structural mutation, if dynamic object storage is added
- [ ] Interprocedural lifetime summaries for borrowed views
- [ ] Native LLVM `[N x T]` or equivalent fixed-shape ABI without runtime array descriptor
- [ ] Native array ABI marshalling for strings and ABI-safe structs
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

## Testing

- [x] Unit tests for focused runtime/compiler behavior
- [x] Focused runtime pipeline tests by language area
- [x] Program Tests category for complete Yogi programs
- [x] Inventory Manager Program Test
- [x] Tagged User Cleanup Program Test
- [x] Player Scoreboard Program Test
- [x] Matrix Report Program Test
- [x] Sales Destructuring Report Program Test
- [x] Array Storage Policy Report Program Test
- [ ] Contact Manager Program Test
- [ ] Matrix Operations Program Test
- [ ] Graph Traversal Program Tests
- [ ] Expression Evaluator Program Test
