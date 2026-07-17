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
| Output string parameter | Not implemented | future `char** out` or owned handle | Native must declare how Yogi receives and frees produced text. |
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

    destroyName(value: string): void
}
```

Supported forms:

```txt
@abi param <name> borrowed
@abi param <name> copy-back
@abi param <name> native-owned free=<externFunctionName>
@abi param <name> runtime-owned
@abi return borrowed
@abi return native-owned free=<externFunctionName>
@abi return runtime-owned
```

Rules:

- A parameter contract must reference an existing parameter.
- `copy-back` requires a pointer parameter.
- `native-owned` requires `free=<externFunctionName>`.
- The free function must be declared in the same extern block.
- Return contracts cannot be attached to `void` functions.

These contracts are parsed and semantically validated today. Runtime behavior
is currently implemented for `string` returns with
`@abi return native-owned free=<externFunctionName>`.

For native-owned `string` returns, the backend generates:

```txt
call native function
copy native char* into a Yogi runtime string
call the declared native free function
return the Yogi-owned string
```

Native-owned return contracts on non-string types are rejected until those
resource ownership flows have their own ABI implementation lots.

The declared free function is compiler-managed. User code must not call it
directly because it expects the original native pointer, not a Yogi-owned
runtime string.

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
