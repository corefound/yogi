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

Supported numeric array parameter shapes:

``` ts
extern native from "./libnative.a" {
    sum(values: number[]): number              // C: double*, uint64_t length
    normalize(values: ptr<number[]>): void     // C: double*, uint64_t length, copy-back
    dot(values: number[4]): number             // C: double*, uint64_t length
    transform(matrix: ptr<number[2, 3]>): void // C: double*, uint64_t rows, uint64_t columns
}
```

Rules:

-   `number[]` is borrowed read-only by native code.
-   `ptr<number[]>` and `ptr<number[N, M]>` are borrowed mutable by native code.
-   Mutable native calls copy modified values back into the existing Yogi array slots.
-   Native code must not retain the pointer after the call returns.
-   Native code must not structurally resize the array.
-   `string[]`, nested dynamic arrays, array extern variables, and array returns are rejected.
-   Arrays of structs are rejected until a stable struct marshalling layout exists.

## Link Inputs

External libraries are recorded in global metadata as links. The backend
can use that list when invoking LLD.

Supported external file forms include:

-   `.a`
-   `.dylib`
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
```

This does not mean a Yogi dynamic array is stored internally as `double*`.
The runtime may use pointer-safe storage for arrays with live internal pointers.
For native calls, Yogi materializes a temporary contiguous buffer and destroys
that buffer after the synchronous call returns.

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
