# Arrays

This file tracks array work that is intentionally not complete yet.

Keep this updated at the end of each array-related lot so future work
can start from the known state instead of rediscovering gaps from the
source code.

Yogi arrays are designed to be explicit, strict, shape-aware, efficient
for LLVM lowering, and still comfortable to use with a
scripting-language feel.

Core model:

``` ts
T[]          // dynamic 1D array
T[N]         // fixed-size 1D array
T[N, M]      // fixed-shape 2D array
T[N, M, K]   // fixed-shape multidimensional array
```

Yogi does not need a separate native `Vector` container. Domain-specific
vector/matrix types can be built with `type`, `interface`, or `struct`.

``` ts
type Vector2 = float32[2]
type Vector3 = float32[3]
type Matrix4 = float32[4, 4]
type RGBA = uint8[4]
```

------------------------------------------------------------------------

## Core Design Rules

### Strict access vs safe access

Direct bracket indexing is strict:

``` ts
let scores: number[] = [10, 20, 30]

scores[0] // OK
scores[5] // runtime range error
```

Safe optional access uses methods such as `.at()`:

``` ts
let value: number | undefined = scores.at(5)
```

Rule:

``` txt
array[index]     = strict access, must exist
array.at(index)  = safe access, may return undefined
```

------------------------------------------------------------------------

### Fixed-size arrays

Fixed-size arrays must have exactly the declared length.

``` ts
let vec: number[3] = [10, 20, 30] // OK
```

Invalid:

``` ts
let vec: number[3] = [10, 20]
// error: expected 3 elements, got 2
```

Invalid:

``` ts
let vec: number[3] = [10, 20, 30, 40]
// error: expected 3 elements, got 4
```

`number[3]` means exactly 3 elements. It does not mean "capacity up to
3".

Size-changing methods are rejected on fixed arrays:

``` ts
vec.push(4)       // error
vec.pop()         // error
vec.shift()       // error
vec.unshift(0)    // error
vec.splice(1, 1)  // error
```

------------------------------------------------------------------------

### Fixed-shape multidimensional arrays

Fixed-shape arrays use comma-separated dimensions inside one bracket
pair.

``` ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
```

More examples:

``` ts
let tensor: number[4, 4, 3]
let image: uint8[1080, 1920, 4]
```

Invalid syntax:

``` ts
let bad: number[[2, 3]]
// error
```

`number[2, 3]` is a rectangular shaped value. It is not the same as:

``` ts
Array<Array<number>>
```

`Array<Array<number>>` is a jagged/dynamic array of arrays.

------------------------------------------------------------------------

### Coordinate indexing

Yogi treats comma-separated index brackets as multidimensional
coordinate indexing.

``` ts
matrix[1, 2]
tensor[1, 0, 1]
image[y, x, 0]
```

This is not JavaScript comma operator behavior.

In JavaScript/TypeScript:

``` ts
array[1, 2, 0]
```

effectively means:

``` ts
array[0]
```

In Yogi:

``` ts
array[1, 2, 0]
```

means coordinate indexing with three indices.

For normal dynamic 1D arrays:

``` ts
let values: number[] = [1, 2, 3]

values[0, 1]
// error: number[] expects 1 index, got 2
```

------------------------------------------------------------------------

### Row-major lowering

Fixed-shape arrays lower as flat row-major storage.

``` ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
```

Conceptually:

``` txt
[1, 2, 3, 4, 5, 6]
```

For:

``` ts
matrix[1, 2]
```

the row-major offset is:

``` txt
offset = 1 * 3 + 2
offset = 5
```

For:

``` ts
let tensor: number[2, 2, 2]
tensor[1, 0, 1]
```

the strides are:

``` txt
shape = [2, 2, 2]
strides = [4, 2, 1]
offset = 1 * 4 + 0 * 2 + 1
offset = 5
```

------------------------------------------------------------------------

### Partial indexing, borrowed views, and escape materialization

Full indexing consumes all dimensions and returns an element.

``` ts
let value: number = matrix[1, 2]
```

Partial indexing consumes only some dimensions and produces a shaped
value.

``` ts
let row: number[3] = matrix[1]
```

When the result is used locally and safely, `matrix[1]` should be a
borrowed view. It should not copy elements.

``` ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

row[2] = 99

print(matrix[1, 2]) // 99
```

`row` is a borrowed view into `matrix`, not a copy.

Conceptually:

``` txt
matrix storage:
[1, 2, 3, 4, 5, 6]
          ^
          row starts here
```

When a borrowed view escapes, the compiler must keep the program safe
without changing observable aliasing semantics.

Therefore, the design rule is:

``` txt
Yogi borrows partial array views locally.
If a borrowed view escapes and a copy is semantically equivalent, the compiler materializes owned storage automatically.
`.copy()` remains available when the user explicitly wants independent storage at a specific point.
```

Meaning:

``` txt
local partial indexing                        -> borrowed view when safe
partial indexing escaping local owner         -> automatic safe materialization when aliasing is not observable
escaping view where aliasing must be preserved -> owner promotion/lifetime extension
explicit .copy()                              -> owned copy requested by the programmer
```

Example:

``` ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1]
}
```

This should be allowed in Yogi.

The compiler materializes the returned row before `matrix` is cleaned up.

Rationale:

``` txt
For ordinary escaping owned values:
    Yogi may promote/move the value as needed.

For borrowed array views escaping a local owner:
    Yogi should materialize or promote storage when it can preserve behavior.

For explicit owned copies:
    use .copy().
```

Why not automatically promote the array owner in this case?

``` ts
function getRow(): number[1000] {
    let matrix: number[1000, 1000] = loadBigMatrix()
    return matrix[0]
}
```

If Yogi promoted the owner, returning one row could keep the entire
matrix alive. That may be surprising and expensive. When aliasing is no
longer observable, Yogi prefers safe region materialization instead of
forcing the whole owner to heap storage.

------------------------------------------------------------------------

### Explicit copy

Borrowed views are efficient by default for local use.

Explicit copy should create owned storage.

``` ts
let row: number[3] = matrix[1]
// borrowed view when local and safe

let copy: number[3] = matrix[1].copy()
// owned copy
```

Example:

``` ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let copy: number[3] = matrix[1].copy()

copy[2] = 99

print(matrix[1, 2]) // 6
```

------------------------------------------------------------------------

### Const / readonly propagation

Borrowed views must inherit mutability from their source.

Mutable owner:

``` ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

row[2] = 99 // OK
```

Readonly owner:

``` ts
const matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

print(row[2]) // OK

row[2] = 99
// error: cannot mutate borrowed view from readonly source 'matrix'
```

Important rule:

``` txt
The mutability of the view's storage comes from the owner, not from the local binding.
```

This means `let row = matrix[1]` does not make readonly borrowed storage
mutable.

Nested views must preserve readonly:

``` ts
const image: number[2, 2, 3] = [
    [
        [1, 2, 3],
        [4, 5, 6]
    ],
    [
        [7, 8, 9],
        [10, 11, 12]
    ]
]

let row: number[2, 3] = image[1]
let pixel: number[3] = row[0]

pixel[1] = 88
// error
```

Readonly flow:

``` txt
image readonly -> row readonly -> pixel readonly
```

------------------------------------------------------------------------

### Union element arrays

Arrays can use union types as element types.

``` ts
let values: (int | string)[3] = [1, "two", 3]
```

This means:

``` txt
exactly 3 elements
each slot accepts int or string
```

Valid:

``` ts
let a: (int | string)[3] = [1, 2, 3]
let b: (int | string)[3] = ["a", "b", "c"]
let c: (int | string)[3] = [1, "b", "c"]
```

Invalid:

``` ts
let bad: (int | string)[3] = [1, "a", true]
// error: boolean is not assignable to int | string
```

Union arrays are different from tuples.

``` ts
let a: (int | string)[3]
```

Each slot accepts `int | string`.

``` ts
let b: [int, string, string]
```

Position-specific tuple type:

``` txt
position 0: int
position 1: string
position 2: string
```

------------------------------------------------------------------------

## Supported Now

### Array declarations and literals

-   Array literals.
-   Explicit `T[]` declarations.
-   Tuple literals.
-   Explicit tuple declarations.
-   Fixed-size one-dimensional arrays.
-   Fixed-shape multidimensional arrays.

Examples:

``` ts
let values: number[] = [1, 2, 3]
let vec: number[3] = [10, 20, 30]
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let pair: [number, string] = [1, "one"]
```

------------------------------------------------------------------------

### Fixed-size 1D arrays

Supported:

``` ts
number[3]
```

Working behavior:

-   Exact literal length validation.
-   Strict bracket indexing.
-   Constant out-of-bounds detection.
-   Runtime range checks where needed.
-   Size-changing methods rejected.

Example:

``` ts
let vec: number[3] = [10, 20, 30]

vec[2] // OK
vec[3] // compile-time/range error where possible
vec.push(40) // error
```

------------------------------------------------------------------------

### Fixed-shape multidimensional arrays

Supported:

``` ts
number[2, 3]
number[4, 4, 3]
```

Working behavior:

-   Rectangular literal validation.
-   Coordinate indexing with `matrix[i, j]`.
-   Partial indexing such as `matrix[i]` with shaped result type.
-   Multidimensional assignment.
-   Partial slice assignment such as `matrix[i] = row`.
-   Dynamic indices keep runtime bounds checks.

Example:

``` ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

print(matrix[1, 2]) // 6

matrix[0, 1] = 99

print(matrix[0, 1]) // 99
```

------------------------------------------------------------------------

### Borrowed views for partial fixed-shape indexing

Supported:

``` ts
let row: number[3] = matrix[1]
```

Current behavior:

-   `matrix[1]` creates a borrowed descriptor with
    `yogi_array_view(source, baseOffset, length)`.
-   Partial indexing does not copy elements for safe local use.
-   Mutating through the view mutates the original storage.
-   3D views work.
-   Dynamic partial indices keep runtime bounds checks.
-   Returning a partial view from a local fixed-shape owner materializes
    owned storage when that preserves observable behavior.
-   Storing a local borrowed view into module/global storage, a
    retaining call, or an aggregate member materializes when copying is
    behavior-preserving.
-   If aliasing remains observable after the escape, Yogi promotes the
    source owner and retains it through the escaped view.
-   Escaping object and array literals recursively preserve borrowed
    views inside their graph when later writes must remain observable.
-   Immediate inline callbacks can capture borrowed views and store them
    into module/global storage without dangling the source owner.
-   `.copy()` creates an owned copy for users who want independent
    storage.

Example local borrowed view:

``` ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

row[2] = 99

print(matrix[1, 2]) // 99
```

Fixed-shape slice assignment:

``` ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let row: number[3] = [7, 8, 9]

matrix[0] = row

print(matrix[0, 2]) // 9
```

Current behavior:

-   The target slice start is computed with row-major shape math.
-   The RHS array/view is copied element-by-element into the target
    slice.
-   `matrix[0] = row`, `image[1] = block`, and
    `image[0, 1] = pixel` update the original fixed-shape owner.
-   Shape mismatches are rejected before LLVM lowering.

Example escaping automatic materialization:

``` ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1]
}
```

------------------------------------------------------------------------

### SIR/FBS metadata

Supported:

-   FlatBuffers shape metadata through `TypeRef.fixed`.
-   FlatBuffers shape metadata through `TypeRef.shape`.
-   Element access preserves multiple indices.
-   `value[i, j, k]` travels through the compiler as Yogi
    multidimensional indexing, not as a JavaScript comma expression.

------------------------------------------------------------------------

