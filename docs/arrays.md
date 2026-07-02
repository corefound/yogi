# Array TODO

This file tracks array work that is intentionally not complete yet.

Keep this updated at the end of each array-related lot so future work can start from the known state instead of rediscovering gaps from the source code.

Yogi arrays are designed to be explicit, strict, shape-aware, and efficient for LLVM lowering.

Core model:

```ts
T[]          // dynamic 1D array
T[N]         // fixed-size 1D array
T[N, M]      // fixed-shape 2D array
T[N, M, K]   // fixed-shape multidimensional array
```

Yogi does not need a separate native `Vector` container. Domain-specific vector/matrix types can be built with `type`, `interface`, or `struct`.

```ts
type Vector2 = float32[2]
type Vector3 = float32[3]
type Matrix4 = float32[4, 4]
type RGBA = uint8[4]
```

---

## Core Design Rules

### Strict access vs safe access

Direct bracket indexing is strict:

```ts
let scores: number[] = [10, 20, 30]

scores[0] // OK
scores[5] // runtime range error
```

Safe optional access uses methods such as `.at()`:

```ts
let value: number | undefined = scores.at(5)
```

Rule:

```txt
array[index]     = strict access, must exist
array.at(index)  = safe access, may return undefined
```

---

### Fixed-size arrays

Fixed-size arrays must have exactly the declared length.

```ts
let vec: number[3] = [10, 20, 30] // OK
```

Invalid:

```ts
let vec: number[3] = [10, 20]
// error: expected 3 elements, got 2
```

Invalid:

```ts
let vec: number[3] = [10, 20, 30, 40]
// error: expected 3 elements, got 4
```

`number[3]` means exactly 3 elements. It does not mean “capacity up to 3”.

Size-changing methods are rejected on fixed arrays:

```ts
vec.push(4)       // error
vec.pop()         // error
vec.shift()       // error
vec.unshift(0)    // error
vec.splice(1, 1)  // error
```

---

### Fixed-shape multidimensional arrays

Fixed-shape arrays use comma-separated dimensions inside one bracket pair.

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
```

More examples:

```ts
let tensor: number[4, 4, 3]
let image: uint8[1080, 1920, 4]
```

Invalid syntax:

```ts
let bad: number[[2, 3]]
// error
```

`number[2, 3]` is a rectangular shaped value. It is not the same as:

```ts
Array<Array<number>>
```

`Array<Array<number>>` is a jagged/dynamic array of arrays.

---

### Coordinate indexing

Yogi treats comma-separated index brackets as multidimensional coordinate indexing.

```ts
matrix[1, 2]
tensor[1, 0, 1]
image[y, x, 0]
```

This is not JavaScript comma operator behavior.

In JavaScript/TypeScript:

```ts
array[1, 2, 0]
```

effectively means:

```ts
array[0]
```

In Yogi:

```ts
array[1, 2, 0]
```

means coordinate indexing with three indices.

For normal dynamic 1D arrays:

```ts
let values: number[] = [1, 2, 3]

values[0, 1]
// error: number[] expects 1 index, got 2
```

---

### Row-major lowering

Fixed-shape arrays lower as flat row-major storage.

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
```

Conceptually:

```txt
[1, 2, 3, 4, 5, 6]
```

For:

```ts
matrix[1, 2]
```

the row-major offset is:

```txt
offset = 1 * 3 + 2
offset = 5
```

For:

```ts
let tensor: number[2, 2, 2]
tensor[1, 0, 1]
```

the strides are:

```txt
shape = [2, 2, 2]
strides = [4, 2, 1]
offset = 1 * 4 + 0 * 2 + 1
offset = 5
```

---

### Partial indexing and borrowed views

Full indexing consumes all dimensions and returns an element.

```ts
let value: number = matrix[1, 2]
```

Partial indexing consumes only some dimensions and returns a shaped view.

```ts
let row: number[3] = matrix[1]
```

Borrowed view behavior:

