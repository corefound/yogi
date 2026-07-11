# Array TODO

This file tracks array work that is intentionally not complete yet.

Keep this updated at the end of each array-related lot so future work can start from the known state instead of rediscovering gaps from the source code.

Yogi arrays are designed to be explicit, strict, shape-aware, and efficient for LLVM lowering.

Core model:

```ts
T[]             // dynamic 1D array, simple ergonomic array
T[N]            // fixed-size 1D array
T[N, M]         // fixed-shape 2D rectangular array
T[N, M, K]      // fixed-shape multidimensional rectangular array

Array<T, Rank>  // dynamic shaped rectangular array with compile-time known rank
Array<T>        // dynamic shaped rectangular array with runtime-known rank
```

Important distinction:

```txt
T[]             = simple dynamic rank-1 array
Array<T, 1>     = shaped dynamic rank-1 array
Array<T, Rank>  = shaped dynamic array with rank known at compile-time
Array<T>        = shaped dynamic array with rank checked at runtime
```

Yogi should not treat `T[]` as an implicit nested/multidimensional array.

Invalid:

```ts
let matrix: number[] = [
    [1, 2],
    [3, 4]
]
// error: array 'matrix' expects element type 'number', got 'number[]'
```

Correct dynamic shaped 2D array:

```ts
let matrix: Array<number, 2> = [
    [1, 2],
    [3, 4]
]
```

Correct fixed-shape 2D array:

```ts
let matrix: number[2, 2] = [
    [1, 2],
    [3, 4]
]
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

### Dynamic array pointer validity

Dynamic `T[]` arrays keep JavaScript/TypeScript method names, but Yogi gives
interior pointers stricter runtime meaning.

```ts
struct User {
    age: number
}

let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[1].age

users.shift()
age = 99
print(users[0].age) // 99
```

The pointer does not mean "index 1 forever." It points to the original element
identity. `shift()` removed the first slot, so the original second slot still
exists and moved to index `0`.

If a method removes the pointed element, using the pointer is a runtime error:

```ts
let age: ptr<number> = &users[0].age

users.shift()
age = 99 // runtime pointer error
```

Policy:

```txt
pop      invalidates only the removed last slot
shift    invalidates only the removed first slot
splice   invalidates only removed slots
unshift  preserves existing slots
reverse  preserves existing slots and changes logical order
sort     preserves existing slots and changes logical order
fill     overwrites values inside existing slots
copyWithin overwrites values inside existing slots
assignment preserves common slots, creates new slots, and invalidates removed slots
toSpliced / toReversed / toSorted do not mutate original slots
```

Dynamic array assignment is a full in-place slot replacement:

```ts
let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[0].age

users = [{ age: 99 }, { age: 100 }]
age = 50

print(users[0].age) // 50
print(users[1].age) // 100
```

The pointer keeps its slot identity. If the assignment keeps that slot index, the
slot value is overwritten and the pointer remains valid. If the new array is
shorter and removes the pointed slot, the next pointer read/write reports a
runtime pointer error.

When Yogi sees a live interior pointer and an identity-sensitive dynamic array
method on the same root, semantic analysis selects pointer-safe storage for that
array literal. The LLVM backend asks the runtime for `yogi_array_pointer_cell`
and pointer reads/writes go through `yogi_pointer_cell_get` /
`yogi_pointer_cell_set`.

This is local slot metadata, not GC and not global pointer scanning.

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

Yogi's preferred multidimensional dynamic syntax should not be `number[][]` or
`number[,]`. The preferred form is `Array<T, Rank>` or `Array<T>`.

```ts
Array<number, 2>  // dynamic rectangular 2D
Array<number, 3>  // dynamic rectangular 3D
Array<number>     // dynamic rectangular array with runtime rank
```

This avoids both visually noisy empty comma syntax:

```ts
number[,]
number[,,]
number[,,,]
```

and indefinitely repeated bracket syntax:

```ts
number[][]
number[][][]
number[][][][]
```

The main Yogi model is:

```txt
Use T[] for simple dynamic one-dimensional arrays.
Use T[N, M, ...] for fixed-shape rectangular arrays.
Use Array<T, Rank> for dynamic shaped rectangular arrays with known rank.
Use Array<T> for dynamic shaped rectangular arrays whose rank is known only at runtime.
```

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

### Dynamic shaped arrays: `Array<T, Rank>` and `Array<T>`

Dynamic shaped arrays represent rectangular arrays whose dimensions are known at
runtime instead of compile time.

Known-rank dynamic shaped array:

```ts
let matrix: Array<number, 2> = [
    [1, 2],
    [3, 4]
]
```

Meaning:

```txt
element type = number
rank = 2 known at compile-time
dimensions = dynamic at runtime
rectangular = yes
```

Runtime-rank dynamic shaped array:

```ts
let data: Array<number> = loadArray()
```

Meaning:

```txt
element type = number
rank = known only at runtime
dimensions = dynamic at runtime
rectangular = yes
```

`Array<T>` is intentionally flexible. Coordinate indexing is allowed, but Yogi
performs runtime rank and bounds checks.

```ts
let data: Array<number> = loadArray()