### LLVM lowering

Supported:

-   Fixed-shape literals lower as flat row-major descriptor storage.
-   Row-major offset calculation for reads.
-   Row-major offset calculation for writes.
-   Row-major partial-slice assignment copies the RHS array/view into
    the existing target slice.
-   IR checks confirm fixed 2D lowering as flat descriptor storage.
-   IR uses `array.shape.*` blocks/markers for shaped lowering paths.

Current limitation:

-   Fixed-shape arrays are row-major and rectangular, but still
    runtime-descriptor backed.
-   Full native fixed-shape ABI without runtime descriptors is future
    work.

------------------------------------------------------------------------

### Index access

Supported:

``` ts
scores[0]
matrix[1, 2]
tensor[1, 0, 1]
```

`value[i, j, k]` is multidimensional indexing in Yogi. It is not the
JavaScript comma operator inside brackets.

------------------------------------------------------------------------

### Array element return unboxing for primitive contexts

Supported:

``` ts
scores.at(0)
scores.pop()
scores.shift()
scores.find(callback)
```

Notes:

-   `find`, `at`, `pop`, and `shift` return `T | undefined`.
-   They can unbox into primitive contexts that explicitly expect `T`.
-   They can remain boxed when a variable explicitly stores the union.

------------------------------------------------------------------------

### Readonly length

Supported:

-   Readonly length on arrays.
-   Readonly length on tuples.

------------------------------------------------------------------------

### Mutating methods

Supported on dynamic arrays where semantically valid:

``` txt
push
pop
shift
unshift
reverse
```

Copy/mutation methods:

``` txt
fill
copyWithin
splice
sort
```

Comparator overloads:

``` txt
sort(compareFn)
toSorted(compareFn)
```

Notes:

-   `sort()` and `toSorted()` support JavaScript-style default string
    ordering.
-   Comparator callbacks returning `number` are supported.
-   Size-changing methods are rejected on fixed arrays.

------------------------------------------------------------------------

### Non-mutating methods

Supported:

``` txt
at
concat
includes
indexOf
join
toLocaleString
lastIndexOf
slice
toString
toReversed
toSpliced
toSorted
with
flat
keys
values
entries
```

Notes:

-   `with` uses runtime range diagnostics.
-   Future range-sensitive APIs should reuse the same Yogi runtime range
    error path unless Yogi later adds catchable exceptions.
-   `flat(depth)` honors the runtime depth argument.
-   Semantic typing currently flattens one known static level.

------------------------------------------------------------------------

### Recursive aggregate printing

Supported:

-   Arrays containing arrays.
-   Arrays containing primitive values.

Pending:

-   Object stringification inside arrays.
-   Primitive and nested array elements are stringified.
-   Object display should wait for object runtime formatting.

------------------------------------------------------------------------

### Callback methods with named function references

Supported:

``` txt
forEach
map
filter
find
findIndex
findLast
findLastIndex
some
every
reduce
reduceRight
flatMap
```

------------------------------------------------------------------------

### Callback methods with expression-bodied inline arrows

Supported:

``` ts
(value: T): U => expression
(value: T, index: number): U => expression
```

------------------------------------------------------------------------

### Callback methods with block-bodied inline arrows

Supported:

``` ts
(value: T): U => {
    let next: U = expression
    return next
}
```

Supported inside block-bodied inline arrows:

-   Sequential local declarations.
-   Assignments.
-   Calls.
-   Explicit return.

Notes:

-   Inline callbacks currently lower inside the array loop.
-   Immediate captures are supported because the callback does not escape.
-   Persistent function values are rejected until Yogi has closure/lifetime
    rules for captured locals.

------------------------------------------------------------------------

### Array callback ownership and borrow policy

Supported:

-   Callback value parameters are temporary value/borrow inputs.
-   Callback value parameters are not mutable borrows of the source slot.
-   Returning an aggregate from `map`, `flatMap`, or `reduce` transfers that
    aggregate into the method result according to the normal Yogi ownership
    rules.
-   `reduce` and `reduceRight` materialize an independent owned accumulator
    from an explicit seed or from the first source element.
-   A named callback receives array, string, object, union, and `any`
    accumulator parameters by value. Each returned replacement becomes the
    next owner and the previous accumulator is destroyed exactly once.
-   Array, string, object/type-literal, and primitive-only struct accumulators
    are supported. Struct accumulators containing managed fields are rejected
    until field-level callback transfer is defined.
-   Inline callbacks cannot return an aggregate borrowed from the source
    element or a captured aggregate owner as the next accumulator.
-   Mutating a different captured array from inside a callback is allowed.
-   Mutating the source array while its callback method is running is rejected
    by semantic analysis.
-   The same source-mutation rule applies to `sort` and `toSorted`
    comparator callbacks.

Example safe callback:

``` ts
let source: number[] = [1, 2, 3]
let sink: number[] = []

source.forEach((value: number): void => {
    sink.push(value * 10)
})
```

Example aggregate return:

``` ts
let values: number[] = [1, 2]
let pairs: number[][] = values.map((value: number): number[] => {
    return [value, value + 10]
})
```

Rejected:

``` ts
let values: number[] = [1, 2]

values.forEach((value: number): void => {
    values.push(value)
})
```

Covered by:

``` txt
tests/runtime/sessions/02-variables-aggregates/array_callback_ownership_borrow.cmake
tests/runtime/sessions/02-variables-aggregates/array_reduce_aggregate_ownership.cmake
tests/programs/array_reduce_aggregate_report.cmake
```

------------------------------------------------------------------------

### Copy-producing array methods and native resources

The JavaScript copy-producing method family is supported for copyable array
elements:

``` txt
slice
concat
toSpliced
toReversed
toSorted
flat
with
map
filter
flatMap
```

These methods leave their source array unchanged and create a new array with
the same observable ordering, index, depth, comparator, and callback behavior
as their JavaScript counterparts.

Resource-owning struct elements are move-only. Yogi therefore rejects any of
these operations when it would shallow-copy an owned native pointer into a
second array:

``` ts
let copied: JobTicket[] = tickets.slice()       // error
let sorted: JobTicket[] = tickets.toSorted()    // error
let kept: JobTicket[] = tickets.filter(keepJob) // error
```

The diagnostic names the native resource fields and recommends a transfer
operation such as `splice`, `pop`, or `shift`. Yogi never silently aliases two
owners and does not invent a native clone operation.

Callbacks may still borrow resource-owning elements and produce copyable
results:

``` ts
let scores: number[] = tickets.map((ticket: JobTicket): number => ticket.score)
```

`map` and `flatMap` are rejected only when their result may retain aggregate or
pointer ownership borrowed from a resource-owning source. The LLVM backend
repeats the ownership check defensively so malformed SIR cannot create an
unsafe shallow copy.

Covered by:

``` txt
tests/programs/array_copying_methods.cmake
tests/programs/native_resource_array_ownership.cmake
```

------------------------------------------------------------------------

## Historical Array Design Notes

Some subsections below were written before later array lots landed. Treat
them as design notes and examples; the final checklist near the end of
this document is the current status source.

### 1. Const / readonly propagation into borrowed views

Borrowed views must inherit mutability from their source.

Mutable owner:

``` ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

row[2] = 99 // OK
```

Readonly owner:

``` ts
const matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

print(row[2]) // OK

row[2] = 99
// error: cannot mutate borrowed view from readonly source 'matrix'
```

------------------------------------------------------------------------

### 2. Nested readonly borrowed views

Readonly must propagate through nested borrowed views.

``` ts
const image: number[2, 2, 3] = [
    [
        [1, 2, 3],
        [4, 5, 6]
    ],
    [
        [7, 8, 9],
        [10, 11, 12]
    ]
]

let row: number[2, 3] = image[1]
let pixel: number[3] = row[0]

pixel[1] = 88
// error
```

------------------------------------------------------------------------

### 3. Explicit ownership for escaping borrowed array views

Current implementation rejects this:

``` ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1]
}
```

Required Yogi behavior:

``` txt
Materialize an owned row before the local owner is cleaned up.
```

Equivalent explicit copy:

``` ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1].copy()
}
```

------------------------------------------------------------------------

### 4. Explicit `.copy()` for owned slice/view copies

Borrowed views should be efficient by default.

Explicit copy should create owned storage.

``` ts
let row: number[3] = matrix[1]
// borrowed view

let copy: number[3] = matrix[1].copy()
// owned copy
```

------------------------------------------------------------------------

### 5. Spread operator for arrays

Implemented support:

``` ts
let a: number[] = [1, 2]
let b: number[] = [0, ...a, 3]
```

Strict type checking:

``` ts
let a: string[] = ["x", "y"]

let b: number[] = [1, ...a]
// error
```

Fixed arrays should only accept spread when the final length is known
and exact:

``` ts
let a: number[2] = [1, 2]

let b: number[3] = [0, ...a]
// OK
```

Invalid:

``` ts
let a: number[2] = [1, 2]

let b: number[4] = [0, ...a]
// error: expected 4 elements, got 3
```

Dynamic spread into fixed arrays should be rejected unless an explicit
runtime-checked conversion exists:

``` ts
let a: number[] = [1, 2]

let b: number[3] = [0, ...a]
// error
```

Spread should create a new array/copy, not a borrowed view.

------------------------------------------------------------------------

### Array destructuring and rest bindings

Array destructuring declarations are lowered to normal explicitly typed
bindings before semantic serialization.

``` ts
let values: number[] = [10, 20, 30, 40]
let [first, second, ...tail]: number[] = values

print(first)   // 10
print(second)  // 20
print(tail[0]) // 30
```

Rest bindings are implemented as `slice(index)` and therefore create a new
dynamic array for the remaining elements.

Tuple-rest annotations are also accepted:

``` ts
let [head, ...rest]: [number, ...number[]] = values
```

Rules:

``` txt
destructuring declarations still require an explicit type annotation
rest bindings must be the final binding in the pattern
rest bindings currently require an identifier name
array holes are allowed and skip the corresponding index
nested array/object binding patterns are supported for non-rest bindings
```

`for...of` destructuring uses the same expansion path:

``` ts
for (let [index, value]: [number, number] of values.entries()) {
    print(index + value)
}
```

------------------------------------------------------------------------

### 6. Spread length validation for fixed arrays

For fixed arrays:

``` ts
let a: number[2] = [1, 2]
let b: number[2] = [3, 4]

let c: number[4] = [...a, ...b]
// OK
```

Invalid:

``` ts
let c: number[5] = [...a, ...b]
// error: expected 5 elements, got 4
```

------------------------------------------------------------------------

### 7. Spread type checking for union/fixed/dynamic arrays

Union spread must respect declared element type.

``` ts
let a: (int | string)[2] = [1, "two"]

let b: (int | string)[3] = [0, ...a]
// OK
```

Invalid:

``` ts
let a: (int | string)[2] = [1, "two"]

let b: int[3] = [0, ...a]
// error: string may not be assignable to int
```

------------------------------------------------------------------------

### 8. Local capture / closure semantics for inline callbacks

Implemented for callbacks passed directly to array methods:

-   Inline callbacks can capture outer locals.
-   Captured borrowed views remain valid because the callback is lowered inside
    the current array loop and does not escape.
-   Escaping/persistent function expressions are rejected until Yogi has real
    closure environments and capture lifetime summaries.

------------------------------------------------------------------------

### 9. Depth-aware semantic result typing for `flat(depth)`

Current behavior:

-   `flat(depth)` honors runtime depth.
-   Semantic typing currently flattens one known static level.

Pending:

