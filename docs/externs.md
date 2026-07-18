# Externs

Extern declarations describe symbols implemented outside Yogi.

Example:

``` ts
extern ffmped from "ffmped.io" {
    toMp3(input: string, output: string): void
}
```

The parser accepts the extern syntax, and semantic analysis validates
the external declarations before they are written into SIR and global
metadata.

## Supported External Shapes

Yogi supports external functions and variables.

Primitive function parameter and return types are stable ABI surface:

-   `string`
-   `number`
-   `boolean`
-   `void`

Arrays use an explicit native bridge instead of exposing the internal
Yogi descriptor.

Supported numeric, string, and plain numeric struct array parameter shapes:

``` ts
extern native from "./libnative.a" {
    sum(values: number[]): number              // C: double*, uint64_t length
    normalize(values: ptr<number[]>): void     // C: double*, uint64_t length, copy-back
    dot(values: number[4]): number             // C: double*, uint64_t length
    transform(matrix: ptr<number[2, 3]>): void // C: double*, uint64_t rows, uint64_t columns
    lookup(words: string[]): number            // C: const char**, uint64_t length
    score(readings: Reading[]): number         // C: Reading*, uint64_t length
    calibrate(readings: ptr<Reading[]>): void  // C: Reading*, uint64_t length, copy-back
}
```

Rules:

-   `number[]` is borrowed read-only by native code.
-   `string[]` is converted to a temporary read-only `const char**` plus length.
-   Plain numeric `Struct[]` is borrowed read-only by native code.
-   `ptr<number[]>`, `ptr<number[N, M]>`, and `ptr<Struct[]>` are borrowed mutable by native code.
-   Mutable native calls copy modified values back into the existing Yogi array slots.
-   Native code must not retain the pointer after the call returns.
-   Native code must not structurally resize the array.
-   `ptr<string[]>`, nested dynamic arrays, array extern variables, and array returns are rejected.
-   Struct array ABI currently requires every struct field to be a required `number` field.

## Link Inputs

External libraries are recorded in global metadata as links. The backend
can use that list when invoking LLD.

Supported external file forms include:

-   `.a`
-   `.dylib`
-   `.so`
-   `.dll`
-   `.lib`
-   `.o`
-   `.asm`

This keeps external native dependencies explicit and visible to the
backend.

## Native Array ABI

The backend lowers supported numeric arrays to a public C ABI shape:

``` txt
number[]          -> double* data, uint64_t length
ptr<number[]>     -> double* data, uint64_t length, copy-back after call
number[N]         -> double* data, uint64_t length
number[N, M]      -> double* data, uint64_t N, uint64_t M
ptr<number[N, M]> -> double* data, uint64_t N, uint64_t M, copy-back after call
string[]          -> const char** data, uint64_t length
Struct[]          -> Struct* data, uint64_t length
ptr<Struct[]>     -> Struct* data, uint64_t length, copy-back after call
```

This does not mean a Yogi dynamic array is stored internally as `double*`.
The runtime may use pointer-safe storage for arrays with live internal pointers.
For native calls, Yogi materializes a temporary contiguous buffer and destroys
that buffer after the synchronous call returns.

For `string[]`, Yogi also copies the string text into a temporary native buffer.
The original Yogi `string[]` and its values remain unchanged after the call.
Native code may read the strings but must not mutate, free, or retain the
received pointers.

## Native String Ownership Policy

Mutable native strings are policy-gated. Yogi currently supports only input
strings across the Native ABI.

| Mode | Current Status | Native Shape | Rule |
|---|---|---|---|
| Input string | Supported | `const char*` or `const char** + length` | Native borrows read-only during the call. |
| Native-owned output string return | Supported | `char*` return plus `@abi return native-owned free=...` | Yogi copies to a runtime-owned string, then calls the declared native free function. |
| Runtime-owned output string return | Supported | `char*` return plus `@abi return runtime-owned` | Yogi validates that the returned pointer is already managed by the runtime, then adopts it directly. |
| Output string parameter | Supported for native-owned and runtime-owned single strings | `char**` output plus an explicit `@abi param name output ...` contract | Native-owned output is copied and freed. Runtime-owned output is validated and adopted directly. |
| In/out string | Not implemented | future `char** + length` or descriptor | Native replacement needs explicit copy-back and free rules. |

