# Lot 81: Automatic Resource Ownership Transfer

Yogi no longer exposes `move(...)` as public syntax. Resource ownership
transfer is now inferred by the compiler from the value type and the consuming
context.

The user writes normal TypeScript-like code:

```ts
let next: Holder = holder
return holder
consume(holder)
target = holder
```

If `Holder` owns native resource fields, the semantic phase creates an internal
`$move` call in SIR. LLVM lowering still uses the existing move/cleanup path,
but source code never needs to mention it.

## Rules

- Copyable structs still copy normally.
- Resource-owning structs transfer ownership in declarations, returns,
  assignments, by-value function calls, and struct field construction.
- The source binding is consumed and cannot be used afterward.
- Assignment destroys the current target resource fields before installing the
  transferred owner metadata.
- Public `move(...)` calls are rejected with a diagnostic explaining that move
  is compiler-internal.

## Examples

```ts
struct Holder {
    resource: ptr<NativeResource>
}

let holder: Holder = createHolder()
let next: Holder = holder

print(holder) // error: holder was moved
```

```ts
function make(): Holder {
    let holder: Holder = createHolder()
    return holder
}
```

```ts
function consume(holder: Holder): void {
}

let holder: Holder = createHolder()
consume(holder)

print(holder) // error: holder was moved
```

## Backend Notes

The internal `$move` call carries native resource field metadata through SIR so
declaration, assignment, return, and by-value call lowering can transfer or
destroy the correct fields even when the source owner has already been
deactivated.

## Tests

- Frontend diagnostics cover automatic declaration, return, assignment,
  by-value parameter transfer, const-source rejection, use-after-transfer, and
  public `move(...)` rejection.
- `yogi_program_native_resource_struct_fields` verifies end-to-end LLVM/runtime
  cleanup for declaration transfer, return transfer, assignment replacement,
  returned assignment, and by-value consumption.