-   Depth-aware semantic result typing beyond the first static nesting
    level.
-   Stronger compile-time numeric literal evaluation.

------------------------------------------------------------------------

### 10. String element extraction from `string[]` inside struct fields

Known issue:

-   String element extraction from `string[]` through `.at()` when the
    array lives inside a struct field needs a focused array/string
    ownership lowering fix.
-   The field type and array length are valid.
-   Direct string extraction still needs focused lowering work.

------------------------------------------------------------------------

## Future Work

### 1. Owner promotion for escaping borrowed views

Normal syntax should remain enough for common code:

``` ts
function firstRow(matrix: number[2, 3]): number[3] {
    return matrix[0]
}
```

Purpose:

``` txt
Preserve observable aliasing when a copied materialized region would change program behavior.
```

Explicit borrowed/view types may still become an advanced feature later,
but they are not the default array lifetime model.

------------------------------------------------------------------------

### 2. Returned partial views from parameters

Normal array parameters use local/value semantics. Returning a partial
view from a parameter should materialize an owned copy before function
cleanup.

Example:

``` ts
function firstRow(matrix: number[2, 3]): number[3] {
    return matrix[0]
}
```

Current default semantics:

``` txt
return matrix[0]        -> owned copy when matrix is a normal parameter
return matrix[0].copy() -> owned copy
```

For explicit borrowed views, the compiler needs a summary:

``` txt
return borrows from parameter 0
```

------------------------------------------------------------------------

### 3. Escape analysis complete for borrowed views

Cases to analyze:

``` ts
globalRow = matrix[1]
return matrix[1]
closure = () => matrix[1]
external(matrix[1])
object.row = matrix[1]
```

Default rule for array partial views:

``` txt
If a borrowed array view escapes beyond a local owner:
    materialize owned storage when a copy preserves behavior
    promote/extend the owner when aliasing must remain observable
```

Advanced future rule for explicit view types:

``` txt
If an explicit borrowed view escapes beyond the owner:
    reject it unless lifetime rules prove it safe
```

------------------------------------------------------------------------

### 4. Cleanup / destructor rules for views

Borrowed views are non-owning.

Example:

``` ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]
```

Cleanup rule:

``` txt
row does not free matrix storage
matrix owns and frees storage if needed
```

Views should clean up only their descriptor metadata if required, never
the borrowed storage.

Owned materialized copies should clean up their own storage normally.

------------------------------------------------------------------------

### 5. Dynamic shaped arrays

Future syntax:

``` ts
let image: Array<uint8, 3> = loadImage("photo.png")
```

Meaning:

``` txt
rank = 3
dimensions known at runtime
```

Runtime descriptor:

``` txt
data pointer
rank
dims
strides
total length
capacity, if applicable
```

Example:

``` ts
let red: uint8 = image[y, x, 0]
```

Offset:

``` txt
offset = y * stride0 + x * stride1 + 0
```

------------------------------------------------------------------------

### 6. Dynamic shaped views/slices

For dynamic shaped arrays:

``` ts
let image: Array<uint8, 3> = loadImage("photo.png")

let pixel = image[y, x]
```

`pixel` should become a dynamic shaped borrowed view when used locally
and safely:

``` txt
rank = 1
dims = [channels]
base = image.base + offset
```

If such a view escapes from a local owner, the compiler should
materialize the escaped region when that preserves behavior. If
observable aliasing must be preserved, future owner promotion/lifetime
extension must handle it instead of silently changing behavior.

------------------------------------------------------------------------

### 7. Native fixed-shape ABI without runtime descriptor

Current state:

-   Fixed-shape arrays use flat row-major descriptor storage.

Future goal:

-   Full first-class contiguous native array ABI for fixed-shape arrays.
-   Avoid runtime descriptors where native flat representation is
    possible.

Examples:

``` txt
number[2, 3] -> [6 x double]
uint8[1080, 1920, 4] -> [8294400 x i8]
```

------------------------------------------------------------------------

### 8. C ABI interop rules for arrays

Current implemented rule:

``` txt
Yogi arrays never expose the internal runtime descriptor as native ABI.
ABI-safe numeric arrays, string arrays, and plain numeric struct arrays
are materialized as temporary native buffers.
```

Supported extern parameter shapes today:

``` ts
extern native from "./libnative.a" {
    sum(values: number[]): number              // double* + length
    normalize(values: ptr<number[]>): void     // double* + length, then copy back
    filter(values: number[4]): number          // double* + length
    transform(matrix: ptr<number[2, 3]>): void // double* + rows + columns, then copy back
    lookup(words: string[]): number            // const char** + length
    score(readings: Reading[]): number         // Reading* + length
    calibrate(readings: ptr<Reading[]>): void  // Reading* + length, then copy back
}
```

Dynamic `number[]` by value is a read-only borrowed native buffer.
Dynamic `string[]` by value is converted to a temporary `const char**`
plus length for the duration of the native call. The original Yogi
array and strings are never modified or replaced by this conversion.
Mutable native string arrays are intentionally not enabled yet. `ptr<string[]>`
requires an explicit ownership/free policy for native-produced replacement
strings before it can be implemented safely.
Plain numeric `Struct[]` behaves the same with a native C struct pointer.
`ptr<number[]>`, `ptr<number[N, M]>`, and `ptr<Struct[]>` are mutable borrowed native buffers.
After the native call returns, Yogi copies modified values back into the
existing Yogi array slots so pointer identity is preserved.

Struct array ABI is intentionally strict. A native ABI-safe struct must be a
real Yogi `struct` whose fields are all required `number` fields, in declaration
order. That maps to a C struct made of `double` fields in the same order.

Rejected shapes:

``` txt
ptr<string[]>
string[][]
number[][]
tuples across extern returns
array extern variables
struct arrays with `string`, array, optional, nested, boolean, or resource-owning fields
```

The backend currently materializes temporary native buffers for the C ABI.
That is an implementation detail, not a promise that every dynamic array is
stored as `T*` internally.

------------------------------------------------------------------------

### 9. Lazy iterator objects

Current state:

-   `for...of` works over arrays and array-producing iterator methods.
-   `keys`, `values`, and `entries` still materialize arrays.

Future goal:

-   Lazy iterator objects.

Pending because:

``` txt
Yogi does not have lazy iterator objects yet.
```

------------------------------------------------------------------------

### 10. Object stringification inside arrays

Current state:

-   Primitive array elements stringify.
-   Nested arrays stringify.

Future work:

-   Object display inside arrays should wait for object runtime
    formatting.

------------------------------------------------------------------------

### 11. Final JavaScript-Compatible Array Method Policy

Status: completed and covered by:

``` txt
tests/runtime/sessions/02-variables-aggregates/array_method_policy.cmake
```

Yogi keeps the JavaScript/TypeScript array method names, but applies strict
Yogi typing, ownership, readonly, fixed-size, and pointer-validity rules.

Covered receiver families:

``` txt
dynamic arrays
fixed arrays
fixed-shape arrays
borrowed views
readonly borrowed views
tuples
```

Supported dynamic-array method surface:

``` txt
at
concat
copy
copyWithin
entries
every
fill
filter
find
findIndex
findLast
findLastIndex
flat
flatMap
forEach
includes
indexOf
join
keys
lastIndexOf
map
pop
push
reduce
reduceRight
reverse
shift
slice
some
sort
splice
toLocaleString
toReversed
toSorted
toSpliced
toString
unshift
values
with
```

Strict policy:

``` txt
readonly arrays:
  allow non-mutating methods such as slice, toSorted, toReversed, keys, values
  reject mutating methods such as push, reverse, fill, sort, splice

const array bindings:
  reject mutating methods on the binding
  allow non-mutating copy-returning methods

fixed arrays:
  allow read/index/search/copy/iteration-style methods
  reject size-changing methods such as push, pop, shift, unshift, splice

tuples:
  reject mutating length/ordering methods
  keep tuple shape explicit

callbacks:
  require callable callbacks with explicit compatible parameter and return types
  reject boolean predicates that return non-boolean values
  reject comparators that do not return number

unsupported JavaScript proposals:
  reject explicitly with "array method '<name>' is not supported"
```

------------------------------------------------------------------------

### 12. Final diagnostics polish

Improve diagnostics for:

``` ts
let matrix: number[2, 3] = [
    [1, 2],
    [3, 4]
]
```

Preferred diagnostic:

``` txt
error: fixed-shape array 'number[2, 3]' expects dimension 1 length 3, got 2
```

For too many indices:

``` ts
matrix[1, 2, 3]
```

Preferred diagnostic:

``` txt
error: fixed-shape array 'number[2, 3]' expects at most 2 indices, got 3
```

For readonly borrowed mutation:

``` ts
const matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

row[2] = 99
```

Preferred diagnostic:

``` txt
error: cannot mutate borrowed view 'row' because it borrows from readonly source 'matrix'
```

For explicit copy diagnostics in optional perf/strict mode:

``` txt
note: copying partial array view creates an owned copy of number[1000]
```

------------------------------------------------------------------------

## Notes

Callback methods should wait until function values or callable
references are represented in semantic analysis and LLVM lowering. Named
function references and expression-bodied inline arrows are now
supported for the first callback batch.

Inline callbacks currently lower inside the array loop. Captures should
wait until Yogi has closure/lifetime rules for captured locals.

`find`, `at`, `pop`, and `shift` return `T | undefined`. They can now
unbox into primitive contexts that explicitly expect `T`, and they can
remain boxed when a variable explicitly stores the union.

`sort()` and `toSorted()` support JavaScript-style default string
ordering and comparator callbacks that return `number`.

`flat(depth)` honors the runtime depth argument. Semantic typing
currently flattens one known static level, which is correct for the
supported tests but should become depth-aware once Yogi has stronger
compile-time numeric literal evaluation.

`with` now uses runtime range diagnostics. Future range-sensitive APIs
should reuse the same Yogi runtime range error path unless Yogi later
adds catchable exceptions.

Yogi treats `value[i, j, k]` as multidimensional indexing. It is not the
JavaScript comma operator inside brackets.

Core design sentence:

``` txt
Yogi borrows partial array views locally and materializes escaping views automatically when a copy preserves behavior.
`.copy()` is explicit syntax for programmer-requested independent storage.
```

------------------------------------------------------------------------

## Implementation Checklist

### Completed