`ptr<string[]>` remains rejected because it would let native code replace string
entries without a declared ownership contract. Before enabling it, Yogi must know
whether replacement pointers are borrowed, native-owned with a free function, or
runtime-owned handles.

If a future native call replaces a string with text of a different length, Yogi
must create a new Yogi-owned string for that array slot during copy-back. It
must not mutate an existing Yogi string buffer in place.

See `docs/lots/71-mutable-native-string-abi-policy.md` for the full policy.

## Native ABI Ownership Contracts

Extern function signatures can declare ownership contracts with JSDoc-style
`@abi` metadata:

```ts
extern native from "./libnative.a" {
    /** @abi param values borrowed */
    process(values: string[]): void

    /** @abi return native-owned free=destroyName */
    getName(): string

    /** @abi param name output native-owned free=destroyName */
    readName(name: ptr<string>): void

    /** @abi return runtime-owned */
    getRuntimeName(): string

    /** @abi param runtimeName output runtime-owned */
    readRuntimeName(runtimeName: ptr<string>): void

    destroyName(value: string): void
}
```

Supported forms:

```txt
@abi param <name> borrowed
@abi param <name> copy-back
@abi param <name> output native-owned free=<externFunctionName>
@abi param <name> output runtime-owned
@abi return borrowed
@abi return native-owned free=<externFunctionName>
@abi return runtime-owned
```

Rules:

- A parameter contract must reference an existing parameter.
- `copy-back` requires a pointer parameter.
- `output native-owned` and `output runtime-owned` currently require `ptr<string>`.
- `native-owned` requires `free=<externFunctionName>`.
- `runtime-owned` must not declare `free=<externFunctionName>` because the pointer is already managed by Yogi.
- The free function must be declared in the same extern block.
- Return contracts cannot be attached to `void` functions.

These contracts are parsed and semantically validated today. Runtime behavior is
implemented for single `string` returns and `ptr<string>` output parameters with
either native-owned or runtime-owned ownership.

For native-owned `string` returns, the backend generates:

```txt
call native function
copy native char* into a Yogi runtime string
call the declared native free function
return the Yogi-owned string
```

For native-owned output `ptr<string>` parameters, the backend generates:

```txt
allocate temporary native char* output slot
call native function with char**
copy native char* into a Yogi runtime string
call the declared native free function
write the copied string through ptr<string>
```

For runtime-owned `string` returns and output `ptr<string>` parameters, the
backend generates:

```txt
receive native char*
validate with yogi_string_require_runtime_owned
adopt the same Yogi-owned string pointer
```

Native-owned return contracts on non-string types are rejected until those
resource ownership flows have their own ABI implementation lots.

The declared free function is compiler-managed. User code must not call it
directly because it expects the original native pointer, not a Yogi-owned
runtime string.

## Native Extern Destructor RAII

An `extern` block can declare one compiler-managed native destructor:

```ts
struct NativeResource {
    kind: i32
    value: ptr<string>
}

extern algorithm from "./algorithm.a" {
    create(): ptr<NativeResource>
    clone(resource: ptr<NativeResource>): ptr<NativeResource>
    open(path: string): ptr<NativeResource>

    destructor(resource: ptr<void>): void
}
```

The rule is:

```txt
Yogi decides when to destroy.
The native library decides how to destroy.
```

Every `ptr<T>` returned by functions in that extern block is treated as a native
resource owned by Yogi. Yogi records the destructor associated with the produced
value and emits the destructor automatically at the end of the owning lifetime.

The required destructor signature is exactly:

```ts
destructor(resource: ptr<void>): void
```

Rules:

- Only one `destructor` function may appear in an extern block.
- The destructor must have exactly one parameter.
- The parameter must be `ptr<void>`.
- The return type must be `void`.
- User code cannot call `externName.destructor(...)` manually.
- Yogi converts `ptr<T>` to `ptr<void>` only for this compiler-generated ABI call.
- If the linked native library does not export the destructor symbol, linking
  fails with a native symbol error.

Cleanup is RAII-style:

```ts
function process(): void {
    const resource: ptr<NativeResource> = algorithm.create()
    use(resource)
}
```

Conceptually lowers to:

```ts
function process(): void {
    const resource: ptr<NativeResource> = algorithm.create()
    use(resource)
    algorithm.destructor(resource)
}
```

