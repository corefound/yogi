# Lot 76: Native Extern Destructor RAII

This lot introduces the base model for automatically destroying native resources
returned by `extern` blocks.

## Goal

Yogi needs one general rule before adding more complex native ownership cases
such as `ptr<string[]>`, resource-owning structs, or nested native pointers:

```txt
Yogi decides when to destroy.
The native library decides how to destroy.
```

Yogi owns the lifetime. The native library owns the actual cleanup strategy.

## Source Contract

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

The `destructor` function is not implemented in Yogi. It is a native symbol that
must exist in the linked library.

The required signature is:

```ts
destructor(resource: ptr<void>): void
```

Yogi allows `ptr<T>` to be passed as `ptr<void>` only for this compiler-generated
destructor call.

## Architecture

The frontend validates the destructor signature and marks extern calls that
return `ptr<T>` from a block with a destructor. That metadata is serialized
through the existing SIR call metadata field:

```txt
native.return.resource.destructor=<symbol>
```

The LLVM lowering layer registers local variables initialized from those calls
as native resource owners. The cleanup uses the same RAII cleanup list that
already handles arrays, strings, structs, and runtime cleanup hooks.

The minimum tracked state is:

```txt
NativeOwnedValue:
  pointer
  destructorSymbol
  ownershipState
  cleanupSlot
```

The type alone is not enough. Two extern blocks can return the same `ptr<T>`
shape while requiring different cleanup logic. The destructor identity is tied
to the producing extern call.

## Implemented Semantics

- `destructor(resource: ptr<void>): void` is recognized inside `extern`.
- Invalid destructor signatures fail during semantic analysis.
- `externName.destructor(...)` is rejected in user code as compiler-managed.
- Extern functions returning `ptr<T>` require a destructor in the same extern
  block.
- Local native resource owners are cleaned automatically on scope exit.
- Early `return` emits cleanup before returning.
- Multiple local native resources are destroyed in reverse creation order.
- Reassignment destroys the old owned resource before overwriting the variable.
- Returning a native resource variable transfers ownership to the caller.
- Simple Yogi wrapper functions that return a native resource preserve the
  destructor summary for the caller.
- Null resource pointers are skipped by cleanup.
- Missing native destructor symbols fail during linking.

## Examples

Normal scope:

```ts
function process(): void {
    const resource: ptr<NativeResource> = algorithm.create()
    use(resource)
}
```

Conceptual cleanup:

```ts
algorithm.destructor(resource)
```

Early return:

```ts
function execute(stop: boolean): void {
    const resource: ptr<NativeResource> = algorithm.create()

    if (stop) {
        return
    }
}
```

Yogi emits destructor cleanup before the return branch exits.

Reassignment:

```ts
let resource: ptr<NativeResource> = algorithm.create()
resource = algorithm.open("./data")
```

The previous resource is destroyed before the slot starts owning the replacement.

Return transfer:

```ts
function make(): ptr<NativeResource> {
    const resource: ptr<NativeResource> = algorithm.create()
    return resource
}
```

The callee does not destroy `resource`. The caller becomes the owner.

## Native Cleanup Is User-Defined

The examples using `kind`, `switch`, `malloc`, `free`, `new`, `delete`,
`fclose`, or custom allocators are illustrative only.

Yogi does not require any specific native resource layout or cleanup strategy.
The native developer defines the resource representation and destructor
behavior.

A valid destructor may call:

```txt
free
delete
delete[]
fclose
close
third_party_destroy
custom_allocator_release
```

Yogi must not guess which one is correct.

## Difference From Runtime-Owned

`runtime-owned` means the pointer already belongs to Yogi's runtime, such as a
runtime string validated by `yogi_string_require_runtime_owned`.

Extern-destructor-owned means Yogi controls lifetime, but the native library
controls destruction.

One value must have one cleanup strategy. Yogi must not call both the runtime
cleanup and the extern destructor for the same value.

## Tests

Program tests:

- `tests/programs/native_extern_destructor_c.cmake`
- `tests/programs/native_extern_destructor_cpp.cmake`
- `tests/programs/native_extern_destructor_missing_symbol.cmake`

The C test covers normal scope exit, early return, reverse destruction order,
reassignment, return transfer, null cleanup skip, and no double destruction.

The C++ test covers `new`/`delete` through a native destructor.

The missing-symbol test confirms that a declared but unexported destructor fails
during linking.

## Current Limitations

- Interprocedural destructor summaries are intentionally small. Simple direct
  wrapper returns are supported.
- Dynamic dispatch of multiple native destructors with identical exported C
  names from separate static libraries still depends on native linker symbol
  rules.
- Native resources stored inside real Yogi struct fields are handled by Lot 77.
  Resource-owning interface adapters and native arrays remain separate work.
- This lot does not implement `ptr<string[]>`, `char**`, or native-owned arrays.
