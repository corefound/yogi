# Lot 83: Resource-Owning Array Elements

This lot closes the first practical path for arrays that contain structs with
owned native resources.

The important rule is:

```txt
When a resource-owning struct is pushed into an array, the array becomes the
owner of that element.
```

That means the original local value must not be cleaned again after `push`.

## Covered Program

```txt
tests/programs/native_resource_array_ownership.cmake
```

The program builds a small native C library and validates:

- `extern` native resource creation from a static `.a` library
- resource handles stored inside real Yogi structs
- `tickets.push(createTicket(...))`
- `tickets.push(ticket)` where `ticket` is a local resource-owning struct
- cleanup of remaining array elements at the end of the array lifetime
- no double free when a local owned struct is transferred into an array
- LLVM IR, object file, executable generation, and runtime output

## Example

```ts
struct NativeJob {
    id: number
    weight: number
}

struct JobTicket {
    handle: ptr<NativeJob>
    score: number
}

function pushMovedLocalTicket(): void {
    let tickets: JobTicket[] = []
    let ticket: JobTicket = createTicket(3, 9)

    tickets.push(ticket)

    print(jobs.destroyedJobCount())
}
```

After `tickets.push(ticket)`, the array owns the native handle stored inside
`ticket.handle`. The local `ticket` cleanup is deactivated, and array cleanup
later destroys the handle exactly once.

## Backend Fix

The LLVM lowerer now records native resource field destructors on the array
owner when `array.push` receives a resource-owning struct element.

It also deactivates the source owner for identifier arguments that already have
native resource field ownership registered in the lowering context. This keeps
the generated cleanup schedule correct even when the SIR does not contain an
explicit internal `move` wrapper.

## Current Limitation

Returning an owned resource struct from `pop()` or `shift()` still needs a
separate lot.

The backend has enough metadata to recognize array element destructors, but the
semantic side still needs precise narrowing for `T | undefined` so code can
safely express:

```ts
let ticket: JobTicket = tickets.pop()
```

That should only be accepted when the compiler can prove the array is non-empty
or when the user narrows the `undefined` case explicitly.
