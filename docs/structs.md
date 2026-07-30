# Struct Value Semantics

Yogi structs are concrete values with compiler-known fields and LLVM layout.
Their normal copy behavior is selected from the complete field graph.

## Recursively Copyable Structs

A struct is recursively copyable when every owned field is copyable:

```ts
struct Point {
    x: number
    y: number
}

struct Team {
    name: string
    scores: number[]
}

struct Entity {
    position: Point
    team: Team
}
```

Arrays of these structs have value semantics. Copying `Entity[]` recursively
copies each struct, string, and nested array. Mutating any nested value in the
copy does not mutate the source.

The compiler and runtime use one aggregate-copy contract rather than separate
handwritten copy paths for every struct shape.

## Pointer Fields

`ptr<T>` is an explicit reference. Copying a struct copies the pointer value:

```ts
struct Reference {
    value: ptr<number>
}
```

Both copied structs refer to the same pointee. The pointee is never cloned
implicitly, and the copied pointer does not become a second owner.

## Exclusive Native Resources

A struct that owns an extern-native resource is move-only:

```ts
struct Holder {
    resource: ptr<NativeResource>
}
```

Yogi rejects implicit copies of `Holder` or an aggregate containing `Holder`.
Diagnostics name the nested field path that makes the value non-copyable.
Normal ownership-consuming contexts still use the compiler's internal transfer
operation; no public `move(...)` syntax is exposed.

## Destruction

Copied structs own their independent copied payloads. Destruction walks owned
boxed properties recursively and destroys each nested array/object/string once.
Borrowed print wrappers and raw pointer fields carry non-owning property metadata
and are never destroyed as owned payloads.

## Current Boundaries

- Arbitrary cyclic owned object graphs are not a supported value shape.
- Explicit pointer cycles are permitted because pointer pointees are borrowed,
  not recursively copied.
- Native-resource cloning requires a future explicit clone policy; Yogi does
  not invent one.
- Allocation failure is currently fatal rather than a recoverable copy error.