``` txt
✅ Dynamic 1D arrays: T[]
✅ Array literals and explicit T[] declarations
✅ Tuple literals and explicit tuple declarations
✅ Strict [] access
✅ Safe .at()
✅ Fixed 1D arrays: T[N]
✅ Fixed multidimensional arrays: T[N, M, K]
✅ Exact literal length/shape validation
✅ Resize methods rejected on fixed arrays
✅ Coordinate indexing: a[i, j, k]
✅ JavaScript comma operator disabled inside indexing
✅ FlatBuffers TypeRef.fixed metadata
✅ FlatBuffers TypeRef.shape metadata
✅ ElementAccessExpression preserves multiple indices
✅ Row-major flat LLVM lowering for fixed-shape arrays
✅ Multidimensional assignment
✅ Partial fixed-shape slice assignment
✅ Partial indexing type inference
✅ Partial indexing as borrowed views for safe local use
✅ Borrowed views mutate original owner
✅ Runtime bounds checks for dynamic indices
✅ Union element arrays
✅ Union element borrowed views
✅ Const/readonly propagation into borrowed views
✅ Nested readonly borrowed views
✅ Automatic materialization for fixed-shape borrowed views escaping through return/global assignment
✅ Automatic materialization for borrowed views escaping through retaining calls, aggregate member stores, and returned aggregate literals
✅ Owner promotion/lifetime extension for direct borrowed views escaping through storage/member stores
✅ Owner promotion through escaping nested object/array literal graphs
✅ Owner promotion through local object graph identifiers that escape later
✅ Captured borrowed views in immediate inline callbacks can escape safely to global storage
✅ Explicit .copy() for owned slice/view copies
✅ Array element return unboxing for primitive contexts
✅ Readonly length on arrays and tuples
✅ Recursive aggregate printing for arrays/nested arrays/primitives
✅ Named callback references for array methods
✅ Expression-bodied inline arrow callbacks
✅ Block-bodied inline arrow callbacks
✅ Comparator overloads for sort and toSorted
✅ Array spread in dynamic/fixed/tuple/union contexts
✅ Array destructuring declarations, holes, rest bindings, and for-of destructuring
✅ Local capture/closure semantics for immediate inline callbacks
✅ Persistent closure-captured borrowed views are rejected with semantic diagnostics until closure runtime exists
✅ Direct string extraction from struct-held string[] through provably in-bounds .at()
✅ Depth-aware semantic result typing for flat(depth)
✅ Borrow summaries interprocedural
✅ Core pointer type: ptr<T>
✅ Address-of expression: &value
✅ Pointer parameters
✅ Full fixed-shape array pointer indexing
✅ Dynamic 1D array pointer indexing through ptr<number[]>
✅ Address-of fixed-shape array cells: &matrix[i, j]
✅ Address-of dynamic array cells: &values[i]
✅ Pointer indexing read/write mutates caller storage
✅ Adaptive dynamic array storage selection: contiguous fast path vs pointer-safe chunked mode
✅ Extern native ABI rejects arrays/tuples by value
✅ Normal array parameters use local/value semantics
✅ Pointer partial views: ptr<number[2, 3]>[0] -> ptr<number[3]>
✅ Borrow summaries for ptr<T> parameter-derived returns
✅ Rejection for returning pointer views derived from local storage
✅ Rejection for conflicting pointer-return borrow roots
✅ General dereference syntax: *p read, scalar (*p) = value write-through
✅ Compile-time invalidated pointer diagnostics for obvious dynamic array slot removals
✅ Branch-sensitive invalidated pointer diagnostics for if/else and loops
✅ Function summaries record dynamic-array invalidation effects
✅ Normal T[] parameters do not invalidate caller pointers under current value semantics
✅ Mutating array methods through ptr<T[]>
✅ End-to-end caller invalidation through ptr<T[]> parameters
✅ ptr<T[]> readonly .length access
✅ for-of value/pointer iteration over ptr<T[]>
✅ Dynamic array iteration and structural mutation semantics
✅ Final JavaScript-compatible array method policy audit
✅ Final callback ownership/borrow semantics
✅ Nested dynamic-array ownership and pointer chains
```

### Next Lots

``` txt
✅ Automatic lifetime policy for existing fixed-shape views and dynamic T[] borrows
```

### Future Work

``` txt
⬜ Real persistent closure runtime for captured borrowed views
⬜ Borrow summaries interprocedural for explicit borrowed views
⬜ Escape analysis complete for borrowed views
⬜ Cleanup/destructor rules for escaped views, promoted owners, and safe materialization
⬜ Dynamic shaped arrays: Array<T, Rank>
⬜ Dynamic shaped views/slices
⬜ Native fixed-shape ABI without runtime descriptor
⬜ C ABI interop rules for arrays
⬜ Lazy iterator objects
⬜ Object stringification inside arrays
⬜ Serialize invalidation summaries for cross-module semantic imports if needed
⬜ Final diagnostics polish for shape/index/readonly/materialization errors
⬜ Documentation fully updated after each lot
```

------------------------------------------------------------------------

## Recommended Implementation Order

``` txt
1. Dynamic-rank Array<T, Rank> views and lifetime analysis
2. Real persistent closure runtime for captured borrowed views
3. Borrow summaries interprocedural for explicit borrowed views if Yogi later adds explicit view types
4. Cleanup/destructor rules for promoted owners and materialized copies
5. Dynamic shaped arrays: Array<T, Rank>
6. Dynamic shaped views/slices
7. Native fixed-shape ABI without runtime descriptor
8. C ABI interop rules for arrays
9. Lazy iterator objects
10. Object stringification inside arrays
11. Final diagnostics polish
12. Documentation final pass
```

------------------------------------------------------------------------

# 2026 Consolidated Array Update

> This section updates and consolidates the current array implementation
> state. It should be read together with the design sections above.
> Where an older TODO conflicts with this section, this current
> implementation status takes precedence.

## Current Array Model

Yogi arrays are a full language subsystem rather than a single feature:

``` ts
T[]          // dynamic 1D array
T[N]         // fixed-size 1D array
T[N, M]      // fixed-shape 2D array
T[N, M, K]   // fixed-shape multidimensional array
```

The current design keeps the TypeScript/JavaScript familiarity of normal
array syntax while allowing Yogi to make lower-level storage, ownership,
pointer-safety, and optimization decisions automatically.

The user should not need separate source-level types such as `Vector`,
`StableArray`, or `ChunkedArray` merely to obtain safe pointer behavior.

------------------------------------------------------------------------

## Dynamic Array Storage Model

Dynamic arrays use an adaptive internal representation.

Conceptually:

``` txt
contiguous_fast_path
pointer_safe_chunked_mode
```

The goal is:

``` txt
Use contiguous storage when it is safe and profitable.
Use pointer-safe stable-slot storage when interior pointer identity must survive.
Keep the storage decision internal to the compiler/runtime.
```

### Semantic storage selection

Semantic analysis can select pointer-safe storage when program behavior
makes stable interior addresses necessary.

### Lazy runtime promotion

An array may still begin in the contiguous fast path and later require
stable interior pointer identity.

When an interior pointer is requested, the runtime can lazily promote:

``` txt
contiguous_fast_path
        |
        | interior pointer requires stable slot identity
        v
pointer_safe_chunked_mode
```

`ArrayValue::pointerCell()` performs the lazy promotion when necessary.

Pointers created through views/slices delegate to the real source array
so provenance, range checks, and slot identity remain attached to the
actual owner.

This gives Yogi two complementary layers:

``` txt
semantic analysis -> choose the best storage early when possible
runtime promotion -> safely adapt when the need appears later
```

------------------------------------------------------------------------

## Dynamic Array Slot Identity

Pointers into pointer-safe dynamic arrays track element slot identity
rather than permanently tracking a logical index number.

Core rule:

``` txt
If the slot survives, the pointer survives.
If the slot is removed, the pointer becomes invalid.
If the slot value is overwritten, the pointer remains valid and observes the new value.
```

Example:

``` ts
let users: User[] = [
    { age: 20 },
    { age: 30 }
]

let age: ptr<number> = &users[1].age

users.shift()

age = 99
```

The original second element survives `shift()` and becomes logical index
`0`. The pointer remains attached to that surviving slot.

### Projected pointers

Supported examples include:

``` ts
let user: ptr<User> = &users[0]
let age: ptr<number> = &users[0].age
let zip: ptr<number> = &users[0].address.zip
```

Projected pointers preserve owner provenance through the dynamic array
cell.

Relevant runtime/lowering operations include:

``` txt
yogi_array_pointer_cell
yogi_project_cell
yogi_pointer_cell_get
yogi_pointer_cell_set
```

------------------------------------------------------------------------

## Structural Mutation Semantics

Yogi does not reject a normal dynamic-array operation merely because a
pointer exists.

The operation is allowed. Pointer validity depends on whether the target
slot survives.

### `push`

``` txt
Existing slots survive.
New slots are appended.
Pointers to existing slots remain valid.
```

### `pop`

``` txt
The last slot is removed.
Pointers to the removed slot become invalid.
Pointers to surviving slots remain valid.
```

### `shift`

``` txt
The first slot is removed.
Pointers to that removed slot become invalid.
Other slot identities survive even though logical indices change.
```

### `unshift`

``` txt
New slots are inserted at the front.
Existing slot identities survive.
Pointers to existing elements remain valid.
Resource-owning struct arguments transfer ownership into the array.
Multiple arguments are evaluated left-to-right and retain their source order.
```

### `splice`

``` txt
Removed slots are invalidated.
Surviving slots preserve identity.
Inserted values receive new slots.
Resource-owning inserted values transfer ownership into the source array.
When removal and insertion happen together, removed resources move to the
returned array while inserted resources move into the source array.
```

### `reverse` and `sort`

``` txt
Logical order changes.
Slot identity is preserved.
Pointers continue to target the same element slot.
```

### `fill` and `copyWithin`

``` txt
Slots remain alive.
Values may be overwritten.
Pointers remain valid and observe the resulting value.
```

------------------------------------------------------------------------

## Whole Dynamic Array Assignment

Assigning a new value to an existing dynamic array is implemented as
value-semantic copy followed by in-place replacement of the target slots.

Example:

``` ts
users = newUsers
```

Conceptually:

``` txt
ownedCopy = copy(newUsers)
oldLen = users.length
newLen = ownedCopy.length
commonLen = min(oldLen, newLen)

common slots:
    preserve target slot identity
    overwrite values from ownedCopy

newLen > oldLen:
    create new slots

newLen < oldLen:
    invalidate removed trailing slots

newUsers:
    remains alive and unchanged
```

Runtime support includes:

``` txt
ArrayValue::replaceFrom(...)          // non-consuming copy
ArrayValue::moveReplaceFrom(...)      // compiler-internal temporary transfer
yogi_array_replace_from               // non-consuming ABI
yogi_array_move_replace_from          // internal consuming ABI
```

Example:

``` ts
let users: User[] = [
    { age: 20 },
    { age: 30 }
]

let age: ptr<number> = &users[0].age

users = [
    { age: 99 },
    { age: 100 },
    { age: 200 }
]

age = 50

print(users[0].age) // 50
```

Slot `0` survived, so the pointer survived and observes the replacement
value. A pointer into `newUsers` remains attached to `newUsers`; assignment
does not retarget it and does not empty its source array.

If a shorter replacement removes the target slot, the pointer becomes
invalid.

------------------------------------------------------------------------

## Runtime Pointer Validity

Dynamic-array pointer safety does not require a garbage collector or a
background pointer scanner.

The runtime tracks validity through pointer-aware slot/cell metadata.

A removed element payload can be destroyed normally while its pointer
identity is marked invalid.

When a pointer-cell path is later read or written, runtime validation
protects cases that semantic analysis could not prove in advance.

This is the fallback safety layer for dynamic control flow and unknown
indices.

------------------------------------------------------------------------

## Compile-Time Pointer Invalidation

Semantic analysis detects invalid pointer use when removal is provable.

Example:

``` ts
let age: ptr<number> = &users[0].age

users.shift()

age = 99
```

The diagnostic occurs at the later use of `age`, not at `shift()`.

Design rule:

``` txt
Wrong:
    reject shift() because a pointer exists

Yogi:
    allow shift()
    diagnose later use if the target slot was removed
```

Provable invalidation currently covers relevant cases involving:

``` txt
pop
shift
splice
shorter whole-array replacement
```

Additional behavior:

``` txt
pointer copies preserve invalidation state
pointer rebind replaces the previous provenance/invalidation state
dynamic/unprovable cases remain protected by runtime checks
```

------------------------------------------------------------------------

## Branch-Sensitive Invalidation

Pointer validity analysis is control-flow sensitive.

For:

``` ts
let age: ptr<number> = &users[0].age

if condition {
    users.shift()
}

age = 99
```

