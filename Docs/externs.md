# Externs

Extern declarations describe symbols implemented outside Yogi.

Example:

```ts
extern ffmped from "ffmped.io" {
    toMp3(input: string, output: string): void
}
```

The parser accepts the extern syntax, and semantic analysis validates the
external declarations before they are written into SIR and global metadata.

## Supported External Shapes

Yogi supports external functions and variables.

Primitive function parameter and return types are currently the stable ABI
surface:

- `string`
- `number`
- `boolean`
- `void`

Aggregate values and pointers require explicit ABI design before they should be
passed across external boundaries.

## Link Inputs

External libraries are recorded in global metadata as links. The backend can use
that list when invoking LLD.

Supported external file forms include:

- `.a`
- `.dylib`
- `.so`
- `.asm`

This keeps external native dependencies explicit and visible to the backend.

## Direction

Future extern work should add pointer types and a clearer C ABI mapping for
aggregate values. Until then, external declarations should stay on primitive
types unless the runtime ABI explicitly supports the shape.
