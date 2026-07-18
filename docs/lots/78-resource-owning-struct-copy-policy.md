# Lot 78: Resource-Owning Struct Copy Policy

This lot defines the first safe policy for structs that contain owned native
resources.

## Goal

Lot 77 allowed native resources to move into real struct fields:

```ts
struct Holder {
    resource: ptr<NativeResource>
}

function run(): void {
    let holder: Holder = {
        resource: native.create()
    }
}
```

The missing rule was what happens when `holder` itself is copied, returned, or
passed by value.

For now, Yogi rejects those implicit copies.

## Rule

```txt
Resource-owning structs are not implicitly copyable.
```

A struct value becomes resource-owning when one of its fields receives a native
resource returned from an extern block with:

```ts
destructor(resource: ptr<void>): void
```

The ownership is tracked per value, not per type:

```ts
let borrowed: Holder = { resource: borrowedPointer } // not owned
let owned: Holder = { resource: native.create() }    // owned
```

Only `owned` is subject to the resource-owning copy restrictions.

## Rejected Shapes

Copying into another variable is rejected:

```ts
let holder: Holder = { resource: native.create() }
let copy: Holder = holder
```

Returning by value is rejected:

```ts
function make(): Holder {
    let holder: Holder = { resource: native.create() }
    return holder
}
```

Passing by value to a normal user function is rejected:

```ts
function inspect(holder: Holder): void {
}

let holder: Holder = { resource: native.create() }
inspect(holder)
```

The safe borrow form is explicit:

```ts
inspect(&holder)
```

This requires the callee to accept `ptr<Holder>`.

Whole-struct replacement is also rejected while a resource field may be owned:

```ts
holder = otherHolder
holder = { resource: native.create() }
```

Replacing an individual resource field remains supported:

```ts
holder.resource = native.create()
```

The previous field value is destroyed before the new one is stored.

## Moved Source Resources

When a local native resource is stored into a struct field, the source resource
binding becomes moved:

```ts
let resource: ptr<NativeResource> = native.create()
let holder: Holder = { resource: resource }

print(resource) // error
```

The field now owns the pointer. The old binding must not be used afterward.

## Debug Printing

`print(holder)` remains allowed. Printing is treated as a read/debug operation,
not an ownership transfer.

## Current Limitations

- No copy constructor or clone policy for resource-owning structs yet.
- Whole-struct reassignment replacement still needs a dedicated replacement
  policy.
- Passing resource-owning structs by value needs explicit move/copy semantics.
- Module/global resource-owning structs remain unsupported until module cleanup
  has field-aware native resource scheduling.
- Runtime object/dictionary resource-field ownership remains unsupported.

Lot 79 adds the first explicit whole-value move shape:

```ts
let next: Holder = move(holder)
return move(holder)
```

That support is intentionally separate from implicit copying.

## Tests

Frontend semantic tests cover:

- variable copy rejection
- return-by-value rejection
- pass-by-value rejection
- source native resource use-after-move rejection
- `print(holder)` positive control