the pointer may be invalid after the branch.

Semantic analysis snapshots, restores, and merges:

``` txt
pointer provenance
pointer invalidation state
known dynamic-array lengths
```

Merge behavior:

``` txt
valid on all continuing paths       -> valid
invalid on all continuing paths     -> invalid
valid on some, invalid on others    -> maybe invalid
different/unprovable array lengths  -> unknown or runtime fallback
```

A path ending in `return` does not contaminate the state of continuing
paths.

A pointer rebound to a valid target before merge uses the new
provenance.

Current control-flow support includes:

``` txt
if/else
while
for
```

------------------------------------------------------------------------

## Function Summary Propagation

Function summaries record dynamic-array invalidation effects so caller
analysis can reason across function boundaries.

Normal `T[]` parameters keep Yogi's current local/value semantics and do
not automatically invalidate caller pointers.

Pointer-based array parameters such as `ptr<T[]>` can mutate caller
storage, and their summaries propagate corresponding invalidation
effects.

`ptr<T[]>` also exposes readonly `.length`, so loops can inspect the
current caller-owned array descriptor without trying to read a struct
field from the pointee.

Example conceptually:

``` ts
function removeFirst(users: ptr<User[]>): void {
    users.shift()
}
```

Pointer array parameters support both value and pointer iteration:

``` ts
function scan(users: ptr<User[]>): void {
    for (let user: User of users) {
        print(user.score)
    }
}

function mutate(users: ptr<User[]>): void {
    for (let user: ptr<User> of users) {
        user.score = user.score + 1
    }
}
```

A caller with a pointer into the same array can receive the callee's
invalidation effect through provenance-aware summary propagation.

This completes the main dynamic-array pointer-validity pipeline:

``` txt
adaptive storage selection
        +
lazy runtime promotion
        +
stable slot identity
        +
runtime validity checks
        +
local semantic invalidation
        +
branch-sensitive merging
        +
function-summary propagation
```

------------------------------------------------------------------------

## Dynamic Array Pointer Validity Status

The core **Dynamic Array Pointer Validity** feature block is
implemented.

``` txt
✅ adaptive contiguous vs pointer-safe storage
✅ semantic storage selection
✅ lazy contiguous -> pointer-safe runtime promotion
✅ stable slot identity
✅ pointer-safe growth
✅ removed-slot invalidation
✅ reorder operations preserve identity
✅ projected pointers through dynamic array cells
✅ whole-array assignment as in-place slot replacement
✅ nested dynamic-array pointer chains
✅ runtime invalid-pointer detection
✅ compile-time diagnostics for provable invalidation
✅ branch-sensitive invalidation merging
✅ function-summary propagation for pointer-based caller mutation
```

This closes that feature block, but it does **not** mean the entire
array subsystem is complete.

------------------------------------------------------------------------

# Consolidated Current Support

## Core syntax and types

``` txt
✅ Dynamic arrays: T[]
✅ Fixed arrays: T[N]
✅ Fixed multidimensional arrays: T[N, M, K]
✅ Tuple literals and explicit tuple declarations
✅ Array literals
✅ Strict bracket indexing
✅ Safe .at()
✅ Readonly length
```

## Fixed arrays and matrices

``` txt
✅ Exact fixed-length validation
✅ Exact rectangular shape validation
✅ Resize methods rejected on fixed arrays
✅ Coordinate indexing: a[i, j, k]
✅ Multiple indices preserved through compiler IR/SIR
✅ Row-major flat lowering
✅ Multidimensional reads and writes
✅ Partial indexing
✅ Runtime bounds checks for dynamic indices
```

## Borrowed views

``` txt
✅ Partial fixed-shape indexing can produce borrowed views
✅ Local borrowed views do not copy elements
✅ Mutation through mutable views affects the original owner
✅ Readonly propagation from owner to borrowed view
✅ Nested readonly propagation
✅ Returning a local borrowed view materializes owned storage when safe
✅ .copy() creates owned storage
✅ Pointer partial views
✅ Borrow summaries for pointer-derived returns
```

## Union arrays

``` txt
✅ Union element arrays
✅ Fixed union arrays
✅ Union element borrowed views
```

## Array methods currently supported

### Mutating

``` txt
push
pop
shift
unshift
reverse
fill
copyWithin
splice
sort
```

### Non-mutating / copying / lookup

``` txt
at
concat
includes
indexOf
join
toLocaleString
lastIndexOf
slice
toString
toReversed
toSpliced
toSorted
with
flat
keys
values
entries
```

### Callback methods

``` txt
forEach
map
filter
find
findIndex
findLast
findLastIndex
some
every
reduce
reduceRight
flatMap
```

### Callback forms

``` txt
✅ named function references
✅ expression-bodied inline arrows
✅ block-bodied inline arrows
✅ immediate local capture/closure semantics
✅ comparator callbacks for sort/toSorted
```

## Spread

``` txt
✅ dynamic array spread
✅ fixed array spread
✅ tuple spread
✅ union-compatible spread
```

## Printing

``` txt
✅ primitive array elements
✅ nested arrays
⬜ object stringification inside arrays
```

## Pointer integration

``` txt
✅ ptr<T>
✅ &value
✅ pointer parameters
✅ fixed-shape pointer indexing
✅ dynamic array pointer indexing
✅ &matrix[i, j]
✅ &values[i]
✅ &users[0].field
✅ &users[0].nested.field
✅ pointer read/write mutates caller storage when provenance permits
✅ *p read
✅ (*p) = value write-through
```

------------------------------------------------------------------------

# Remaining Array Roadmap

Arrays remain one of Yogi's largest subsystems. Future work should be
split into focused lots.

## Completed: String extraction through struct-held `string[]`

Yogi can now narrow `.at()` on a `string[]` field when the field's literal
length is known through a struct/object path:

```ts
struct Playlist {
    songs: string[]
}

let playlist: Playlist = { songs: ["intro", "outro"] }
let first: string = playlist.songs.at(0)
```

Out-of-range literal indexes and dynamic indexes still return
`string | undefined`, so direct assignment to `string` is rejected unless the
program narrows or casts explicitly.

------------------------------------------------------------------------

## Completed: Dynamic Array Iteration and Structural Mutation

Dynamic-array `for...of` now has defined behavior when the iterated array is
structurally modified during the loop.

Yogi uses two lowering paths:

``` txt
no possible structural mutation -> fast indexed iteration
possible structural mutation    -> stable slot-identity iteration
```

The stable path records the original slot identities at loop entry. Appended
slots are not visited by the current loop, removed planned slots are skipped,
and surviving planned slots remain visible even if `shift`, `splice`, `sort`,
`reverse`, or whole-array assignment changes the logical indexes.

Examples:

``` ts
for (let user: User of users) {
    users.push({ age: 50 })
}
```

``` ts
for (let user: User of users) {
    users.shift()
}
```

Cleanup is compiler-owned. Stable iteration plans are registered as runtime
cleanup resources, so `break`, `continue`, normal fallthrough, and early
`return` paths all destroy the plan exactly once.

Covered by:

``` txt
tests/runtime/sessions/04-control-flow/dynamic_array_iteration_mutation.cmake
```

------------------------------------------------------------------------

## Completed: Final JavaScript-Compatible Array Method Policy

Yogi keeps JavaScript/TypeScript array method names, but the semantics remain
strict and ahead-of-time friendly.

Covered method families:

``` txt
mutating methods:
  push, pop, shift, unshift, reverse, fill, copyWithin, sort, splice

copy-returning methods:
  copy, concat, slice, toReversed, toSorted, toSpliced, with, flat

search/string/iterator methods:
  at, includes, indexOf, lastIndexOf, join, toString, toLocaleString,
  keys, values, entries

callback methods:
  forEach, map, filter, some, every, find, findIndex, findLast,
  findLastIndex, reduce, reduceRight, flatMap
```

Policy tests cover:

``` txt
runtime execution for the supported method surface
LLVM IR calls for the runtime-backed method families
readonly and const mutation rejection
fixed-size array size-change rejection
tuple mutation rejection
strict callback/comparator diagnostics
strict search/join/flat argument diagnostics
unsupported method diagnostics
```

Covered by:

``` txt
tests/runtime/sessions/02-variables-aggregates/array_method_policy.cmake
```

------------------------------------------------------------------------

## 4. Array Callback Ownership and Borrow Semantics

Implemented.

Example:

``` ts
let source: number[] = [1, 2, 3]
let sink: number[] = []

source.forEach((value: number): void => {
    sink.push(value * 10)
})
```

Policy:

``` txt
callback value parameter = temporary value/borrow input
callback value parameter != mutable borrow of the source slot
returned aggregate from map/flatMap/reduce = owned by the method result
different captured array mutation = allowed
source array mutation during callback = semantic error
```

Rejected:

``` ts
let values: number[] = [1, 2]

values.forEach((value: number): void => {
    values.push(value)
})
```

------------------------------------------------------------------------

## 5. Nested Dynamic Arrays and Owner Chains

Audit cases such as:

``` ts
let matrix: number[][] = [
    [1, 2],
    [3, 4]
]

let p: ptr<number> = &matrix[0][1]
```

Cover:

``` txt
outer-slot removal
inner-array mutation
inner-array replacement
nested pointer provenance
nested invalidation
copy/move behavior
escape analysis across owner chains
```

------------------------------------------------------------------------

## 6. Fixed Arrays and Multidimensional Matrix Completion

Continue the fixed-array path for:

``` ts
T[N]
T[N, M]
T[N, M, K]
```

Remaining areas include:

``` txt
final iteration semantics
equality/identity policy
native layout guarantees
ABI behavior
large fixed-shape values
vectorization opportunities
compile-time bounds elimination
```

------------------------------------------------------------------------

## 7. Automatic Array View Escape and Lifetime Analysis

The partial-indexing borrowed-view model exists. The remaining work is
to make escaping views automatic without introducing explicit `borrowed`
or `view` syntax.

Core philosophy:

``` txt
The user keeps writing normal array types.

Partial indexing may produce an aliasing view internally.

If the view remains local, Yogi can use a lightweight borrowed descriptor.

If the view escapes, Escape Analysis must extend the lifetime of the required storage automatically.

The compiler may promote the owner or safely materialize only the required region when doing so preserves observable aliasing semantics.

Readonly and mutability permissions propagate from the original storage.

No explicit borrowed/view type is required.
No mandatory .copy() is required merely because a view escapes.
```

Examples:

``` ts
let row: number[3] = matrix[1]
```

`row` may remain a lightweight aliasing view while `matrix` is still
observable.

``` ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1]
}
```

The returned value keeps the normal `number[3]` syntax. Escape Analysis
must preserve the required storage automatically.

The implementation may choose between:

``` txt
owner/storage promotion
safe region materialization
```

but only when the chosen representation preserves the observable
semantics of the program.

Cover:

``` txt
view of view
nested views
returning views
passing views to functions
views stored inside structs
views assigned to globals
view escape analysis
automatic owner/storage lifetime extension
owner promotion
safe region materialization
source lifetime
owner-aware descriptors
owner movement/relocation
cleanup/destructor behavior
readonly propagation
alias preservation
escape through aggregate fields
interprocedural provenance propagation
```

Important semantic rule:

``` txt
If aliasing is still observable, the compiler must preserve aliasing.

The compiler must not silently materialize a copy when doing so would change program behavior.
```

`.copy()` may remain as an explicit operation when the developer
intentionally wants independent storage, but it must not be required as
the primary mechanism for making an escaping view safe.

## 8. Array Copy, Move, Assignment, and Ownership