The cleanup is emitted on normal scope exit and on early `return`. Local
resources are destroyed in reverse creation order. Reassignment destroys the old
owned resource before the variable is overwritten. Returning a resource transfers
ownership to the caller.

`runtime-owned` is a different model. Runtime-owned strings are already managed
by the Yogi runtime and are validated with `yogi_string_require_runtime_owned`.
Extern-destructor-owned values are owned by Yogi for lifetime purposes, but the
native library owns the actual destruction strategy.

The examples using `kind`, `switch`, `malloc`, `free`, `new`, `delete`,
`fclose`, or custom allocators are illustrative only. Yogi does not require any
specific native resource layout or cleanup strategy. The native developer
defines the resource representation and destructor behavior.

Native resources can also be stored in real Yogi struct fields:

```ts
struct Holder {
    resource: ptr<NativeResource>
}

function run(): void {
    const resource: ptr<NativeResource> = algorithm.create()
    let holder: Holder = { resource: resource }
}
```

The local pointer cleanup moves to `holder.resource`. When `holder` leaves
scope, Yogi calls the extern destructor for that field. Inline creation and
nested paths such as `nested.holder.resource` are also tracked.

Field reassignment destroys the old native pointer before the replacement is
stored:

```ts
holder.resource = algorithm.open("./data")
```

Pointer fields that did not receive native ownership metadata are treated as raw
or borrowed pointers and are not destroyed automatically.

Resource-owning structs are not implicitly copyable. Yogi rejects whole-struct
copies, whole-struct reassignment, and normal by-value user function calls while
a struct owns native resource fields. Borrow the existing struct explicitly with
`&holder`, replace individual resource fields, or transfer the whole value with
`move(holder)` in a declaration, return, or assignment:

```ts
let next: Holder = move(holder)
return move(holder)
target = move(holder)
```

After `move(holder)`, the old `holder` binding is consumed and cannot be used.
On assignment, the previous target resource fields are destroyed before the new
owner is stored.

For struct arrays, the C struct must match Yogi field order and use `double`
for every field:

``` ts
struct Reading {
    value: number
    offset: number
}
```

``` c
typedef struct {
    double value;
    double offset;
} Reading;
```

------------------------------------------------------------------------

# Asynchronous Wrappers for External Functions

An `extern` declaration only defines the ABI contract of a native
symbol. It does not define how that symbol is executed.

``` ts
extern sqlite from "sqlite3" {
    query(sql: string): QueryResult
}
```

Blocking native functions should be exposed as asynchronous APIs through
ordinary Yogi wrappers rather than additional language syntax.

## Wrapping Native Functions

``` ts
extern sqlite from "sqlite3" {
    query(sql: string): QueryResult
}

function queryAsync(sql: string): Promise<QueryResult> {
    return Promise.run((): QueryResult => {
        return query(sql)
    })
}
```

Usage:

``` ts
const result: QueryResult = await queryAsync(sql)
```

## Promise.run()

`Promise.run()` schedules a callback on the runtime worker pool and
immediately returns a `Promise<T>`.

Conceptually:

``` text
Promise.run(callback)
        │
        ├── enqueue callback
        ├── return Promise<T>
        ├── worker executes callback
        ├── callback calls native function
        └── Promise resolves
```

The callback may execute:

-   Native C ABI functions
-   Pure Yogi code
-   Mixed native and Yogi code

## Design Philosophy

Yogi intentionally keeps `extern` simple.

There are no special declarations such as:

-   `extern async`
-   `extern blocking`

Asynchronous behavior is expressed with standard language constructs:

-   `Promise`
-   `async`
-   `await`
-   `Promise.run()`

This keeps the ABI declaration independent from execution strategy.

## Compiler Responsibilities

The compiler uses the extern declaration to:

-   Emit external LLVM declarations.
-   Generate wrapper functions.
-   Capture callback state.
-   Integrate with the scheduler runtime.
-   Preserve ownership and lifetime.

The implementation itself is resolved later by the linker.

## Runtime Responsibilities

The runtime provides:

-   Worker thread pools.
-   Scheduler integration.
-   Promise resolution.
-   Async task resumption.
-   Error propagation.
-   Ownership validation across worker boundaries.

## Benefits

-   No additional syntax.
-   Existing extern declarations remain unchanged.
-   Native functions can be used synchronously or asynchronously.
-   Wrapper libraries can expose clean async APIs.
-   Existing C and C++ libraries require no modification.