let value: number = data[0, 1]
```

Runtime checks:

```txt
- data.rank must be 2 because the code used 2 indices
- index 0 must be inside dimension 0
- index 1 must be inside dimension 1
```

If the runtime rank does not match:

```txt
runtime error: cannot index Array<number> with 2 indices because runtime rank is 3
```

For known-rank arrays, index count errors are compile-time errors.

```ts
let matrix: Array<number, 2> = loadMatrix()

matrix[0, 1]     // OK
matrix[0, 1, 2]  // compile-time error: Array<number, 2> expects 2 indices, got 3
```

Yogi design principle:

```txt
If rank is known, Yogi checks it at compile time.
If rank is unknown, Yogi allows the operation and checks it at runtime.
```

This gives the language controlled flexibility without falling into `any`-style
dynamic behavior.

Runtime descriptor:

```txt
data pointer
rank
dims
strides
total length
capacity / allocator metadata, if applicable
```

Example image-like array:

```ts
let image: Array<uint8, 3> = loadImage("photo.png")

let red: uint8 = image[y, x, 0]
```

---

### Union element dynamic shaped arrays

The element type of `Array<T, Rank>` and `Array<T>` can be a union type.

```ts
let data: Array<number | string, 2> = [
    [1, "A"],
    [2, "B"]
]
```

This means:

```txt
rank = 2 known at compile-time
each cell accepts number or string
boolean is not allowed
```

Valid:

```ts
data[0, 0] = 99
data[0, 1] = "hello"
```

Invalid:

```ts
data[1, 0] = true
// error: Array<number | string, 2> only accepts number | string, got boolean
```

Runtime-rank union array:

```ts
let data: Array<number | string> = loadData()

let value: number | string = data[0, 1]
```

Yogi validates the rank and bounds at runtime, while the value type remains a
strict union. To use the result as a concrete type, the developer must narrow it.

```ts
let value: number | string = data[0, 1]

if (typeof value == "number") {
    print(value + 10)
}
```

Rule:

```txt
Array<any> should not be the default flexibility mechanism.
Array<T union> should be the controlled flexible mechanism.
```

---

### Pointer parameters and full array pointer indexing

Yogi now supports pointer parameters for normal scalar values, dynamic 1D arrays,
and fixed-shape arrays.

```ts
function change(matrix: ptr<number[2, 3]>): void {
    matrix[0, 2] = 99
}

let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

change(&matrix)

print(matrix[0, 2]) // 99
```

Rules:

```txt
T parameter      = local/value parameter
ptr<T> parameter = pointer to caller/external storage
&value           = address-of expression
```

Normal aggregate parameters are cloned into local function storage before the
function body runs. Mutating a normal `number[2, 3]` parameter does not mutate
the caller. A `ptr<number[2, 3]>` parameter points at the caller's storage and
write-through mutates the original.

Full coordinate indexing through fixed-shape array pointers returns the scalar
element type:

```ts
function readCell(matrix: ptr<number[2, 3]>): number {
    return matrix[1, 2]
}

function setAt(matrix: ptr<number[2, 3]>, row: number, col: number, value: number): void {
    matrix[row, col] = value
}
```

Dynamic indices keep the existing runtime bounds checks. Pointer indexing also
preserves union element assignability:

```ts
type Cell = number | string