Whole dynamic-array assignment already preserves target slot identity
through in-place replacement.

A broader ownership audit should cover:

``` txt
copy construction
move construction
assignment
self-assignment
function arguments
function returns
globals
exports
aggregate fields
resources stored inside elements
destruction of replaced values
```

------------------------------------------------------------------------

## 9. Union Array Runtime and Narrowing

Further audit:

``` txt
runtime representation/tagging
pointer access to union elements
replacement of one union branch with another
destruction of previous branch
narrowing
callback methods
sorting/filtering
fixed union arrays
ABI behavior
```

------------------------------------------------------------------------

## 10. Rest and Destructuring

Implemented:

``` txt
array destructuring declarations
array holes in binding patterns
rest bindings lowered through slice(index)
tuple-rest annotations such as [number, ...number[]]
for-of destructuring through the same expansion path
```

Future syntax/semantic work can cover:

``` txt
ownership/copy behavior
fixed-length validation
dynamic-to-fixed restrictions
deeper rest binding patterns
```

------------------------------------------------------------------------

## 11. Native ABI and FFI

This is a major future area because pointer-safe chunked dynamic storage
is not automatically equivalent to a native contiguous `T*`.

Current implemented policy:

``` txt
extern native ABI supports ABI-safe numeric, string, and plain numeric struct array parameters
number[] passes as double* + length
string[] passes as temporary const char** + length
ptr<number[]> passes as double* + length with copy-back
number[N, M] passes as double* + dimensions
Struct[] passes as Struct* + length for plain numeric structs
array literals lower through yogi_array_create_with_storage
storage mode is explicit in IR: contiguous_fast_path or pointer_safe_chunked_mode
```

Still to define:

``` txt
ptr<string[]> ABI
native retention of pointers
ownership transfer
mutable string output/free contracts
length/capacity descriptors
struct arrays with resource-owning fields
```

------------------------------------------------------------------------

## 12. Bounds-Check Elimination and Optimization

Yogi should preserve strict indexing while eliminating redundant checks
when provable.

Example:

``` ts
for (let i: number = 0; i < values.length; i++) {
    total += values[i]
}
```

Optimization work:

``` txt
compile-time fixed-array bounds
loop range analysis
bounds-check elimination
check hoisting
row-major offset folding
contiguous specialization
vectorization
method inlining
redundant runtime pointer-validity check elimination
```

------------------------------------------------------------------------

## 13. Dynamic Shaped Arrays

Future rank-aware runtime-shaped arrays may use syntax such as:

``` ts
let image: Array<uint8, 3> = loadImage("photo.png")
```

Potential descriptor:

``` txt
storage
rank
dimensions
strides
total length
capacity where applicable
```

This remains separate from fixed-shape arrays such as:

``` ts
uint8[1080, 1920, 4]
```

------------------------------------------------------------------------

## 14. Lazy Iterator Objects

Current `keys`, `values`, and `entries` materialize arrays.

Future work:

``` txt
lazy iterator objects
iterator lifetime
mutation during lazy iteration
for..of integration
iterator invalidation
```

------------------------------------------------------------------------

## 15. Formatting and Diagnostics

Finish:

``` txt
object stringification inside arrays
shape mismatch diagnostics
too-many-indices diagnostics
readonly-view mutation diagnostics
pointer invalidation diagnostic presentation
materialization/copy diagnostics where useful
```

------------------------------------------------------------------------

## 16. Concurrency and Shared Mutation

This should wait for Yogi's threading/concurrency model.

Future questions:

``` txt
shared dynamic arrays
cross-thread ownership transfer
pointer validity under concurrent structural mutation
synchronization
data-race rules
atomic slot state if required
```

------------------------------------------------------------------------

# Updated View and Lifetime Design Decision

The roadmap no longer treats explicit borrowed return/view types as the
preferred direction.

Yogi should keep normal array syntax and resolve view lifetime
automatically:

``` txt
normal array syntax
        +
provenance tracking
        +
Escape Analysis
        +
automatic owner/storage lifetime extension
        +
owner promotion or safe materialization when necessary
```

The language should not force developers to introduce special `borrowed`
or `view` types merely to return, store, or escape an array view.

Likewise, `.copy()` must not be required as the default escape
mechanism. An explicit copy operation may still exist when the developer
intentionally wants independent storage, but safety and lifetime
management should primarily be handled automatically by the compiler.

Core rule:

``` txt
If aliasing remains observable, preserve aliasing.

If the owner is no longer observable through another path, the compiler may choose the most efficient safe representation as long as program behavior is preserved.
```

Examples that should be handled through normal syntax and Escape
Analysis include:

``` txt
returning a partial array view
assigning a view to a global
storing a view inside a struct
passing a view through functions
nested views
owner promotion from stack to heap
safe region materialization when semantically equivalent
readonly propagation from the original owner
```

# Runtime Element Ownership Policy

Dynamic array descriptors are now self-contained for element ownership.
The descriptor travels with:

``` txt
whether elements are trivial or resource-owning
the element destroy callback
the element move callback, when a specialized move is required
an opaque callback context
a stable policy identity used for defensive compatibility checks
```

The compiler installs this policy when it creates or first populates a
resource-owning array. The policy remains attached when the descriptor is
moved, returned, passed through `ptr<T[]>`, stored in another aggregate, or
used across module boundaries.

``` ts
function removeFirst(items: ptr<JobTicket[]>): void {
    items.shift()
}
```

`removeFirst` borrows the array. It does not become its owner, and it does
not need a caller-local destructor table. `shift()` asks the runtime
descriptor how to move or destroy the removed element.

Structural operations follow one policy:

``` txt
push/unshift/splice insertion:
  move the incoming resource value into descriptor-owned storage

pop/shift/splice extraction:
  move removed ownership into the returned value/array

discarded pop/shift/splice result:
  destroy through the policy carried by the descriptor

array cleanup:
  destroy every still-active element exactly once through the descriptor
```

Views delegate ownership policy queries to their source descriptor.
`splice()` transfers the same policy to its returned removed-elements
array. Normal whole-array assignment first copies the source and then replaces
the target in place, preserving target slot behavior without consuming or
emptying the source. Compiler-internal operations may use the distinct
consuming replacement ABI only for proven owned temporaries.

Imported struct declarations are materialized as non-exported type
dependencies in the consumer SIR. This gives each LLVM module the field
layout required to box resource-owning elements and generate the policy
destroy thunk, while the runtime descriptor carries that thunk across
module calls.

The runtime rejects incompatible policy identities and refuses to clone a
resource-owning array defensively. These checks protect the frontend/runtime
contract; normal Yogi source continues to receive semantic diagnostics
before unsafe shallow copies reach LLVM.

The Program Test
`tests/programs/native_resource_array_pointer_policy.cmake` validates this
through multiple modules, `ptr<T[]>`, returns, nested aggregates,
reallocation stress, `if`, loops, `break`, `continue`, discarded results,
exact native resource counters, LLVM IR, object files, final linking, and
sanitizer execution when supported.

This runtime policy is type-erased and reusable for every concrete
resource-owning element type. User-facing generic function syntax is a
separate language feature and was not introduced by this lot.

------------------------------------------------------------------------

# Final Implementation Checklist

## Completed

``` txt
✅ Dynamic 1D arrays: T[]
✅ Array literals and explicit T[] declarations
✅ Tuple literals and explicit tuple declarations
✅ Strict [] access
✅ Safe .at()
✅ Fixed 1D arrays: T[N]
✅ Fixed multidimensional arrays: T[N, M, K]
✅ Exact literal length/shape validation
✅ Resize methods rejected on fixed arrays
✅ Coordinate indexing: a[i, j, k]
✅ JavaScript comma operator disabled inside indexing
✅ FlatBuffers TypeRef.fixed metadata
✅ FlatBuffers TypeRef.shape metadata
✅ Element access preserves multiple indices
✅ Row-major flat LLVM lowering for fixed-shape arrays
✅ Multidimensional assignment
✅ Partial fixed-shape slice assignment
✅ Partial indexing type inference
✅ Partial indexing as borrowed views for safe local use
✅ Borrowed views mutate original owner
✅ Runtime bounds checks for dynamic indices
✅ Union element arrays
✅ Union element borrowed views
✅ Const/readonly propagation into borrowed views
✅ Nested readonly borrowed views
✅ Borrowed view return from local owner materializes owned storage when safe
✅ Automatic materialization for fixed-shape borrowed views escaping through return/global assignment
✅ Automatic materialization for retaining calls, aggregate member stores, and returned aggregate literals
✅ Owner promotion/lifetime extension for direct borrowed views escaping through storage/member stores
✅ Owner promotion through escaping nested object/array literal graphs
✅ Owner promotion through local object graph identifiers that escape later
✅ Captured borrowed views in immediate inline callbacks can escape safely to global storage
✅ Explicit .copy() for owned slice/view copies
✅ Array element return unboxing for primitive contexts
✅ Readonly length on arrays and tuples
✅ Recursive aggregate printing for arrays/nested arrays/primitives
✅ Named callback references for array methods
✅ Expression-bodied inline arrow callbacks
✅ Block-bodied inline arrow callbacks
✅ Comparator overloads for sort and toSorted
✅ Array spread in dynamic/fixed/tuple/union contexts
✅ Array destructuring declarations, holes, rest bindings, and for-of destructuring
✅ Local capture/closure semantics for immediate inline callbacks
✅ Persistent closure-captured borrowed views are rejected with semantic diagnostics until closure runtime exists
✅ Direct string extraction from struct-held string[] through provably in-bounds .at()
✅ Depth-aware semantic result typing for flat(depth)
✅ Borrow summaries interprocedural
✅ Core pointer type: ptr<T>
✅ Address-of expression: &value
✅ Pointer parameters
✅ Full fixed-shape array pointer indexing
✅ Dynamic 1D array pointer indexing through ptr<T[]>
✅ Address-of fixed-shape array cells: &matrix[i, j]
✅ Address-of dynamic array cells: &values[i]
✅ Pointer indexing read/write mutates caller storage
✅ Adaptive dynamic-array storage: contiguous fast path vs pointer-safe mode
✅ Extern native ABI rejects arrays/tuples by value
✅ Lazy runtime promotion to pointer-safe storage
✅ Pointer partial views
✅ General dereference syntax: *p and (*p) = value
✅ Stable dynamic-array slot identity
✅ Projected dynamic-array pointers
✅ Pointer-safe push
✅ Removed-slot invalidation for pop/shift/splice
✅ Identity preservation for unshift/reverse/sort
✅ Value overwrite semantics for fill/copyWithin
✅ Whole-array assignment as in-place slot replacement
✅ Runtime dynamic-array pointer validity tracking
✅ Compile-time invalidated-pointer diagnostics for provable cases
✅ Pointer-copy invalidation propagation
✅ Pointer-rebind state reset
✅ Branch-sensitive invalidation merging for if/else and loops
✅ Known dynamic-array length merging
✅ Return-path-sensitive branch merging
✅ Function summaries for dynamic-array invalidation effects
✅ Normal T[] parameters preserve current local/value semantics
✅ Mutating array methods through ptr<T[]>
✅ End-to-end caller invalidation through ptr<T[]> parameters
✅ ptr<T[]> readonly .length access
✅ for-of value/pointer iteration over ptr<T[]>
✅ Final JavaScript-compatible array method policy audit
✅ Final callback ownership/borrow semantics
✅ Nested dynamic-array ownership and pointer chains
✅ Resource-owning struct elements pushed into arrays transfer ownership to the array
✅ Array cleanup destroys remaining resource-owning struct elements exactly once
✅ `pop()` / `shift()` transfer owned resource struct elements when the array is proven non-empty
✅ `splice()` transfers removed resource-owning struct elements into the returned removed-elements array
✅ `unshift()` transfers one or more resource-owning struct values into the array
✅ `splice()` insertion and replacement transfer inserted resource-owning struct values into the source array
✅ Copy-producing JavaScript array methods preserve source values for copyable elements
✅ Copy-producing methods reject shallow copies of resource-owning struct elements
✅ `map()` may borrow resource-owning elements when it produces copyable results
✅ Owned resource-array returns transfer element cleanup metadata to the caller
✅ Forwarded owned resource-array returns preserve cleanup metadata across functions
✅ `ptr<T[]>` parameters borrow resource-owning arrays without copying ownership
✅ Resource-owning arrays are rejected for normal `T[]` value parameters
✅ Discarded owned array returns destroy their resource-owning elements
✅ Program tests verify exact cleanup across early return, loops, break, and continue
✅ Runtime array descriptors carry element destroy/move policy and callback context
✅ Structural mutation through `ptr<T[]>` uses descriptor-owned policy without caller tables
✅ Resource-array policy survives return, movement, nested storage, and module boundaries
✅ Imported struct layouts are materialized in consumer SIR for LLVM lowering
```

