# Lot 82: Native Job Ticket Program Test

This lot adds one complete Program Test before continuing with more array work.
The goal is to make sure recent ownership and extern improvements appear in a
real Yogi program, not only in focused semantic tests.

## Added Program

```txt
tests/programs/native_job_ticket_ownership.cmake
```

The program builds a small native C library and uses it from Yogi through
`extern`.

It models a native job system:

- native code creates `NativeJob` handles
- Yogi wraps each handle inside a real `JobTicket` struct
- native code computes a ticket score
- native code returns a native-owned label string
- Yogi copies that label into a runtime-owned `string`
- Yogi automatically calls the configured native string free function
- Yogi automatically destroys native job handles through extern destructor RAII

## Yogi Features Covered

```ts
struct NativeJob {
    id: number
    weight: number
}

struct JobTicket {
    handle: ptr<NativeJob>
    score: number
}
```

The program validates that resource-owning structs move automatically through
normal Yogi syntax:

```ts
current = next

return current

consume(ticket)
```

The user never writes `move(...)`. Semantic analysis emits the internal
ownership-transfer operation when the value owns native resources.

## Extern Coverage

The test uses:

```ts
extern jobs from "./libnative_jobs.a" {
    createJob(id: number, weight: number): ptr<NativeJob>
    scoreJob(job: ptr<NativeJob>): number

    /** @abi return native-owned free=destroyLabel */
    makeLabel(id: number): string

    destroyLabel(value: string): void
    destructor(resource: ptr<void>): void
}
```

This covers:

- static native library linking
- native pointer returns
- native resource destructors
- native-owned string returns
- automatic native string free after Yogi string adoption
- LLVM IR/object/executable generation
- runtime output validation

## Expected Behavior

When replacing one `JobTicket` with another, the old native handle is destroyed
and the new handle moves into the target.

When returning a ticket, ownership moves to the caller.

When passing a ticket by value to `consume`, ownership is consumed and cleanup
runs after the call.

The test also verifies that the native-owned label is freed exactly once after
being copied into a Yogi string.