```ts
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

```txt
matrix storage:
[1, 2, 3, 4, 5, 6]
          ^
          row starts here
```

A borrowed local view must not outlive its owner. When a partial view from a
local fixed-shape owner needs to escape through `return`, the user must request
an owned copy explicitly with `.copy()`.

```ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1].copy() // owned number[3] copy
}
```

Returning the borrowed view directly is rejected:

```ts
function bad(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1] // error
}
```

The copied row no longer borrows from `matrix`:

```ts
let row: number[3] = getRow()
row[2] = 99
print(row[2]) // 99
```

---

### Union element arrays

Arrays can use union types as element types.

```ts
let values: (int | string)[3] = [1, "two", 3]
```

This means:

```txt
exactly 3 elements
each slot accepts int or string
```

Valid:

```ts
let a: (int | string)[3] = [1, 2, 3]
let b: (int | string)[3] = ["a", "b", "c"]
let c: (int | string)[3] = [1, "b", "c"]
```

Invalid:

```ts
let bad: (int | string)[3] = [1, "a", true]
// error: boolean is not assignable to int | string
```

Union arrays are different from tuples.

```ts
let a: (int | string)[3]
```

Each slot accepts `int | string`.

```ts
let b: [int, string, string]
```

Position-specific tuple type:

```txt
position 0: int
position 1: string
position 2: string
```

---

## Supported Now

### Array declarations and literals

- Array literals.
- Explicit `T[]` declarations.
- Tuple literals.
- Explicit tuple declarations.
- Fixed-size one-dimensional arrays.
- Fixed-shape multidimensional arrays.

Examples:

```ts
let values: number[] = [1, 2, 3]
let vec: number[3] = [10, 20, 30]
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]
let pair: [number, string] = [1, "one"]
```

---

### Fixed-size 1D arrays

Supported:

```ts
number[3]
```

Working behavior:

- Exact literal length validation.
- Strict bracket indexing.
- Constant out-of-bounds detection.
- Runtime range checks where needed.
- Size-changing methods rejected.

Example:

```ts
let vec: number[3] = [10, 20, 30]

vec[2] // OK
vec[3] // compile-time/range error where possible
vec.push(40) // error
```

---

### Fixed-shape multidimensional arrays

Supported:

```ts
number[2, 3]
number[4, 4, 3]
```

Working behavior:

- Rectangular literal validation.
- Coordinate indexing with `matrix[i, j]`.
- Partial indexing such as `matrix[i]` with shaped result type.
- Multidimensional assignment.
- Dynamic indices keep runtime bounds checks.

Example:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

print(matrix[1, 2]) // 6

matrix[0, 1] = 99

print(matrix[0, 1]) // 99
```

---

### Borrowed views for partial fixed-shape indexing

Supported:

```ts
let row: number[3] = matrix[1]
```

Current behavior:

- `matrix[1]` creates a borrowed descriptor with `yogi_array_view(source, baseOffset, length)`.
- Local partial indexing does not copy elements.
- Mutating through the view mutates the original storage.
- 3D views work.
- Dynamic partial indices keep runtime bounds checks.
- Returning a partial view from a local fixed-shape owner requires `.copy()`.
- `.copy()` contains only the selected view shape, not the full owner.

Example:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

row[2] = 99

print(matrix[1, 2]) // 99
```

3D example:

```ts
let image: number[2, 2, 3] = [
    [
        [1, 2, 3],
        [4, 5, 6]
    ],
    [
        [7, 8, 9],
        [10, 11, 12]
    ]
]

let pixel: number[3] = image[1, 0]

pixel[1] = 88