## Remaining

``` txt
⬜ Real persistent closure runtime for captured borrowed views
✅ Cleanup/destructor rules for existing escaped fixed views, promoted owners,
   dynamic T[] borrows, and safe materialization
✅ Copy-producing array method ownership policy and backend enforcement
✅ Cross-function ownership summaries for resource-owning array returns and `ptr<T[]>` borrows
✅ Structural mutation of resource-owning arrays through `ptr<T[]>` callees transports element policy in the runtime descriptor
🟡 Core union/any runtime classification and direct typeof narrowing complete;
   advanced structural/discriminated narrowing remains
⬜ Dynamic shaped arrays: Array<T, Rank>
⬜ Dynamic shaped views/slices
✅ Numeric array native ABI via temporary contiguous buffers
✅ String array native ABI via temporary `const char**` buffers
✅ Mutable native string ABI ownership policy documented
✅ Native ABI ownership contracts parsed and semantically validated
✅ Plain numeric struct array native ABI via temporary contiguous buffers
⬜ Native fixed-shape LLVM `[N x T]` value ABI without runtime array descriptor
⬜ Mutable string array native ABI
⬜ Backend/runtime consumption of native ABI ownership contracts
⬜ Resource-owning/nested struct array native ABI marshalling
⬜ Native retention/async FFI pointer policy
⬜ Lazy iterator objects
⬜ Object stringification inside arrays
⬜ Bounds-check elimination and loop optimization
⬜ Final diagnostics polish
⬜ Serialize invalidation summaries for cross-module semantic imports if needed
⬜ Concurrency/shared mutation rules after Yogi threading exists
⬜ Keep documentation synchronized after every array-related lot
```

------------------------------------------------------------------------

# Recommended Future Lot Order

``` txt
1. Fixed Arrays and Multidimensional Matrix Completion
2. Automatic Array View Escape and Lifetime Analysis
3. Array Copy, Move, and Ownership Semantics
4. Union Array Runtime and Narrowing Semantics
5. Native string ownership metadata or resource-owning struct native ABI policy
6. Array Bounds-Check Elimination and Loop Optimization
7. Dynamic Shaped Arrays and Runtime Rank Metadata
8. Lazy Array Iterators
9. Array Diagnostics and Runtime Formatting Polish
10. Concurrent Array Ownership and Mutation
```

------------------------------------------------------------------------

# Current Completion Boundary

The following feature block is complete at the core design and
implementation level:

``` txt
Dynamic Array Pointer Validity and Descriptor-Owned Element Cleanup
```

That includes:

``` txt
adaptive storage selection
lazy runtime promotion
stable slot identity
structural-operation pointer behavior
whole-array replacement behavior
runtime invalidation
compile-time invalidation
branch-sensitive merging
function-summary propagation
descriptor-owned element destroy/move policy
resource-safe structural mutation through ptr<T[]>
cross-module policy propagation
```

The complete Yogi array subsystem is not finished yet. The remaining
work is intentionally divided into focused lots in the roadmap above.

------------------------------------------------------------------------

# Fixed-Shape Iteration Completion

Fixed arrays and multidimensional matrices now preserve their complete
shape through type aliases, function parameters, return values, synthetic
`for...of` temporaries, SIR serialization, and LLVM lowering.

```ts
type Week = number[4]
type SalesGrid = number[3, 4]

function total(grid: SalesGrid): number {
    let result: number = 0

    for (let week: Week of grid) {
        for (let value: number of week) {
            result = result + value
        }
    }

    return result
}
```

Iteration over the outer dimension produces a borrowed row view. The view
descriptor has its own local cleanup obligation, while the row storage
continues to belong to the matrix:

```txt
create row view descriptor
borrow matrix storage
execute loop body
release row view descriptor on normal exit, continue, break, or return
leave matrix storage untouched
```

For `T[N, M]`, `.length` returns `N`, not the flattened row-major element
count. A row view has length `M`. The same rule applies through
`ptr<T[N, M]>`.

Completed by this lot:

```txt
✅ Fixed-shape aliases survive frontend -> SIR -> LLVM
✅ Function-return matrix expressions can be iterated directly
✅ Nested row/value for...of iteration
✅ Mutable row views update the original matrix
✅ Readonly row views preserve readonly diagnostics
✅ Row-view cleanup on normal exit, continue, break, and early return
✅ Pointer matrix and pointer row .length use logical dimensions
✅ LLVM emits row-major indexing and yogi_array_view
✅ Program Test validates output, artifacts, observability, and cleanup
```

Follow-up work after fixed-shape iteration:

```txt
✅ Anonymous owned array/matrix temporaries passed directly to calls are cleaned.
✅ Runtime array element boxes have explicit ownership and recursive payload copy/destruction.
✅ Existing one-dimensional dynamic T[] borrows have explicit local,
   assignment, and return lifetime rules.
⬜ Future dynamic-rank Array<T, Rank> views still need shape-aware lifetime
   analysis.
```

The complete Program Test is
`tests/programs/fixed_matrix_iteration_report.cmake`.

------------------------------------------------------------------------

# Array Expression Lifetime and Element Boxes

An array descriptor states whether its cells contain runtime `AnyValue` boxes
or raw pointer values. Compiler-created Yogi arrays use boxes consistently:

```txt
number[]       -> boxed element cells
string[]       -> boxed element cells
Struct[]       -> boxed element cells
ptr<T>[]       -> boxed YOGI_ANY_POINTER element cells
```

This policy travels with the descriptor and is inherited by copies,
slices, views, returned arrays, callback-produced arrays, and structural
operations. The runtime does not guess from a caller-local ownership
table. Raw/unboxed pointer cells remain an internal runtime capability for
explicit native or low-level descriptors; normal `ptr<T>[]` source lowering
does not mix that representation with `AnyValue` boxes.

The element-box contract is:

```txt
fresh box                    reference count = 1
insert into an array         array consumes that reference
copy a primitive             create an independent primitive box
copy a string                create an independent Yogi string
copy an array                recursively clone its descriptor and elements
copy an object/struct        recursively clone its owned properties
copy a ptr<T> field          copy the pointer value; never clone the pointee
move an element              transfer the existing reference
overwrite/remove/drop slot   release the reference exactly once
undefined/null               immortal singleton, release is a no-op
ptr<T>[] cell                release the pointer box, never the pointee
```

Copy-producing operations such as `slice`, `copy`, `filter`, spreads,
`concat`, `copyWithin`, and runtime clones use the same recursive element
copy operation. The resulting array owns an independent boxed value graph.
Mutating an array, object, struct, or string nested in the copy cannot
mutate the source. Explicit `ptr<T>` fields preserve pointer identity and
remain borrows; their pointees are not cloned.

The runtime object descriptor records whether each property is boxed and
whether that box owns its payload. This lets recursive destruction release
nested arrays/objects exactly once while print-only wrappers and pointer
properties remain borrowed/unboxed.

Owned array expressions now have an explicit full-expression lifetime.
For example:

```ts
function makeValues(seed: number): number[] {
    return [seed, seed + 1, seed + 2]
}

function sum(values: number[]): number {
    let total: number = 0
    for (let value: number of values) {
        total = total + value
    }
    return total
}

let total: number = sum(makeValues(10))
```

`sum` receives its normal value-parameter copy. After the call,
the caller destroys the anonymous result of `makeValues(10)`. The same
rule applies to literals passed directly to calls, temporary spreads,
fixed-shape matrices, and owned copy chains:

```ts
sum([1, 2, 3])
sum(makeValues(10).toReversed().slice(0, 2))
let joined: number[] = [0, ...makeValues(20), 99]
```

LLVM lowering emits descriptor policy initialization, recursive element
copies, and `yogi_array_destroy` at the end of each owned temporary
lifetime. The runtime test verifies that clone/slice/destruction returns
to the allocation baseline, including compiler-created `ptr<T>[]` boxes and
explicit internal unboxed descriptors.

The strict Program Test
`tests/programs/array_expression_lifetime_report.cmake` combines direct
temporary arguments, method chains, spreads, callbacks, extraction,
pointer arrays, matrices, early return, `continue`, `break`, and stress
loops. Its observability manifest uses `allowLive: []`.

Remaining boundary:

```txt
✅ Existing dynamic T[] borrow lifetime boundaries: local alias, owned return
   materialization, and assignment replacement without descriptor alias escape.
🟡 Core union/any aggregate lifetime and direct typeof narrowing complete;
   advanced structural/discriminated narrowing remains.
✅ Recursive copy and payload ownership metadata for boxed object properties.
✅ Scalar/element/string-returning methods close anonymous owned receivers
   after materializing the result; borrowed ptr<T[]> receivers remain alive.
```

------------------------------------------------------------------------

# Temporary Receiver Cleanup

An array expression owns its descriptor until the full expression has
finished using it:

```ts
function makeValues(): number[] {
    return [3, 1, 20]
}

print(makeValues().includes(20))
print(makeValues().at(-1) as number)
print(makeValues().join("-"))
print(makeValues().map((value: number): number => value * 2).length)
```

The lowering order is:

```txt
1. evaluate the receiver;
2. execute the method;
3. materialize any result that still references a receiver element;
4. destroy the receiver if it is an anonymous owned array;
5. return the independent result to the surrounding expression.
```

This policy covers:

```txt
length
push, unshift
pop, shift, at
includes, indexOf, lastIndexOf
join, toString, toLocaleString
toSorted
forEach, map, filter, flatMap
some, every
find, findIndex, findLast, findLastIndex
reduce, reduceRight
discarded pop/shift calls
```

Receiver-returning mutators such as `sort`, `reverse`, `fill`, and
`copyWithin` keep the descriptor alive for the next operation in the chain.
The final scalar/property operation closes it:

```ts
print([3, 1, 20].sort().length)
```

`ptr<T[]>` and local views derived from it remain borrows:

```ts
let values: number[] = [1, 2, 3]
let pointer: ptr<number[]> = &values
let view: number[] = pointer

print(view.includes(2))
view[0] = 99
print(values[0]) // 99
```

Neither the search nor the view destroys the owner descriptor. Search methods
also retain a dynamic `union`/`any` search box before calling the runtime,
because the runtime consumes one temporary reference. This keeps the source
variable valid after `includes`, `indexOf`, or `lastIndexOf`.