function update(grid: ptr<Cell[2, 2]>): void {
    grid[0, 0] = 123
    grid[0, 1] = "ok"
}
```

Dynamic 1D array pointers are supported through the descriptor:

```ts
function setFirst(values: ptr<number[]>): void {
    values[0] = 99
}
```

Partial pointer views are supported for fixed-shape arrays. A partial access
returns a borrowed pointer view into the same backing storage:

```ts
function row(matrix: ptr<number[2, 3]>): ptr<number[3]> {
    return matrix[0]
}

function setSecond(row: ptr<number[3]>): void {
    row[1] = 77
}
```

The view does not copy. Mutating through the returned pointer mutates the
original fixed-shape array. Direct assignment to the slice expression is still
rejected:

```ts
function bad(matrix: ptr<number[2, 3]>, row: number[3]): void {
    matrix[0] = row // error
}
```

Pointer-derived return views now carry a small lifetime summary. If a known
function returns a pointer view derived from a pointer parameter, callers keep
that provenance:

```ts
function firstRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {
    return matrix[0]
}

function forwardRow(matrix: ptr<number[2, 3]>): ptr<number[3]> {
    return firstRow(matrix)
}

const matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
let row: ptr<number[3]> = forwardRow(&matrix)

row[0] = 99 // error: row points to const storage
```

Returning a pointer or pointer view derived from local stack storage is rejected:

```ts
function bad(): ptr<number[3]> {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    let p: ptr<number[2, 3]> = &matrix
    return p[0] // error
}
```

All return paths for a borrowed pointer result must borrow from the same
parameter. Returning `left[0]` on one path and `right[0]` on another is rejected
because the compiler cannot summarize the result as one stable parameter borrow.

### Dynamic array storage analysis

Dynamic `T[]` arrays are contiguous by default. A pointer expression alone does
not force slower storage:

```ts
let users: User[] = [{ age: 20 }]
let age: ptr<number> = &users[0].age

age = 99 // users can still use contiguous storage
```

If a live interior pointer exists when the same dynamic array grows with
`push`, semantic analysis marks that array literal as
`pointer_safe_chunked_mode` in SIR. The LLVM backend lowers that mode into the
runtime create/init call, so existing element cells remain stable across growth.

```ts
let users: User[] = [{ age: 20 }]
let age: ptr<number> = &users[0].age

users.push({ age: 30 }) // users uses pointer-safe storage
age = 99
```

This does not apply to `ptr<User[]> = &users`, because that pointer targets the
array descriptor rather than an interior element/cell. Rebinding a pointer
updates the protected root: after `age = &usersB[0].age`, growth of `usersA`
can stay contiguous while growth of `usersB` becomes pointer-safe.

Destructive or reordering operations remain rejected while a live interior
pointer exists:

```ts
users.sort()    // error if age still points into users
users.reverse() // error
users.splice(0, 1) // error
```

### Future: pointers to dynamic shaped arrays

Pointers to `Array<T, Rank>` and runtime-rank `Array<T>` are planned future
work. They are separate from the currently supported `ptr<number[]>` dynamic
1D descriptor pointer.

```ts
ptr<Array<number, 2>> // pointer to dynamic shaped rank-2 array
ptr<Array<number>>    // pointer to dynamic shaped array with runtime rank
```

A pointer to a dynamic shaped array points to the array descriptor, not just to
the first element. The descriptor contains the data pointer, rank, dims, strides,
and ownership/runtime metadata.

Known-rank pointer example:

```ts
function change(matrix: ptr<Array<number, 2>>): void {
    matrix[0, 1] = 99
}

let matrix: Array<number, 2> = [
    [1, 2],
    [3, 4]
]

change(&matrix)

print(matrix[0, 1]) // 99
```

Runtime-rank pointer example:

```ts
function change(data: ptr<Array<number>>): void {
    data[0, 1] = 99
}

let data: Array<number> = loadArray()