print(image[1, 0, 1]) // 88
```

---

### SIR/FBS metadata

Supported:

- FlatBuffers shape metadata through `TypeRef.fixed`.
- FlatBuffers shape metadata through `TypeRef.shape`.
- Element access preserves multiple indices.
- `value[i, j, k]` travels through the compiler as Yogi multidimensional indexing, not as a JavaScript comma expression.

---

### LLVM lowering

Supported:

- Fixed-shape literals lower as flat row-major descriptor storage.
- Row-major offset calculation for reads.
- Row-major offset calculation for writes.
- IR checks confirm fixed 2D lowering as flat descriptor storage.
- IR uses `array.shape.*` blocks/markers for shaped lowering paths.

Current limitation:

- Fixed-shape arrays are row-major and rectangular, but still runtime-descriptor backed.
- Full native fixed-shape ABI without runtime descriptors is future work.

---

### Index access

Supported:

```ts
scores[0]
matrix[1, 2]
tensor[1, 0, 1]
```

`value[i, j, k]` is multidimensional indexing in Yogi. It is not the JavaScript comma operator inside brackets.

---

### Array element return unboxing for primitive contexts

Supported:

```ts
scores.at(0)
scores.pop()
scores.shift()
scores.find(callback)
```

Notes:

- `find`, `at`, `pop`, and `shift` return `T | undefined`.
- They can unbox into primitive contexts that explicitly expect `T`.
- They can remain boxed when a variable explicitly stores the union.

---

### Readonly length

Supported:

- Readonly length on arrays.
- Readonly length on tuples.

---

### Mutating methods

Supported on dynamic arrays where semantically valid:

```txt
push
pop
shift
unshift
reverse
```

Copy/mutation methods:

```txt
fill
copyWithin
splice
sort
```

Comparator overloads:

```txt
sort(compareFn)
toSorted(compareFn)
```

Notes:

- `sort()` and `toSorted()` support JavaScript-style default string ordering.
- Comparator callbacks returning `number` are supported.
- Size-changing methods are rejected on fixed arrays.

---

### Non-mutating methods

Supported:

```txt
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

- `with` uses runtime range diagnostics.
- Future range-sensitive APIs should reuse the same Yogi runtime range error path unless Yogi later adds catchable exceptions.
- `flat(depth)` honors the runtime depth argument.
- Semantic typing currently flattens one known static level.

---

### Recursive aggregate printing

Supported:

- Arrays containing arrays.
- Arrays containing primitive values.

Pending:

- Object stringification inside arrays.
- Primitive and nested array elements are stringified.
- Object display should wait for object runtime formatting.

---

### Callback methods with named function references

Supported:

```txt
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

---

### Callback methods with expression-bodied inline arrows

Supported:

```ts
(value: T): U => expression
(value: T, index: number): U => expression
```

---

### Callback methods with block-bodied inline arrows

Supported:

```ts
(value: T): U => {
    let next: U = expression
    return next
}
```

Supported inside block-bodied inline arrows:

- Sequential local declarations.
- Assignments.
- Calls.
- Explicit return.

Notes:

- Inline callbacks lower inside the array loop.
- Inline callbacks passed directly to array methods may capture surrounding locals.
- Captures are lexical and non-escaping; Yogi does not create heap closure objects for this batch.

---

## Supported Now Details

### 1. Const / readonly propagation into borrowed views

Borrowed views must inherit mutability from their source.

Mutable owner:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

row[2] = 99 // OK
```

Readonly owner:

```ts
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

```txt
The mutability of the view's storage comes from the owner, not from the local binding.
```

This means `let row = matrix[1]` does not make readonly borrowed storage mutable.

---

### 2. Nested readonly borrowed views

Readonly must propagate through nested borrowed views.

```ts
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

```txt
image readonly -> row readonly -> pixel readonly
```

---

### 3. Explicit `.copy()` for owned slice/view copies

Borrowed views should be efficient by default.

Explicit copy should create owned storage.

```ts
let row: number[3] = matrix[1]
// borrowed view

let copy: number[3] = matrix[1].copy()
// owned copy
```

Example:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let copy: number[3] = matrix[1].copy()

copy[2] = 99