`join` and `toString` now return strings registered in the normal runtime
string ownership table. Consequently, the compiler-generated
`yogi_string_destroy` call really frees the result instead of silently
ignoring an unregistered buffer.

Coverage:

```txt
tests/runtime/sessions/02-variables-aggregates/array_scalar_receiver_lifetime.cmake
tests/programs/array_scalar_receiver_lifetime_report.cmake
tests/programs/manifests/array_scalar_receiver_lifetime_report.json
docs/lots/100-array-scalar-receiver-lifetime.md
```

The Program Test combines temporary methods, callback loops, short-circuit
search, `continue`, early return, union search values, borrowed array views,
LLVM inspection, runtime execution, sanitizer integration, and strict
observability with `allowLive: []`.

------------------------------------------------------------------------

# Dynamic Array Borrow Lifetime Boundaries

`ptr<T[]>` remains a borrow, but Yogi can now read that borrow into an
explicitly typed array value when the surrounding context defines a safe
lifetime:

```ts
let values: number[] = [1, 2, 3]
let pointer: ptr<number[]> = &values
let view: number[] = pointer

view[1] = 20
print(values[1]) // 20
```

The local `view` aliases the same descriptor and does not register an
independent cleanup.

Returning that borrow as `T[]` has different semantics:

```ts
function snapshot(values: ptr<number[]>): number[] {
    return values
}
```

The compiler materializes an owned array for the caller through
`yogi_array_clone`. A descriptor with resource-owning elements aborts
defensively, while semantic analysis normally rejects the copy first and names
the resource-owning field path. Yogi never creates a shallow second owner.

Assignment continues to follow the established dynamic-array replacement rule:

```ts
archived = view
```

The compiler first materializes an owned copy of `view`. LLVM then calls
`yogi_array_move_replace_from` only to transfer that unobservable temporary
into `archived`. The target preserves surviving slots, while `view` and its
owner remain unchanged. The borrowed descriptor itself does not escape into
target storage.

The same rule applies to a named owned source:

```ts
let source: number[] = [1, 2, 3]
let target: number[] = source
target[0] = 99

print(source[0]) // 1
print(target[0]) // 99
```

Coverage:

```txt
tests/runtime/sessions/02-variables-aggregates/dynamic_array_escaping_borrows.cmake
tests/programs/dynamic_array_borrow_archive.cmake
tests/programs/array_value_assignment_report.cmake
tests/programs/recursive_aggregate_array_copy_report.cmake
docs/lots/96-dynamic-array-borrow-lifetimes.md
docs/lots/97-array-value-assignment-semantics.md
docs/lots/98-recursive-aggregate-element-copy.md
```

------------------------------------------------------------------------

# Recursive Aggregate Element Copy

Normal `=` keeps value semantics even when an array element is itself an
aggregate:

```ts
struct Team {
    name: string
    scores: number[]
}

let source: Team[] = [{ name: "core", scores: [1, 2] }]
let copy: Team[] = source

copy[0].scores[0] = 99

print(source[0].scores[0]) // 1
print(copy[0].scores[0])   // 99
```

One runtime copy primitive recursively handles primitives, strings, nested
arrays, objects, structs, tuples represented as arrays, and combinations of
those values. It is used by initialization, assignment, value parameters,
borrowed-return materialization, `.copy()`, and JavaScript-compatible
copy-producing array methods.

`ptr<T>` properties are deliberately different: copying the aggregate copies
the pointer value. This preserves explicit shared access without inventing a
second pointee owner.

Copying an aggregate that contains an exclusive native resource remains a
semantic error. The diagnostic includes the nested field path, for example
`payload.resource`. The runtime repeats this check defensively if malformed or
stale compiler metadata reaches it.

Whole-array assignment is alias-safe. The runtime recursively materializes the
complete source first and mutates the destination only after that succeeds.
Consequently, `values = values` and assignment from a view of `values` cannot
destroy source data while it is still being copied. Allocation failures are
fatal runtime errors today; they leave the destination uncommitted rather than
exposing a partially copied value.

------------------------------------------------------------------------

# Union and `any` Runtime Classification

Union values and `any` use a tagged runtime box. Scalar union variables,
aggregate union branches, parameters, returns, assignments, and array elements
now preserve their real runtime value instead of degrading to a null pointer.

`typeof` uses TypeScript syntax and JavaScript-compatible categories:

```ts
type Cell = number | string

let value: Cell = 10

if (typeof value == "number") {
    print(value + 2)
} else {
    print(value.toUpperCase())
}
```

The branch narrows the identifier before SIR is written. LLVM then reads the
same tagged value and unboxes only the proven branch. A bad explicit cast still
fails in runtime; narrowing does not disable defensive tag checks.

Aggregate branches use the same recursive value-copy policy as ordinary
arrays:

```ts
type Payload = number[] | string

let values: Payload[] = [[1, 2], "ready"]
let detached: Payload = values[0]

if (typeof detached == "object") {
    detached[0] = 99
}

print((values[0] as number[])[0]) // 1
print((detached as number[])[0])  // 99
```

Local/global boxes are destroyed automatically. Reassignment destroys the
previous branch, return transfers the box to the caller, and by-value function
parameters receive an independent box.

Coverage:

```txt
tests/runtime/sessions/02-variables-aggregates/union_any_runtime_narrowing.cmake
tests/programs/union_any_narrowing_report.cmake
docs/lots/99-union-any-runtime-classification.md
```

## Real Limitations

These are explicit future boundaries, not implied support:

```txt
1. Owned aggregate graphs must be acyclic. Arbitrary cyclic object graphs do
   not yet have a clone/cleanup policy.
2. Aggregates containing exclusive native resources cannot be copied until
   the resource declares an explicit clone contract.
3. Allocation failure is fatal. Copy-before-commit protects the destination,
   but Yogi has no recoverable copy exception or failure injection API.
4. typeof narrowing currently recognizes direct identifiers in if/else
   equality checks. Property-path narrowing, discriminated unions,
   user-defined type guards, switch narrowing, Array.isArray narrowing, and
   persistence after a terminating branch such as `if (...) return` remain
   future work.
5. Runtime typeof currently classifies number, string, boolean, undefined,
   object, and function. BigInt classification and narrowing are not defined.
6. JavaScript typeof reports arrays, structs, objects, null, and pointers as
   "object". It cannot distinguish those branches. An explicit cast or a
   future structural guard is still required when multiple object-like union
   members remain.
7. typeof on any can safely narrow primitive tags. It cannot infer an object
   shape that was not declared, so object-like any values still require an
   explicit concrete cast before field access.
8. Native ABI marshalling for union/any aggregate payloads is not defined.
9. A boxed ptr<T> owns only its AnyValue wrapper. It never owns or extends the
   pointee lifetime. Copies preserve the same borrow identity, so the normal
   pointer provenance and invalidation rules still apply.
10. `reduce`/`reduceRight` support copyable real structs containing strings,
    arrays, objects/type literals, unions, and nested copyable structs.
    Pointer-bearing structs remain rejected because a pointer field can be a
    borrow or an exclusive native resource and no clone contract is implied.
    Inline callbacks may return managed struct locals and may conditionally
    choose between the accumulator, a managed local, and fresh owned values.
    Each branch materializes the next owner before callback-local cleanup.
    Callbacks still cannot retain aggregate borrows from source elements or
    captured owners.
11. Returning a `ptr<T>` or a projected pointer from an anonymous array method
    does not extend the receiver lifetime. Pointer provenance rules must reject
    use after the temporary receiver is destroyed.
```

------------------------------------------------------------------------

# Aggregate Accumulators in `reduce`

`reduce` and `reduceRight` keep exactly one owned accumulator across the loop.
The seed remains independent:

```ts
function append(accumulator: number[], value: number): number[] {
    accumulator.push(value)
    return accumulator
}

let seed: number[] = [10]
let result: number[] = [1, 2, 3].reduce(append, seed)

result[0] = 99

print(seed[0])   // 10
print(result[0]) // 99
```

The lowering follows this ownership cycle:

```txt
materialize owned accumulator
  -> invoke callback
  -> callback returns next owned accumulator
  -> destroy the previous accumulator if it was replaced
  -> continue with one owner
  -> transfer the final accumulator to the caller
```

The same policy applies to strings, object/type-literal values, and real
structs whose managed fields are copyable:

```ts
type Counters = {
    total: number
}

struct Trail {
    values: number[]
    label: string
}

struct Report {
    trail: Trail
    tags: string[]
    counters: Counters
}

function collect(accumulator: Report, value: number): Report {
    accumulator.trail.values.push(value)
    accumulator.trail.label = accumulator.trail.label + "+"
    accumulator.counters.total = accumulator.counters.total + value
    return accumulator
}
```

At each named by-value callback boundary, LLVM recursively clones the struct
fields. Returning the accumulator transfers those cloned fields to the reduce
loop. Returning a fresh struct cleans the unused parameter clone before the
fresh fields become the next accumulator. The previous loop owner is then
destroyed field by field.

Inline callbacks clone the managed struct accumulator before mutation and
register that clone in a callback-local cleanup slot. Managed locals receive
their own cleanup slots. Before returning, each conditional branch materializes
an independent next accumulator; fresh branch temporaries and all callback
locals are then destroyed in reverse order. This makes direct accumulator,
managed-local, fresh-value, and nested ternary returns safe.

Inline callback bodies lower nested blocks, `if/else`, `while`, `for`, and
`switch` as real LLVM control flow. Every early return stores its result in the
callback return slot, emits the cleanup obligations active on that path, and
branches to the shared callback exit. A branch that does not return keeps its
outer owners alive for the remaining callback statements.

This applies to `map`, `filter`, `some`, `every`, `find`/`findIndex`,
`forEach`, `flatMap`, `reduce`, and `reduceRight`. Callback-local `break`
targets the nearest loop or switch, while `continue` skips switch frames and
targets the nearest enclosing loop. Switch cases share their normal
fall-through scope.

Each managed callback local also has a runtime active flag next to its cleanup
slot. This matters for direct switch entry: cleanup cannot destroy a local
declared in an earlier case unless execution actually initialized it. The flag
is cleared after cleanup, preventing duplicate destruction across
`break`, `continue`, and early-return paths.

Type aliases used as struct fields carry their resolved shape into SIR. This is
required so a field such as `counters: Counters` is cloned and destroyed as an
object rather than treated as an opaque pointer.

Borrowed projections returned from a copied struct parameter are materialized
before parameter cleanup. Printing a borrowed string field also leaves the
field owned by its struct; `print(report.trail.label)` never consumes
`report.trail.label`.

A callback that tries to make a borrowed source element or captured owner
become the next aggregate accumulator is rejected before FlatBuffer/LLVM
generation. Pointer-bearing struct accumulators are also rejected until the
pointer/resource declares an explicit clone or transfer contract.

Coverage:

```txt
tests/runtime/sessions/02-variables-aggregates/array_reduce_aggregate_ownership.cmake
tests/programs/array_reduce_aggregate_report.cmake
tests/programs/managed_struct_reduce_report.cmake
tests/programs/inline_reduce_branch_ownership_report.cmake
tests/programs/inline_reduce_control_flow_report.cmake
tests/programs/inline_callback_loop_switch_report.cmake
docs/lots/101-array-reduce-aggregate-ownership.md
docs/lots/102-managed-struct-reduce-ownership.md
docs/lots/103-inline-managed-callback-cleanup.md
docs/lots/104-inline-callback-control-flow.md
docs/lots/105-inline-callback-loop-switch.md
```