change(&data)
```

This compiles, but runtime validates:

```txt
- data.rank must be 2 because the code used 2 indices
- each index must be within bounds
```

If the runtime rank is not 2:

```txt
runtime error: cannot index Array<number> with 2 indices because runtime rank is 1
```

Dynamic shaped pointer partial views are also possible as future work.

Known-rank partial pointer view:

```ts
function firstRow(matrix: ptr<Array<number, 2>>): ptr<Array<number, 1>> {
    return matrix[0]
}
```

Runtime-rank partial pointer view:

```ts
function firstSlice(data: ptr<Array<number>>): ptr<Array<number>> {
    return data[0]
}
```

For runtime-rank views, Yogi computes the result rank dynamically:

```txt
result rank = input rank - number of consumed indices
```

If the consumed index count is not valid for the runtime rank, Yogi raises a
runtime error.

Pointer rule:

```txt
ptr<Array<T, R>> = pointer to dynamic shaped array with compile-time known rank R
ptr<Array<T>>    = pointer to dynamic shaped array with runtime-known rank
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
- Normal array parameters use local/value semantics.
- Returning a partial view from a normal parameter materializes an owned copy.
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

Interprocedural value return:

```ts
function firstRow(matrix: number[2, 3]): number[3] {
    return matrix[0]
}

let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = firstRow(matrix)

row[2] = 99

print(matrix[0, 2]) // 3
```

The function parameter is a local clone. Returning `matrix[0]` clones the
borrowed view into owned return storage before function cleanup, so the caller
does not receive a dangling descriptor and mutating the returned row does not
mutate the caller's matrix. `.copy()` remains the explicit spelling when the
source is a local owner inside the function body.

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

### 10. Returned partial views from parameters

Supported by materializing the returned view as an owned copy.

Example:

```ts
function firstRow(matrix: number[2, 3]): number[3] {
    return matrix[0]
}
```

Runtime behavior:

```txt
1. normal parameter is cloned into local function storage
2. matrix[0] creates a borrowed fixed-shape view
3. return clones that view into owned return storage
4. local parameter clone and temporary view are cleaned before the function exits
```

This keeps normal parameter semantics local and prevents returned views from
pointing into dead stack/local function storage:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let row: number[3] = firstRow(matrix)

row[2] = 99

print(matrix[0, 2]) // 3
```

General borrowed-view escape analysis is still future work.

---

## Future Work

### 1. Escape analysis complete for borrowed views

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

### 2. Cleanup / destructor rules for views

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

### 3. Dynamic shaped arrays

Future implementation target:

```ts
let matrix: Array<number, 2> = [
    [1, 2],
    [3, 4]
]

let data: Array<number> = loadArray()
```

Meaning:

```txt
Array<T, Rank> = dynamic rectangular array with compile-time known rank
Array<T>       = dynamic rectangular array with runtime-known rank
```

Runtime descriptor:

```txt
data pointer
rank
dims
strides
total length
capacity / allocator metadata, if applicable
```

Known-rank indexing:

```ts
let image: Array<uint8, 3> = loadImage("photo.png")
let red: uint8 = image[y, x, 0]
```

Runtime-rank indexing:

```ts
let data: Array<number> = loadArray()
let value: number = data[0, 1]
```

Runtime checks for `Array<T>`:

```txt
- runtime rank must match the number of indices used
- every index must be within its runtime dimension
```

Offset:

```txt
offset = index0 * stride0 + index1 * stride1 + ...
```

---

### 4. Dynamic shaped views/slices

For known-rank dynamic shaped arrays:

```ts
let image: Array<uint8, 3> = loadImage("photo.png")

let pixel: Array<uint8, 1> = image[y, x]
```

For runtime-rank dynamic shaped arrays:

```ts
let data: Array<uint8> = loadImage("photo.png")

let slice: Array<uint8> = data[0]
```

The result should become a dynamic shaped borrowed view.

Known-rank view:

```txt
input rank = 3
consumed indices = 2
result rank = 1
```

Runtime-rank view:

```txt
result rank = input.rank - consumedIndices
```

Descriptor:

```txt
rank = remaining rank
dims = remaining dimensions
base = source.base + offset
strides = remaining strides
owner = source owner
```

---

### 5. Pointers to dynamic shaped arrays

Pointers should support dynamic shaped arrays directly.

```ts
ptr<Array<number, 2>>
ptr<Array<number>>
ptr<Array<number | string, 2>>
ptr<Array<number | string>>
```

The pointer points to the dynamic array descriptor. Indexing through the pointer
reads/writes the original storage.

Known-rank pointer:

```ts
function update(data: ptr<Array<number, 2>>, row: number, col: number): void {
    data[row, col] = 99
}
```

Runtime-rank pointer:

```ts
function update(data: ptr<Array<number>>, row: number, col: number): void {
    data[row, col] = 99
}
```

For `ptr<Array<T>>`, indexing is allowed and checked at runtime.

Future pointer partial view:

```ts
function row(data: ptr<Array<number, 2>>): ptr<Array<number, 1>> {
    return data[0]
}
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