print(matrix[1, 2]) // 6
```

Useful for returning owned rows:

```ts
function getRow(): number[3] {
    let matrix: number[2, 3] = [
        [1, 2, 3],
        [4, 5, 6]
    ]

    return matrix[1].copy()
}
```

---

### 4. Spread operator for arrays

Supported:

```ts
let a: number[] = [1, 2]
let b: number[] = [0, ...a, 3]
```

Strict type checking:

```ts
let a: string[] = ["x", "y"]

let b: number[] = [1, ...a]
// error
```

Fixed arrays should only accept spread when the final length is known and exact:

```ts
let a: number[2] = [1, 2]

let b: number[3] = [0, ...a]
// OK
```

Invalid:

```ts
let a: number[2] = [1, 2]

let b: number[4] = [0, ...a]
// error: expected 4 elements, got 3
```

Dynamic spread into fixed arrays should be rejected unless an explicit runtime-checked conversion exists:

```ts
let a: number[] = [1, 2]

let b: number[3] = [0, ...a]
// error
```

Spread creates a new array, not a borrowed view.

Backend lowering:

```txt
dynamic array literal with spread:
  create empty array
  push scalar elements
  loop through each spread source with yogi_array_length/get/push

fixed-size 1D array literal with spread:
  validate final length at semantic time
  create fixed-length descriptor
  loop through each spread source with yogi_array_length/get/set
```

---

### 5. Spread length validation for fixed arrays

For fixed arrays:

```ts
let a: number[2] = [1, 2]
let b: number[2] = [3, 4]

let c: number[4] = [...a, ...b]
// OK
```

Invalid:

```ts
let c: number[5] = [...a, ...b]
// error: expected 5 elements, got 4
```

---

### 6. Spread type checking for union/fixed/dynamic arrays

Union spread must respect declared element type.

```ts
let a: (int | string)[2] = [1, "two"]

let b: (int | string)[3] = [0, ...a]
// OK
```

Invalid:

```ts
let a: (int | string)[2] = [1, "two"]

let b: int[3] = [0, ...a]
// error: string may not be assignable to int
```

---

### 7. Local capture / closure semantics for inline callbacks

Supported for inline callbacks consumed immediately by array methods:

- Read captures from surrounding lexical scopes.
- Mutable writes to captured local variables when the captured binding itself is mutable.
- Captured dynamic arrays, fixed-shape arrays, and borrowed views.
- Normal shadowing: callback parameters and callback locals shadow outer names.
- Readonly borrowed view mutation checks still apply inside callbacks.

Still pending:

- General escaping closures.
- Assigning callbacks into variables/properties.
- Returning callbacks from functions.
- Heap closure objects and capture lifetime extension.

---

### 8. Depth-aware semantic result typing for `flat(depth)`

Supported:

- `flat()` defaults to depth `1`.
- `flat(0)` preserves the same array nesting.
- `flat(N)` removes up to `N` dynamic array nesting layers when `N` is a known numeric literal.
- Depth greater than nesting clamps at the element array type.
- Union element types are preserved.
- Known numeric literal depth must be a non-negative integer.
- Non-literal depth uses the current conservative one-level fallback typing.

Examples:

```ts
let values: number[][][] = [
    [[1, 2]],
    [[3, 4]]
]

let one: number[][] = values.flat(1)
let two: number[] = values.flat(2)
```

---

### 9. String element extraction from `string[]` inside struct fields

Known issue:

- String element extraction from `string[]` through `.at()` when the array lives inside a struct field needs a focused array/string ownership lowering fix.
- The field type and array length are valid.
- Direct string extraction still needs focused lowering work.

---

## Future Work

### 1. Borrow summaries interprocedural

Needed for functions that return views borrowed from parameters.

Example:

```ts
function firstRow(matrix: number[2, 3]): number[3] {
    return matrix[0]
}
```

Conceptual summary:

```txt
return borrows from parameter 0
```

This allows safe usage when the owner outlives the returned view:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = firstRow(matrix)
```

But must reject unsafe cases where the owner dies before the view.

---

### 2. Escape analysis complete for borrowed views

Cases to analyze:

```ts
globalRow = matrix[1]
return matrix[1]
closure = () => matrix[1]
external(matrix[1])
object.row = matrix[1]
```

Rule:

```txt
If a borrowed view escapes beyond the owner:
- reject it
- or require explicit .copy()
- or safely promote/capture the owner if the ownership model supports it
```

---

### 3. Cleanup / destructor rules for views

Borrowed views are non-owning.

Example:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]
```

Cleanup rule:

```txt
row does not free matrix storage
matrix owns and frees storage if needed
```

Views should clean up only their descriptor metadata if required, never the borrowed storage.

---

### 4. Dynamic shaped arrays

Future syntax:

```ts
let image: Array<uint8, 3> = loadImage("photo.png")
```

Meaning:

```txt
rank = 3
dimensions known at runtime
```

Runtime descriptor:

```txt
data pointer
rank
dims
strides
total length
capacity, if applicable
```

Example:

```ts
let red: uint8 = image[y, x, 0]
```

Offset:

```txt
offset = y * stride0 + x * stride1 + 0
```

---

### 5. Dynamic shaped views/slices

For dynamic shaped arrays:

```ts
let image: Array<uint8, 3> = loadImage("photo.png")

let pixel = image[y, x]
```

`pixel` should become a dynamic shaped borrowed view:

```txt
rank = 1
dims = [channels]
base = image.base + offset
```

---

### 6. Native fixed-shape ABI without runtime descriptor

Current state:

- Fixed-shape arrays use flat row-major descriptor storage.

Future goal:

- Full first-class contiguous native array ABI for fixed-shape arrays.
- Avoid runtime descriptors where native flat representation is possible.

Examples:

```txt
number[2, 3] -> [6 x double]
uint8[1080, 1920, 4] -> [8294400 x i8]
```

---

### 7. C ABI interop rules for arrays

Need rules for exporting/importing arrays.

Example:

```ts
export function process(matrix: number[4, 4]): void
```

Open questions:

```txt
Should fixed arrays pass by value?
Should large fixed arrays pass by pointer?
Should dynamic arrays pass by descriptor?
Should fixed-shape views pass as pointer + shape?
```

Recommended direction:

```txt
small fixed-shape arrays: native flat representation when practical
large fixed-shape arrays: pointer/view
dynamic arrays: descriptor
external C ABI: explicit pointer or descriptor rules
```

---

### 8. Lazy iterator objects

Current state:

- `for...of` works over arrays and array-producing iterator methods.
- `keys`, `values`, and `entries` still materialize arrays.

Future goal:

- Lazy iterator objects.

Pending because:

```txt
Yogi does not have lazy iterator objects yet.
```

---

### 9. Object stringification inside arrays

Current state:

- Primitive array elements stringify.
- Nested arrays stringify.

Future work:

- Object display inside arrays should wait for object runtime formatting.

---

### 10. Final array method policy

Need to finalize the method policy across:

```txt
dynamic arrays
fixed arrays
fixed-shape arrays
borrowed views
readonly borrowed views
tuples
```

Methods to define carefully:

```txt
includes
indexOf
forEach
map
filter
slice
fill
copy
reverse
sort
flat
with
toReversed
toSpliced
toSorted
```

Recommended policy:

```txt
Allowed on fixed arrays:
- read-only methods
- iteration
- copy
- fill if mutable
- map if shape preserving

Forbidden on fixed arrays:
- push
- pop
- shift
- unshift
- splice when it changes length

Special:
- filter returns dynamic array
- slice should have explicit view/copy semantics
```

---

### 11. Final diagnostics polish

Improve diagnostics for:

```ts
let matrix: number[2, 3] = [
    [1, 2],
    [3, 4]
]
```

Preferred diagnostic:

```txt
error: fixed-shape array 'number[2, 3]' expects dimension 1 length 3, got 2
```

For too many indices:

```ts
matrix[1, 2, 3]
```

Preferred diagnostic:

```txt
error: fixed-shape array 'number[2, 3]' expects at most 2 indices, got 3
```

For readonly borrowed mutation:

```ts
const matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = matrix[1]