## Dynamic Shaped Array Design Summary

Final design direction:

```ts
number[]                    // dynamic 1D simple
number[3]                   // fixed-size 1D
number[2, 3]                // fixed-shape rectangular 2D

Array<number, 2>            // dynamic shaped rectangular 2D, rank known
Array<number, 3>            // dynamic shaped rectangular 3D, rank known
Array<number>               // dynamic shaped rectangular array, runtime rank

Array<number | string, 2>   // dynamic shaped 2D union element array
Array<number | string>      // runtime-rank union element array

ptr<Array<number, 2>>       // pointer to dynamic shaped rank-2 array
ptr<Array<number>>          // pointer to runtime-rank dynamic shaped array
```

Rules:

```txt
T[] remains strict rank-1. It does not infer nested arrays.
Array<T, Rank> gives compile-time rank checking.
Array<T> gives runtime-rank flexibility with runtime checks.
Union element types provide controlled element flexibility.
Pointers can point to dynamic shaped array descriptors and mutate original storage.
```

Preferred philosophy:

```txt
Yogi is strict when the type carries enough information.
Yogi is flexible when the runtime can validate safely.
```

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
✅ Borrow summaries interprocedural
✅ Core pointer type: ptr<T>
✅ Address-of expression: &value
✅ Pointer parameters
✅ Full fixed-shape array pointer indexing
✅ Dynamic 1D array pointer indexing through ptr<number[]>
✅ Pointer partial views for fixed-shape arrays
✅ Address-of fixed-shape cells with row-major indexing: &matrix[i, j]
✅ Address-of dynamic array cells: &values[i]
✅ Pointer indexing read/write mutates caller storage
✅ Pointer-safe dynamic array push while a live pointer points into the array
✅ Destructive dynamic array mutation diagnostics while a live pointer points into the array
✅ Pointer rebind/scope-exit updates for dynamic array invalidation diagnostics
✅ Adaptive dynamic array storage selection: contiguous fast path unless live interior pointers require pointer-safe storage
✅ Normal array parameters use local/value semantics
✅ Pointer call diagnostics for missing &, value/pointer mismatch, shape mismatch, and pointer-to-pointer mismatch
✅ Borrow summaries for ptr<T> parameter-derived returns
✅ Rejection for returning pointer views derived from local storage
✅ Rejection for conflicting pointer-return borrow roots
✅ General dereference syntax: *p read, scalar (*p) = value write-through
```

### Next Lots

```txt
⬜ Index-sensitive destructive operation checks for pop/splice/shift while pointers are live
```

### Future Work

```txt
⬜ Escape analysis complete for borrowed views
⬜ Cleanup/destructor rules for borrowed views
⬜ Dynamic shaped arrays: Array<T, Rank>
⬜ Runtime-rank dynamic shaped arrays: Array<T>
⬜ Union element dynamic shaped arrays: Array<T union, Rank> and Array<T union>
⬜ Dynamic shaped views/slices
⬜ Pointers to dynamic shaped arrays: ptr<Array<T, Rank>> and ptr<Array<T>>
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
2. Dynamic shaped arrays: Array<T, Rank>
3. Runtime-rank dynamic shaped arrays: Array<T>
4. Union element dynamic shaped arrays
5. Pointers to dynamic shaped arrays: ptr<Array<T, Rank>> and ptr<Array<T>>
6. Dynamic shaped views/slices
7. Escape analysis complete for borrowed views
8. Cleanup/destructor rules for borrowed views
9. Native fixed-shape ABI without runtime descriptor
10. C ABI interop rules for arrays
11. Lazy iterator objects
12. Object stringification inside arrays
13. Final array method policy
14. Final diagnostics polish
15. Documentation final pass
```