row[2] = 99
```

Preferred diagnostic:

```txt
error: cannot mutate borrowed view 'row' because it borrows from readonly source 'matrix'
```

---

## Notes

Named callback references, expression-bodied inline arrows, block-bodied inline arrows, and immediate inline callback captures are supported for array methods.

Inline callback captures are lexical and non-escaping. The callback is lowered directly inside the array loop, so captured locals are read from the surrounding function storage at execution time.

`find`, `at`, `pop`, and `shift` return `T | undefined`. They can now unbox into primitive contexts that explicitly expect `T`, and they can remain boxed when a variable explicitly stores the union.

`sort()` and `toSorted()` support JavaScript-style default string ordering and comparator callbacks that return `number`.

`flat(depth)` honors the runtime depth argument. Semantic typing is depth-aware when the depth is a known numeric literal, including `flat(0)`, `flat(1)`, deeper nesting, and union element arrays. Non-literal depth currently keeps a conservative one-level fallback type.

`with` now uses runtime range diagnostics. Future range-sensitive APIs should reuse the same Yogi runtime range error path unless Yogi later adds catchable exceptions.

Yogi treats `value[i, j, k]` as multidimensional indexing. It is not the JavaScript comma operator inside brackets.

---

## Implementation Checklist

### Completed

```txt
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
✅ Partial indexing type inference
✅ Partial indexing as borrowed views
✅ Borrowed views mutate original owner
✅ Runtime bounds checks for dynamic indices
✅ Union element arrays
✅ Union element borrowed views
✅ Returning borrowed view from local owner is rejected unless `.copy()` is used
✅ Const/readonly propagation into borrowed views
✅ Nested readonly borrowed views
✅ Explicit .copy() for owned slice/view copies
✅ Array element return unboxing for primitive contexts
✅ Readonly length on arrays and tuples
✅ Recursive aggregate printing for arrays/nested arrays/primitives
✅ Named callback references for array methods
✅ Expression-bodied inline arrow callbacks
✅ Block-bodied inline arrow callbacks
✅ Local capture/closure semantics for immediate inline array callbacks
✅ Comparator overloads for sort and toSorted
✅ Array spread in dynamic array literals
✅ Array spread from fixed arrays and tuples
✅ Spread length validation for fixed-size 1D arrays
✅ Spread element type checking for dynamic, fixed, tuple, and union targets
✅ Depth-aware semantic result typing for flat(depth)
```

### Next Lots

```txt
⬜ String element extraction from string[] through .at() inside struct fields
```

### Future Work

```txt
⬜ Borrow summaries interprocedural
⬜ Escape analysis complete for borrowed views
⬜ Cleanup/destructor rules for borrowed views
⬜ Dynamic shaped arrays: Array<T, Rank>
⬜ Dynamic shaped views/slices
⬜ Native fixed-shape ABI without runtime descriptor
⬜ C ABI interop rules for arrays
⬜ Lazy iterator objects
⬜ Object stringification inside arrays
⬜ Final array method policy
⬜ Final diagnostics polish for shape/index/readonly errors
⬜ Documentation fully updated after each lot
```

---

## Recommended Implementation Order

```txt
1. String element extraction from string[] through .at() inside struct fields
2. Borrow summaries interprocedural
3. Escape analysis complete for borrowed views
4. Cleanup/destructor rules for borrowed views
5. Dynamic shaped arrays: Array<T, Rank>
6. Dynamic shaped views/slices
7. Native fixed-shape ABI without runtime descriptor
8. C ABI interop rules for arrays
9. Lazy iterator objects
10. Object stringification inside arrays
11. Final array method policy
12. Final diagnostics polish
13. Documentation final pass
```
